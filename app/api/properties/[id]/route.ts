export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";

interface RouteParams {
  params: { id: string };
}

// PATCH /api/properties/[id] — partial update of a property.
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

    const allowed = ["case_id", "parcel_id", "address", "county", "state", "tax_sale_date", "notes"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("properties")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116")
        return NextResponse.json({ error: "Property not found" }, { status: 404 });
      throw error;
    }

    await audit(
      supabase,
      "property.update",
      "property",
      id,
      `fields=${Object.keys(updates).join(",")}`,
      "web"
    );
    return NextResponse.json({ property: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update property" },
      { status: 500 }
    );
  }
}

// DELETE /api/properties/[id] — delete a property.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const { id } = params;

    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) throw error;

    await audit(supabase, "property.delete", "property", id, null, "web");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete property" },
      { status: 500 }
    );
  }
}
