"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DocumentUploadProps {
  caseId: string;
}

export default function DocumentUpload({ caseId }: DocumentUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("case_id", caseId);
      if (expiryDate) formData.append("expiry_date", expiryDate);
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      setFile(null);
      setExpiryDate("");
      (e.currentTarget as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert">{error}</div>}
      <div className="form-row">
        <div>
          <label htmlFor="doc-file">File *</label>
          <input
            id="doc-file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>
        <div>
          <label htmlFor="doc-expiry">Expiry date</label>
          <input
            id="doc-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>
      </div>
      <button type="submit" className="btn" disabled={uploading || !file}>
        {uploading ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
