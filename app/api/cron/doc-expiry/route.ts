export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isConfigured } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { checkCronAuth, unauthorized, notConfigured } from "@/lib/cron";

// GET /api/cron/doc-expiry — create reminder tasks for documents and claimant
// IDs expiring within the next 30 days (plus anything that expired in the
// last 365 days but never got a task).
export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) return unauthorized();

  try {
    const supabase = getServiceClient();
    if (!supabase || !isConfigured()) return notConfigured();

    const toDate = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const lower = toDate(new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000));
    const upper = toDate(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000));

    let docTasks = 0;
    let claimantTasks = 0;

    // Documents expiring in window [today-365d, today+30d].
    const { data: docs, error: docsErr } = await supabase
      .from("documents")
      .select("id, case_id, file_name, expiry_date")
      .gte("expiry_date", lower)
      .lte("expiry_date", upper);
    if (docsErr) throw docsErr;

    for (const doc of docs ?? []) {
      const title = `Document expiring: ${doc.file_name}`;
      // Skip if an open task with this exact title already exists.
      const { data: existing, error: existErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("case_id", doc.case_id)
        .eq("done", false)
        .eq("title", title)
        .limit(1);
      if (existErr) throw existErr;
      if (existing && existing.length > 0) continue;

      const { error: insertErr } = await supabase.from("tasks").insert({
        case_id: doc.case_id,
        title,
        due_date: doc.expiry_date,
        done: false,
        notes: `Auto-created: document "${doc.file_name}" expires ${doc.expiry_date}.`,
      });
      if (insertErr) throw insertErr;
      docTasks += 1;
    }

    // Claimant IDs expiring in the same window.
    const { data: claimants, error: claimantsErr } = await supabase
      .from("claimants")
      .select("id, case_id, full_name, id_expiry_date")
      .gte("id_expiry_date", lower)
      .lte("id_expiry_date", upper);
    if (claimantsErr) throw claimantsErr;

    for (const cl of claimants ?? []) {
      const title = `Claimant ID expiring: ${cl.full_name}`;
      const { data: existing, error: existErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("case_id", cl.case_id)
        .eq("done", false)
        .eq("title", title)
        .limit(1);
      if (existErr) throw existErr;
      if (existing && existing.length > 0) continue;

      const { error: insertErr } = await supabase.from("tasks").insert({
        case_id: cl.case_id,
        title,
        due_date: cl.id_expiry_date,
        done: false,
        notes: `Auto-created: ID for claimant "${cl.full_name}" expires ${cl.id_expiry_date}.`,
      });
      if (insertErr) throw insertErr;
      claimantTasks += 1;
    }

    await audit(
      supabase,
      "cron.doc-expiry",
      "cron",
      "doc-expiry",
      `documents=${docTasks} claimants=${claimantTasks}`,
      "cron"
    );
    return NextResponse.json({ ok: true, documents: docTasks, claimants: claimantTasks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Doc-expiry cron failed" },
      { status: 500 }
    );
  }
}
