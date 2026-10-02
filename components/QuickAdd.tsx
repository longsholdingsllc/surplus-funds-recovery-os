"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface QuickAddField {
  name: string;
  label: string;
  type: "text" | "date" | "textarea";
  required?: boolean;
}

interface QuickAddProps {
  endpoint: string;
  caseId: string;
  fields: QuickAddField[];
  submitLabel?: string;
}

export default function QuickAdd({
  endpoint,
  caseId,
  fields,
  submitLabel = "Add",
}: QuickAddProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, string> = { case_id: caseId };
      for (const f of fields) {
        const v = (values[f.name] ?? "").trim();
        if (f.required && !v) throw new Error(`${f.label} is required`);
        if (v) payload[f.name] = v;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }
      setValues({});
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      {error && <div className="alert">{error}</div>}
      <div className="form-row">
        {fields.map((f) => (
          <div key={f.name}>
            <label htmlFor={`qa-${endpoint}-${f.name}`}>
              {f.label}
              {f.required ? " *" : ""}
            </label>
            {f.type === "textarea" ? (
              <textarea
                id={`qa-${endpoint}-${f.name}`}
                value={values[f.name] ?? ""}
                onChange={(e) => setValue(f.name, e.target.value)}
                required={f.required}
              />
            ) : (
              <input
                id={`qa-${endpoint}-${f.name}`}
                type={f.type}
                value={values[f.name] ?? ""}
                onChange={(e) => setValue(f.name, e.target.value)}
                required={f.required}
              />
            )}
          </div>
        ))}
      </div>
      <button type="submit" className="btn" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
