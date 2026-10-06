export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { qualifyLead } from "@/lib/lead-qualifier";

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

// POST /api/cases — create a new case and score it with the live Lead Qualifier.
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

    // Score the case/lead with the live AI agent
    const qualification = await qualifyLead({
      name: title.trim(),
      company: county ? `${county}, ${state || ""}`.trim() : undefined,
      message: notes || `New case: ${title}. Status: ${status || "new"}. Surplus: ${surplus_amount || "n/a"}`,
      timeline: status === "lead" || status === "new" ? "this quarter" : undefined,
    });

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
        // Store qualification results if the table supports extra columns;
        // otherwise they remain available in the response for the UI.
        score: qualification.score ?? null,
        recommended_action: qualification.recommended_action ?? null,
        qualification_summary: qualification.summary ?? null,
      })
      .select()
      .single();

    if (error) {
      // If columns do not exist yet, fall back to insert without them
      if (error.message?.includes("column") || error.code === "PGRST204") {
        const { data: fallbackData, error: fallbackError } = await supabase
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

        if (fallbackError) throw fallbackError;

        await audit(supabase, "case.create", "case", fallbackData.id, `title=${fallbackData.title}`, "web");
        return NextResponse.json(
          {
            case: fallbackData,
            qualification, // still return the score even if not persisted
          },
          { status: 201 }
        );
      }
      throw error;
    }

    await audit(supabase, "case.create", "case", data.id, `title=${data.title}`, "web");
    return NextResponse.json({ case: data, qualification }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create case" },
      { status: 500 }
    );
  }
}
