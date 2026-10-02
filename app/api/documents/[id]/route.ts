export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";

interface RouteParams {
  params: { id: string };
}

// GET /api/documents/[id] — mint a short-lived signed download URL.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const { id } = params;

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, storage_path, file_name")
      .eq("id", id)
      .single();

    if (docErr) {
      if (docErr.code === "PGRST116")
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      throw docErr;
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("case-documents")
      .createSignedUrl(doc.storage_path, 60); // 60-second download window

    if (signErr || !signed) throw signErr ?? new Error("Failed to sign URL");

    await audit(
      supabase,
      "document.download",
      "document",
      id,
      `file=${doc.file_name}`,
      "web"
    );
    return NextResponse.json({ url: signed.signedUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sign document URL" },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id] — remove the storage object and the DB row.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const { id } = params;

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("storage_path, file_name")
      .eq("id", id)
      .single();

    if (docErr) {
      if (docErr.code === "PGRST116")
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      throw docErr;
    }

    // Remove the storage object first so we don't orphan files.
    const { error: removeErr } = await supabase.storage
      .from("case-documents")
      .remove([doc.storage_path]);
    if (removeErr) throw removeErr;

    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw error;

    await audit(
      supabase,
      "document.delete",
      "document",
      id,
      `file=${doc.file_name}`,
      "web"
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete document" },
      { status: 500 }
    );
  }
}
