export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isConfigured } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { checkCronAuth, unauthorized, notConfigured } from "@/lib/cron";

const TERMINAL_STATUSES = ["closed", "recovered", "cancelled"];

// GET /api/cron/followups — create "Follow up:" tasks for cases with no
// task activity in the last 7 days.
export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) return unauthorized();

  try {
    const supabase = getServiceClient();
    if (!supabase || !isConfigured()) return notConfigured();

    // Open cases (excluding terminal statuses).
    const { data: cases, error: casesErr } = await supabase
      .from("cases")
      .select("id, title")
      .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`);
    if (casesErr) throw casesErr;

    // All task activity in the last 7 days → case_ids with recent activity.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("case_id")
      .gte("created_at", sevenDaysAgo);
    if (tasksErr) throw tasksErr;

    const activeCaseIds = new Set(
      (recentTasks ?? []).map((t) => t.case_id).filter(Boolean)
    );

    let created = 0;
    for (const c of cases ?? []) {
      if (activeCaseIds.has(c.id)) continue; // has recent task activity

      // Skip if an open "Follow up:" task already exists for this case.
      const { data: existing, error: existErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("case_id", c.id)
        .eq("done", false)
        .like("title", "Follow up:%")
        .limit(1);
      if (existErr) throw existErr;
      if (existing && existing.length > 0) continue;

      const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const dueStr = due.toISOString().slice(0, 10);

      const { error: insertErr } = await supabase.from("tasks").insert({
        case_id: c.id,
        title: `Follow up: ${c.title}`,
        due_date: dueStr,
        done: false,
        notes: "Auto-created: no task activity in 7+ days.",
      });
      if (insertErr) throw insertErr;
      created += 1;
    }

    await audit(supabase, "cron.followups", "cron", "followups", `created=${created}`, "cron");
    return NextResponse.json({ ok: true, created });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Follow-up cron failed" },
      { status: 500 }
    );
  }
}
