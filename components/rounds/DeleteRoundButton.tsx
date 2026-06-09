"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteRound } from "@/actions/rounds";

/**
 * Trash control for a round row. First tap reveals an inline Delete / Cancel
 * confirm (no modal) so a stray tap can't wipe a round. On confirm it calls the
 * deleteRound action; the shots cascade-delete in the DB. Lives in components/
 * and reaches the DB only through actions/ (layer boundary).
 */
export function DeleteRoundButton({ id, date }: { id: string; date: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteRound(id);
        toast.success(`Deleted round ${date}.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete round.");
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex shrink-0 items-center gap-1 pr-1">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="h-8 rounded-lg bg-destructive/10 px-3 text-xs font-bold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="h-8 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label={`Delete round ${date}`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2Icon className="size-4" />
    </button>
  );
}
