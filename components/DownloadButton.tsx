"use client";

import { useState } from "react";

interface DownloadButtonProps {
  id: string;
  label: string;
}

export default function DownloadButton({ id, label }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) return;
      const body = await res.json();
      if (body.url) window.open(body.url, "_blank");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Opening…" : label}
    </button>
  );
}
