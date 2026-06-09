"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ShotForm, type ShotFormValues } from "@/components/shot-entry/ShotForm";
import { updateShot, deleteShot, insertShot } from "@/actions/shots";
import type { ShotRow } from "@/lib/schemas/shot";

/** Where to drop a new shot in: the hole, its par, and the target shot number. */
export interface InsertTarget {
  hole: number;
  par: number;
  shotNo: number;
}

interface EditShotSheetProps {
  /** The shot being edited (edit mode), or null. */
  shot: ShotRow | null;
  /** A position to insert a new shot at (insert mode), or null. */
  insertAt: InsertTarget | null;
  roundId: string;
  /** The user's club bag (from the Setup page). */
  clubs: string[];
  onClose: () => void;
}

export function EditShotSheet({
  shot,
  insertAt,
  roundId,
  clubs,
  onClose,
}: EditShotSheetProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const open = shot !== null || insertAt !== null;

  // Keep a shot's own club selectable even if it's since been removed from the
  // bag (so old shots stay editable without their club vanishing).
  const formClubs =
    shot && shot.club && !clubs.includes(shot.club) ? [...clubs, shot.club] : clubs;

  async function handleSave(values: ShotFormValues) {
    if (!shot) return;
    setBusy(true);
    try {
      await updateShot(shot.id, roundId, {
        club: values.club!,
        yardage: values.yardage,
        execution: values.execution,
        result: values.result,
        miss_direction: values.missDirection,
        putt_side: values.puttSide,
        putt_length: values.puttLength,
        penalty: values.penalty,
      });
      toast.success("Shot updated.");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update shot.");
    } finally {
      setBusy(false);
    }
  }

  async function handleInsert(values: ShotFormValues) {
    if (!insertAt) return;
    setBusy(true);
    try {
      await insertShot({
        round_id: roundId,
        hole: insertAt.hole,
        par: insertAt.par,
        shot_no: insertAt.shotNo,
        club: values.club!,
        yardage: values.yardage ?? undefined,
        execution: values.execution ?? undefined,
        result: values.result ?? undefined,
        miss_direction: values.missDirection ?? undefined,
        putt_side: values.puttSide ?? undefined,
        putt_length: values.puttLength ?? undefined,
        penalty: values.penalty,
      });
      toast.success("Shot inserted.");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to insert shot.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!shot) return;
    if (
      !window.confirm(
        "Delete this shot? The remaining shots on this hole will be renumbered.",
      )
    )
      return;
    setBusy(true);
    try {
      await deleteShot(shot.id, roundId);
      toast.success("Shot deleted.");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete shot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        {shot && (
          <>
            <SheetHeader>
              <SheetTitle>
                Edit shot · Hole {shot.hole}, shot {shot.shot_no}
              </SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <ShotForm
                key={shot.id}
                clubs={formClubs}
                par={shot.par}
                shotNo={shot.shot_no}
                requireExecution={false}
                busy={busy}
                submitLabel={() => "Save changes"}
                onSubmit={handleSave}
                initial={{
                  club: shot.club,
                  yardage: shot.yardage,
                  execution: shot.execution,
                  result: shot.result,
                  missDirection: shot.miss_direction,
                  puttSide: shot.putt_side,
                  puttLength: shot.putt_length,
                  penalty: shot.penalty,
                }}
                secondaryAction={
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={busy}
                    className="h-11 w-full"
                  >
                    Delete shot
                  </Button>
                }
              />
            </div>
          </>
        )}

        {!shot && insertAt && (
          <>
            <SheetHeader>
              <SheetTitle>
                Insert shot · Hole {insertAt.hole}, position {insertAt.shotNo}
              </SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <ShotForm
                key={`insert-${insertAt.hole}-${insertAt.shotNo}`}
                clubs={clubs}
                par={insertAt.par}
                shotNo={insertAt.shotNo}
                busy={busy}
                submitLabel={() => "Add shot"}
                onSubmit={handleInsert}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
