export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";

// GET /api/properties — list properties, optionally filtered by ?case_id=.
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const caseId = req.nextUrl.searchParams.get("case_id");
    let query = supabase.from("properties").select("*").order("created_at", { ascending: false });
    if (caseId) query = query.eq("case_id", caseId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ properties: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list properties" },
      { status: 500 }
    );
  }
}

// POST /api/properties — create a property on a case.
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const body = await req.json();
    const { case_id, parcel_id, address, county, state, tax_sale_date, notes } = body;

    if (!case_id) {
      return NextResponse.json({ error: "case_id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("properties")
      .insert({
        case_id,
        parcel_id: parcel_id ?? null,
        address: address ?? null,
        county: county ?? null,
        state: state ?? null,
        tax_sale_date: tax_sale_date ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    await audit(
      supabase,
      "property.create",
      "property",
      data.id,
      `case_id=${case_id} parcel_id=${data.parcel_id ?? "n/a"}`,
      "web"
    );
    return NextResponse.json({ property: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create property" },
      { status: 500 }
    );
  }
}
