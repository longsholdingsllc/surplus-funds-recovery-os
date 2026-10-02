export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";

// GET /api/tasks — list tasks; ?case_id= to filter, ?open=true for only open tasks.
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const searchParams = req.nextUrl.searchParams;
    const caseId = searchParams.get("case_id");
    const openOnly = searchParams.get("open") === "true";

    // due_date nulls last via ascending with nullsFirst:false
    let query = supabase
      .from("tasks")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false });

    if (caseId) query = query.eq("case_id", caseId);
    if (openOnly) query = query.eq("done", false);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ tasks: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list tasks" },
      { status: 500 }
    );
  }
}

// POST /api/tasks — create a task (optionally tied to a case).
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const body = await req.json();
    const { case_id, title, due_date, done, notes } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        case_id: case_id ?? null,
        title: title.trim(),
        due_date: due_date ?? null,
        done: done ?? false,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    await audit(
      supabase,
      "task.create",
      "task",
      data.id,
      `case_id=${data.case_id ?? "none"} title=${data.title}`,
      "web"
    );
    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 500 }
    );
  }
}
