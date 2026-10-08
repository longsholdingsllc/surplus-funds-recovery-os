export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isConfigured } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { checkCronAuth, unauthorized, notConfigured } from "@/lib/cron";
import { rankLeads } from "@/lib/lead-scorer";
import counties from "@/lib/counties.json";

// Shape of one entry in lib/counties.json.
interface CountyEntry {
  county: string;
  state: string;
  source_url: string;
  enabled: boolean;
}

interface Lead {
  amount: number | null;
  parcel: string | null;
  address: string | null;
  snippet: string;
}

const FETCH_TIMEOUT_MS = 15_000;
const MAX_LEADS_PER_COUNTY = 25;
const MAX_SNIPPET_CHARS = 500;
const CONTEXT_CHARS = 80; // chars of surrounding text kept for each match
const MIN_SCORE = 25;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function snippetAround(text: string, index: number, matchLen: number): string {
  const start = Math.max(0, index - CONTEXT_CHARS);
  const end = Math.min(text.length, index + matchLen + CONTEXT_CHARS);
  return text.slice(start, end).trim().slice(0, MAX_SNIPPET_CHARS);
}

// Best-effort extraction of surplus-money leads from page text:
// (a) dollar amounts near surplus/excess/unclaimed keywords,
// (b) parcel-like tokens, (c) street addresses.
function extractLeads(text: string): Lead[] {
  const leads: Lead[] = [];

  const amountRe = /\$\s?[\d,]+(\.\d{2})?/g;
  const keywordRe = /surplus|excess|unclaimed/i;
  const parcelRe = /\b\d{2}-?\d{2}-?\d{3}-?\d{3}-?\d{3,4}\b/g;
  const addressRe =
    /\b\d{1,5}\s+[A-Z][a-zA-Z.' ]+\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Blvd|Way|Ter|Pl|Place)\b/g;

  let m: RegExpExecArray | null;

  while ((m = amountRe.exec(text)) !== null && leads.length < MAX_LEADS_PER_COUNTY) {
    const window = text.slice(Math.max(0, m.index - 120), m.index + m[0].length + 120);
    if (!keywordRe.test(window)) continue; // amount must be near a keyword
    const amount = Number(m[0].replace(/[$,\s]/g, "")) || null;
    leads.push({
      amount,
      parcel: null,
      address: null,
      snippet: snippetAround(text, m.index, m[0].length),
    });
  }

  while ((m = parcelRe.exec(text)) !== null && leads.length < MAX_LEADS_PER_COUNTY) {
    leads.push({
      amount: null,
      parcel: m[0],
      address: null,
      snippet: snippetAround(text, m.index, m[0].length),
    });
  }

  while ((m = addressRe.exec(text)) !== null && leads.length < MAX_LEADS_PER_COUNTY) {
    leads.push({
      amount: null,
      parcel: null,
      address: m[0],
      snippet: snippetAround(text, m.index, m[0].length),
    });
  }

  return leads;
}

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return stripHtml(html);
  } finally {
    clearTimeout(timer);
  }
}

// Returns true when this lead is already tracked (by parcel_id, or a case
// in the same county whose notes/title mention the address).
async function isDuplicate(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  entry: CountyEntry,
  lead: Lead
): Promise<boolean> {
  if (lead.parcel) {
    const { data, error } = await supabase
      .from("properties")
      .select("id")
      .eq("parcel_id", lead.parcel)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) return true;
  }

  if (lead.address) {
    const { data, error } = await supabase
      .from("cases")
      .select("id")
      .eq("county", entry.county)
      .or(`title.ilike.%${lead.address}%,notes.ilike.%${lead.address}%`)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) return true;
  }

  return false;
}

// GET /api/cron/lead-digest — scrape enabled county sources for surplus
// leads, score them, and insert high-scoring ones as status='lead' cases.
export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) return unauthorized();

  try {
    const supabase = getServiceClient();
    if (!supabase || !isConfigured()) return notConfigured();

    const entries = (counties as CountyEntry[]).filter((e) => e.enabled === true);
    let inserted = 0;
    const perCounty: Record<
      string,
      { leads: number; scored: number; inserted: number; error?: string }
    > = {};

    for (const entry of entries) {
      perCounty[entry.county] = { leads: 0, scored: 0, inserted: 0 };
      try {
        const text = await fetchPageText(entry.source_url);
        const rawLeads = extractLeads(text);
        perCounty[entry.county].leads = rawLeads.length;

        const scored = rankLeads(rawLeads, MIN_SCORE);
        perCounty[entry.county].scored = scored.length;

        for (const lead of scored) {
          if (await isDuplicate(supabase, entry, lead)) continue;

          const label = lead.address || lead.parcel || "unnamed";
          const notes = [
            `Score: ${lead.score}/100 (${lead.reasons.join(", ")})`,
            `Source: ${entry.source_url}`,
            lead.snippet,
          ].join("\n");

          const { data, error } = await supabase
            .from("cases")
            .insert({
              title: `Surplus lead — ${label} [${lead.score}]`,
              status: "lead",
              county: entry.county,
              state: entry.state,
              surplus_amount: lead.amount,
              notes,
              source: "lead-digest",
            })
            .select("id")
            .single();
          if (error) throw error;

          // Link a property row when we have identifiers
          if (lead.parcel || lead.address) {
            await supabase.from("properties").insert({
              case_id: data.id,
              parcel_id: lead.parcel,
              address: lead.address,
              county: entry.county,
              state: entry.state,
              notes: lead.snippet?.slice(0, 200) || null,
            });
          }

          await audit(
            supabase,
            "case.create",
            "case",
            data.id,
            `source=lead-digest county=${entry.county} score=${lead.score} label=${label}`,
            "cron"
          );
          inserted += 1;
          perCounty[entry.county].inserted += 1;
        }
      } catch (err) {
        // One bad county must not sink the whole digest run.
        perCounty[entry.county].error = err instanceof Error ? err.message : "unknown error";
      }
    }

    await audit(
      supabase,
      "cron.lead-digest",
      "cron",
      "lead-digest",
      JSON.stringify({ inserted, perCounty }),
      "cron"
    );
    return NextResponse.json({ ok: true, inserted, perCounty });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lead-digest cron failed" },
      { status: 500 }
    );
  }
}
