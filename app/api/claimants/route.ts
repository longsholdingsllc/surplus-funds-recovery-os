export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";

// GET /api/claimants — list claimants, optionally filtered by ?case_id=.
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const caseId = req.nextUrl.searchParams.get("case_id");
    let query = supabase.from("claimants").select("*").order("created_at", { ascending: false });
    if (caseId) query = query.eq("case_id", caseId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ claimants: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list claimants" },
      { status: 500 }
    );
  }
}

// POST /api/claimants — create a claimant on a case.
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const body = await req.json();
    const { full_name, case_id, contact_info, id_expiry_date, notes } = body;

    if (!full_name || typeof full_name !== "string" || !full_name.trim()) {
      return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    }
    if (!case_id) {
      return NextResponse.json({ error: "case_id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("claimants")
      .insert({
        case_id,
        full_name: full_name.trim(),
        contact_info: contact_info ?? null,
        id_expiry_date: id_expiry_date ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    await audit(
      supabase,
      "claimant.create",
      "claimant",
      data.id,
      `case_id=${case_id} full_name=${data.full_name}`,
      "web"
    );
    return NextResponse.json({ claimant: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create claimant" },
      { status: 500 }
    );
  }
}
