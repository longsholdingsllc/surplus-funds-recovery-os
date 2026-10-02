export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { audit } from "@/lib/audit";

// Strip path components and replace unsafe characters so the filename is
// safe to embed in a storage key and to serve back later.
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return cleaned.replace(/^\.+/, "") || "file";
}

// GET /api/documents — list documents, optionally filtered by ?case_id=.
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const caseId = req.nextUrl.searchParams.get("case_id");
    let query = supabase.from("documents").select("*").order("uploaded_at", { ascending: false });
    if (caseId) query = query.eq("case_id", caseId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ documents: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list documents" },
      { status: 500 }
    );
  }
}

// POST /api/documents — multipart upload: file*, case_id*, expiry_date?
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    if (!supabase)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );

    const form = await req.formData();
    const file = form.get("file");
    const caseId = form.get("case_id");
    const expiryDate = form.get("expiry_date");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!caseId || typeof caseId !== "string") {
      return NextResponse.json({ error: "case_id is required" }, { status: 400 });
    }

    const filename = sanitizeFilename(file.name || "file");
    const storagePath = `${caseId}/${Date.now()}-${filename}`;

    const { error: uploadErr } = await supabase.storage
      .from("case-documents")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadErr) throw uploadErr;

    const { data, error } = await supabase
      .from("documents")
      .insert({
        case_id: caseId,
        file_name: filename,
        storage_path: storagePath,
        mime_type: file.type || null,
        expiry_date: expiryDate && typeof expiryDate === "string" ? expiryDate : null,
      })
      .select()
      .single();

    if (error) {
      // Roll back the orphaned object if the DB insert fails.
      await supabase.storage.from("case-documents").remove([storagePath]);
      throw error;
    }

    await audit(
      supabase,
      "document.upload",
      "document",
      data.id,
      `case_id=${caseId} file=${filename} size=${file.size}`,
      "web"
    );
    return NextResponse.json({ document: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload document" },
      { status: 500 }
    );
  }
}
