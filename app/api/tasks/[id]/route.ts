export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";

interface RouteParams {
  params: { id: string };
}

// PATCH /api/tasks/[id] — partial update of a task (e.g. toggle done).
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

    const allowed = ["title", "due_date", "done", "notes", "case_id"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116")
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      throw error;
    }

    await audit(
      supabase,
      "task.update",
      "task",
      id,
      `fields=${Object.keys(updates).join(",")}`,
      "web"
    );
    return NextResponse.json({ task: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] — delete a task.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const { id } = params;

    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;

    await audit(supabase, "task.delete", "task", id, null, "web");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete task" },
      { status: 500 }
    );
  }
}
