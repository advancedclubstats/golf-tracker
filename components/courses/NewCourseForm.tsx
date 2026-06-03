"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCourse } from "@/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewCourseForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const { id } = await createCourse(trimmed);
      router.push(`/courses/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create course.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New course name"
        className="h-10 text-base"
      />
      <Button
        type="submit"
        disabled={busy || !name.trim()}
        className="h-10 shrink-0"
      >
        Add course
      </Button>
    </form>
  );
}
