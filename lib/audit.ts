import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append a row to audit_log. Every mutation in the API routes and every cron
 * must call this. Never throws — audit failure is recorded to console but
 * does not break the caller's operation.
 */
export async function audit(
  supabase: SupabaseClient,
  action: string,
  entity: string,
  entityId: string | number | null,
  detail?: string | null,
  actor: string = "web"
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      actor,
      action,
      entity,
      entity_id: entityId == null ? null : String(entityId),
      detail: detail ?? null,
    });
  } catch (err) {
    console.error("audit_log write failed:", err);
  }
}
