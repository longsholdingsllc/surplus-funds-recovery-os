export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";

// GET /api/cases — list all cases, most recently updated first.
export async function GET() {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ cases: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list cases" },
      { status: 500 }
    );
  }
}

// POST /api/cases — create a new case.
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const body = await req.json();
    const { title, status, county, state, surplus_amount, notes, source } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("cases")
      .insert({
        title: title.trim(),
        status: status ?? "new",
        county: county ?? null,
        state: state ?? null,
        surplus_amount: surplus_amount ?? null,
        notes: notes ?? null,
        source: source ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    await audit(supabase, "case.create", "case", data.id, `title=${data.title}`, "web");
    return NextResponse.json({ case: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create case" },
      { status: 500 }
    );
  }
}
