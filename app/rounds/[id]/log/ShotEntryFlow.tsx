"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShotForm, type ShotFormValues } from "@/components/shot-entry/ShotForm";
import { createShot, concedeHole } from "@/actions/shots";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** Per-hole progress, seeded from already-logged shots so entry can resume. */
export interface HoleLog {
  count: number; // highest shot number logged on the hole
  complete: boolean; // last shot was a Make
  conceded: boolean; // hole was picked up / conceded
  penalties: number; // total penalty strokes on the hole
}

interface ShotEntryFlowProps {
  roundId: string;
  /** Known par per hole (from the course, or from already-logged shots). */
  parByHole: Record<number, number>;
  /** Selectable holes, ascending. */
  holeNumbers: number[];
  initialLogged: Record<number, HoleLog>;
}

function formatDiff(diff: number): string {
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

/** A hole is "done" for navigation once it's completed (Make) or picked up. */
function holeDone(logged: Record<number, HoleLog>, h: number): boolean {
  return Boolean(logged[h]?.complete || logged[h]?.conceded);
}

/** Running round score over *completed* holes (conceded holes have no score). */
function roundScore(
  logged: Record<number, HoleLog>,
  parByHole: Record<number, number>,
  localPar: Record<number, number>,
): { vsPar: number; holes: number } {
  let strokes = 0;
  let par = 0;
  let holes = 0;
  for (const [h, l] of Object.entries(logged)) {
    if (!l.complete) continue;
    const p = parByHole[Number(h)] ?? localPar[Number(h)];
    if (p == null) continue;
    strokes += l.count + l.penalties;
    par += p;
    holes += 1;
  }
  return { vsPar: strokes - par, holes };
}

export function ShotEntryFlow({
  roundId,
  parByHole,
  holeNumbers,
  initialLogged,
}: ShotEntryFlowProps) {
  const router = useRouter();

  const [logged, setLogged] = useState<Record<number, HoleLog>>(initialLogged);
  const [localPar, setLocalPar] = useState<Record<number, number>>({});
  const [hole, setHole] = useState<number>(
    holeNumbers.find((h) => !holeDone(initialLogged, h)) ?? holeNumbers[0],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous re-entry guard: `isSubmitting` flips the button to disabled only
  // on the next render, so a same-tick double-tap can fire two submits before
  // then. The ref blocks the second one immediately.
  const submitting = useRef(false);

  const courseParKnown = parByHole[hole] != null;
  const par = parByHole[hole] ?? localPar[hole] ?? null;
  const holeLog = logged[hole];
  const shotNo = (holeLog?.count ?? 0) + 1;
  // Par locks once the hole is known from the course or has a shot logged.
  const parLocked = courseParKnown || (holeLog?.count ?? 0) > 0;
  const { vsPar, holes: holesPlayed } = roundScore(logged, parByHole, localPar);

  function nextUnfinishedHole(
    map: Record<number, HoleLog>,
    after: number,
  ): number | null {
    return (
      holeNumbers.find((h) => h > after && !holeDone(map, h)) ??
      holeNumbers.find((h) => !holeDone(map, h)) ??
      null
    );
  }

  async function handlePickUp() {
    const prev = logged[hole];
    if (!prev || prev.count === 0) return; // need at least one logged shot
    if (submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      await concedeHole(roundId, hole);
      const next = { ...logged, [hole]: { ...prev, conceded: true } };
      setLogged(next);
      const target = nextUnfinishedHole(next, hole);
      if (target !== null) {
        setHole(target);
      } else {
        router.push(`/rounds/${roundId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pick up hole.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleShotSubmit(values: ShotFormValues) {
    // ShotForm guarantees club / par / result are present.
    if (submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      await createShot({
        round_id: roundId,
        hole,
        par: par!,
        shot_no: shotNo,
        club: values.club!,
        yardage: values.yardage ?? undefined,
        execution: values.execution!,
        result: values.result!,
        miss_direction: values.missDirection ?? undefined,
        putt_side: values.puttSide ?? undefined,
        putt_length: values.puttLength ?? undefined,
        mulligan: values.mulligan,
        penalty: values.penalty,
      });

      const prev =
        logged[hole] ?? { count: 0, complete: false, conceded: false, penalties: 0 };
      const penalties = prev.penalties + values.penalty;
      const made = values.result === "Make";
      const nextMap = {
        ...logged,
        [hole]: { count: shotNo, complete: made, conceded: prev.conceded, penalties },
      };
      setLogged(nextMap);

      if (made) {
        // Brief per-hole feedback, then auto-advance — no confirmation screen.
        const strokes = shotNo + penalties;
        if (par !== null) {
          toast.success(`Hole ${hole}: ${strokes} (${formatDiff(strokes - par)})`);
        }
        const target = nextUnfinishedHole(nextMap, hole);
        if (target !== null) {
          setHole(target);
        } else {
          router.push(`/rounds/${roundId}`);
        }
      }
      // If not made, shotNo derives from the updated count and ShotForm remounts.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shot.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  // ── Shot entry view ────────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-10 pt-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          Hole {hole}
          {par !== null && (
            <span className="text-base font-normal text-muted-foreground">
              {" "}· par {par}
            </span>
          )}
        </h2>
        <div className="flex items-baseline gap-3 text-sm text-muted-foreground">
          {holesPlayed > 0 && (
            <span className="tabular-nums">
              <span
                className={cn(
                  "font-semibold",
                  vsPar < 0
                    ? "text-green-600"
                    : vsPar > 0
                    ? "text-destructive"
                    : "text-foreground",
                )}
              >
                {formatDiff(vsPar)}
              </span>
              <span className="text-xs"> thru {holesPlayed}</span>
            </span>
          )}
          <span>Shot {shotNo}</span>
        </div>
      </div>

      {/* Hole selector — jump to any hole, resume where you left off */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-1.5">
          {holeNumbers.map((h) => {
            const l = logged[h];
            const isCurrent = h === hole;
            return (
              <button
                key={h}
                type="button"
                onClick={() => setHole(h)}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "h-9 w-9 shrink-0 rounded-lg text-sm font-medium tabular-nums transition-colors",
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : l?.complete
                    ? "bg-muted text-muted-foreground ring-1 ring-green-600/40"
                    : l?.conceded
                    ? "bg-muted text-muted-foreground line-through ring-1 ring-foreground/25"
                    : l?.count
                    ? "bg-muted text-foreground ring-1 ring-foreground/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted",
                )}
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Par: known (course / prior shots) → shown; otherwise pick it once */}
      {!parLocked && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Par</span>
          <div className="flex gap-2">
            {([3, 4, 5] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setLocalPar({ ...localPar, [hole]: p })}
                className={cn(
                  "h-9 rounded-lg px-4 text-sm font-medium transition-colors",
                  par === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/70",
                )}
              >
                Par {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <ShotForm
        key={`${hole}-${shotNo}`}
        par={par}
        shotNo={shotNo}
        busy={isSubmitting}
        submitLabel={(v) => (v.result === "Make" ? "Finish Hole →" : "Next Shot →")}
        onSubmit={handleShotSubmit}
      />

      {(logged[hole]?.count ?? 0) > 0 &&
        !logged[hole]?.complete &&
        !logged[hole]?.conceded && (
          <Button
            variant="outline"
            onClick={handlePickUp}
            disabled={isSubmitting}
            className="h-11 w-full text-sm"
          >
            Pick up hole →
          </Button>
        )}

      <Button
        variant="ghost"
        onClick={() => router.push(`/rounds/${roundId}`)}
        className="h-11 w-full text-sm"
      >
        Done
      </Button>
    </div>
  );
}
