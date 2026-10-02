export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";

interface RouteParams {
  params: { id: string };
}

// GET /api/cases/[id] — case plus all related records.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const { id } = params;

    const [{ data: caseRow, error: caseErr }, { data: claimants, error: claimantsErr },
      { data: properties, error: propertiesErr }, { data: tasks, error: tasksErr },
      { data: documents, error: documentsErr }] = await Promise.all([
      supabase.from("cases").select("*").eq("id", id).single(),
      supabase.from("claimants").select("*").eq("case_id", id),
      supabase.from("properties").select("*").eq("case_id", id),
      supabase.from("tasks").select("*").eq("case_id", id).order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("documents").select("*").eq("case_id", id),
    ]);

    if (caseErr) {
      if (caseErr.code === "PGRST116")
        return NextResponse.json({ error: "Case not found" }, { status: 404 });
      throw caseErr;
    }
    if (claimantsErr) throw claimantsErr;
    if (propertiesErr) throw propertiesErr;
    if (tasksErr) throw tasksErr;
    if (documentsErr) throw documentsErr;

    return NextResponse.json({
      case: caseRow,
      claimants: claimants ?? [],
      properties: properties ?? [],
      tasks: tasks ?? [],
      documents: documents ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch case" },
      { status: 500 }
    );
  }
}

// PATCH /api/cases/[id] — partial update of a case.
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

    // Whitelist updatable fields.
    const allowed = ["title", "status", "county", "state", "surplus_amount", "notes", "source"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("cases")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116")
        return NextResponse.json({ error: "Case not found" }, { status: 404 });
      throw error;
    }

    await audit(
      supabase,
      "case.update",
      "case",
      id,
      `fields=${Object.keys(updates).join(",")}`,
      "web"
    );
    return NextResponse.json({ case: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update case" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id] — delete a case (and its related rows via FK cascades).
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const { id } = params;

    const { error } = await supabase.from("cases").delete().eq("id", id);
    if (error) throw error;

    await audit(supabase, "case.delete", "case", id, null, "web");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete case" },
      { status: 500 }
    );
  }
}
