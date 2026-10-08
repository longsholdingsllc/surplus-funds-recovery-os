export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isConfigured } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { checkCronAuth, unauthorized, notConfigured } from "@/lib/cron";

function formatAmount(amount: unknown): string {
  if (amount === null || amount === undefined) return "an unclaimed surplus";
  const n = Number(amount);
  if (Number.isFinite(n)) {
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  return String(amount);
}

function extractScore(title: string | null, notes: string | null): number {
  // Title format: "Surplus lead — label [score]"
  const fromTitle = title?.match(/\[(\d+)\]/);
  if (fromTitle) return Number(fromTitle[1]);
  // Notes format: "Score: 42/100 (...)"
  const fromNotes = notes?.match(/Score:\s*(\d+)/i);
  if (fromNotes) return Number(fromNotes[1]);
  return 0;
}

// Build a DRAFT outreach email. Stored as a task note — never sent automatically.
function buildDraftBody(opts: {
  title: string;
  county: string | null;
  state: string | null;
  surplus_amount: unknown;
}): string {
  const location = [opts.county, opts.state].filter(Boolean).join(", ") || "your county";
  const amount = formatAmount(opts.surplus_amount);

  return [
    "DRAFT ONLY — DO NOT SEND AUTOMATICALLY.",
    "",
    `Subject: Unclaimed surplus funds in ${location} — can we help you recover them?`,
    "",
    "Hello,",
    "",
    `My name is John, and I work with families in ${location} to recover surplus funds left over after tax sales. Records indicate ${amount} in surplus may be tied to "${opts.title}".`,
    "",
    "These funds belong to the former property owner and can be claimed with the right documentation — but the filing window is limited, and the money is eventually forfeited if no claim is made.",
    "",
    "If you believe you may be the rightful claimant, the next step is simple: confirm your identity and your connection to the property, and we will prepare the claim paperwork for your review and signature. There is no upfront fee from our side to start the conversation.",
    "",
    "Would a brief call this week work to discuss it?",
    "",
    "John — Long's Holdings LLC",
  ].join("\n");
}

// GET /api/cron/outreach-drafts — stage outreach email drafts as tasks for
// cases with status='new' OR high-score status='lead'. Drafts only; never sends.
export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) return unauthorized();

  try {
    const supabase = getServiceClient();
    if (!supabase || !isConfigured()) return notConfigured();

    const { data: cases, error: casesErr } = await supabase
      .from("cases")
      .select("id, title, county, state, surplus_amount, status, notes")
      .in("status", ["new", "lead"]);
    if (casesErr) throw casesErr;

    let created = 0;
    for (const c of cases ?? []) {
      // Only auto-draft leads that scored high enough
      if (c.status === "lead") {
        const score = extractScore(c.title, c.notes);
        if (score < 40) continue;
      }

      // Skip if an open "Outreach draft:" task already exists for this case.
      const { data: existing, error: existErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("case_id", c.id)
        .eq("done", false)
        .like("title", "Outreach draft:%")
        .limit(1);
      if (existErr) throw existErr;
      if (existing && existing.length > 0) continue;

      const body = buildDraftBody({
        title: c.title,
        county: c.county,
        state: c.state,
        surplus_amount: c.surplus_amount,
      });
      const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const { error: insertErr } = await supabase.from("tasks").insert({
        case_id: c.id,
        title: `Outreach draft: ${c.title}`,
        due_date: due,
        done: false,
        notes: body,
      });
      if (insertErr) throw insertErr;
      created += 1;
    }

    await audit(supabase, "cron.outreach-drafts", "cron", "outreach-drafts", `created=${created}`, "cron");
    return NextResponse.json({ ok: true, created });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Outreach-drafts cron failed" },
      { status: 500 }
    );
  }
}
