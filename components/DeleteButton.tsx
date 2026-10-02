"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteButtonProps {
  url: string;
  label: string;
  redirect?: string;
}

export default function DeleteButton({
  url,
  label,
  redirect,
}: DeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(url, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      if (redirect) {
        router.push(redirect);
      } else {
        router.refresh();
      }
    }
  }

  return (
    <button
      type="button"
      className="btn-danger"
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? "Deleting…" : `Delete ${label}`}
    </button>
  );
}
