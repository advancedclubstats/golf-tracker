"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShotForm, type ShotFormValues } from "@/components/shot-entry/ShotForm";
import { createShot } from "@/actions/shots";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** Per-hole progress, seeded from already-logged shots so entry can resume. */
export interface HoleLog {
  count: number; // highest shot number logged on the hole
  complete: boolean; // last shot was a Make
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

function formatVsPar(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
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
    holeNumbers.find((h) => !initialLogged[h]?.complete) ?? holeNumbers[0],
  );
  const [showSummary, setShowSummary] = useState(false);
  const [lastStrokes, setLastStrokes] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const courseParKnown = parByHole[hole] != null;
  const par = parByHole[hole] ?? localPar[hole] ?? null;
  const holeLog = logged[hole];
  const shotNo = (holeLog?.count ?? 0) + 1;
  // Par locks once the hole is known from the course or has a shot logged.
  const parLocked = courseParKnown || (holeLog?.count ?? 0) > 0;

  function goToHole(h: number) {
    setHole(h);
    setShowSummary(false);
  }

  function nextIncompleteHole(after: number): number | null {
    return (
      holeNumbers.find((h) => h > after && !logged[h]?.complete) ??
      holeNumbers.find((h) => !logged[h]?.complete) ??
      null
    );
  }

  async function handleShotSubmit(values: ShotFormValues) {
    // ShotForm guarantees club / par / result are present.
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

      const prev = logged[hole] ?? { count: 0, complete: false, penalties: 0 };
      const penalties = prev.penalties + values.penalty;
      const made = values.result === "Make";
      setLogged({
        ...logged,
        [hole]: { count: shotNo, complete: made, penalties },
      });

      if (made) {
        setLastStrokes(shotNo + penalties);
        setShowSummary(true);
      }
      // If not made, shotNo derives from the updated count and ShotForm remounts.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shot.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Hole summary view ──────────────────────────────────────────────────────

  if (showSummary) {
    const next = nextIncompleteHole(hole);
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 p-6 pt-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Hole {hole} complete
          </p>
          <p className="text-7xl font-bold leading-none">{lastStrokes}</p>
          {par !== null && (
            <p className="text-xl text-muted-foreground">
              Par {par} &nbsp;·&nbsp;{" "}
              <span
                className={cn(
                  "font-semibold",
                  lastStrokes < par
                    ? "text-green-600"
                    : lastStrokes > par
                    ? "text-destructive"
                    : "text-foreground",
                )}
              >
                {formatVsPar(lastStrokes, par)}
              </span>
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-3">
          {next !== null && (
            <Button
              onClick={() => goToHole(next)}
              className="h-14 w-full text-base font-semibold"
            >
              Hole {next} →
            </Button>
          )}
          <Button
            variant={next !== null ? "outline" : "default"}
            onClick={() => router.push(`/rounds/${roundId}`)}
            className="h-12 w-full text-sm"
          >
            Done
          </Button>
        </div>
      </div>
    );
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
        <span className="text-sm text-muted-foreground">Shot {shotNo}</span>
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
                onClick={() => goToHole(h)}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "h-9 w-9 shrink-0 rounded-lg text-sm font-medium tabular-nums transition-colors",
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : l?.complete
                    ? "bg-muted text-muted-foreground ring-1 ring-green-600/40"
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

      <Button
        variant="outline"
        onClick={() => router.push(`/rounds/${roundId}`)}
        className="h-11 w-full text-sm"
      >
        Done
      </Button>
    </div>
  );
}
