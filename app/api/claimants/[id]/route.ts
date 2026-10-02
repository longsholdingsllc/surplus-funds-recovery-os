export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";

interface RouteParams {
  params: { id: string };
}

// PATCH /api/claimants/[id] — partial update of a claimant.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const { id } = params;
    const body = await req.json();

    const allowed = ["full_name", "case_id", "contact_info", "id_expiry_date", "notes"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("claimants")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116")
        return NextResponse.json({ error: "Claimant not found" }, { status: 404 });
      throw error;
    }

    await audit(
      supabase,
      "claimant.update",
      "claimant",
      id,
      `fields=${Object.keys(updates).join(",")}`,
      "web"
    );
    return NextResponse.json({ claimant: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update claimant" },
      { status: 500 }
    );
  }
}

// DELETE /api/claimants/[id] — delete a claimant.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const { id } = params;

    const { error } = await supabase.from("claimants").delete().eq("id", id);
    if (error) throw error;

    await audit(supabase, "claimant.delete", "claimant", id, null, "web");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete claimant" },
      { status: 500 }
    );
  }
}
