"use client";

import { useRouter } from "next/navigation";

interface TaskToggleProps {
  id: string;
  done: boolean;
}

export default function TaskToggle({ id, done }: TaskToggleProps) {
  const router = useRouter();

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: e.target.checked }),
    });
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <input
      type="checkbox"
      checked={done}
      onChange={handleChange}
      aria-label={done ? "Mark task open" : "Mark task done"}
    />
  );
}
