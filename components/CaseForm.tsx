"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  "new",
  "lead",
  "verifying",
  "outreach",
  "pending",
  "closed",
  "recovered",
  "cancelled",
];

export default function CaseForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("new");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("");
  const [surplusAmount, setSurplusAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          status,
          county: county.trim() || undefined,
          state: state.trim() || undefined,
          surplus_amount:
            surplusAmount.trim() === "" ? undefined : Number(surplusAmount),
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create case");
      }
      setTitle("");
      setStatus("new");
      setCounty("");
      setState("");
      setSurplusAmount("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert">{error}</div>}
      <div className="form-row">
        <div>
          <label htmlFor="case-title">Title *</label>
          <input
            id="case-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="case-status">Status</label>
          <select
            id="case-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="case-county">County</label>
          <input
            id="case-county"
            type="text"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="case-state">State</label>
          <input
            id="case-state"
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="case-surplus">Surplus amount (USD)</label>
          <input
            id="case-surplus"
            type="number"
            min="0"
            step="0.01"
            value={surplusAmount}
            onChange={(e) => setSurplusAmount(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor="case-notes">Notes</label>
        <textarea
          id="case-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <button type="submit" className="btn" disabled={saving}>
        {saving ? "Creating…" : "Create case"}
      </button>
    </form>
  );
}
