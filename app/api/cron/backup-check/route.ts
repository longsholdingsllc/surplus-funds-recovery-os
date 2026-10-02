export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isConfigured } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { checkCronAuth, unauthorized, notConfigured } from "@/lib/cron";

// GET /api/cron/backup-check — verify the database is reachable (read the
// cases table) so backup/monitoring tooling has a heartbeat to check.
export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) return unauthorized();

  try {
    const supabase = getServiceClient();
    if (!supabase || !isConfigured()) return notConfigured();

    const { count, error } = await supabase
      .from("cases")
      .select("id", { count: "exact", head: true });

    if (error) {
      await audit(supabase, "cron.backup-check", "cron", "backup-check", `FAILED: ${error.message}`, "cron");
      return NextResponse.json({ ok: false, error: error.message });
    }

    const cases = count ?? 0;
    await audit(supabase, "cron.backup-check", "cron", "backup-check", `ok, cases=${cases}`, "cron");
    return NextResponse.json({ ok: true, cases });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup-check cron failed" },
      { status: 500 }
    );
  }
}
