"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShotForm, type ShotFormValues } from "@/components/shot-entry/ShotForm";
import { createShot } from "@/actions/shots";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type SessionType } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMaxHoles(sessionType: SessionType): number {
  switch (sessionType) {
    case "Full18":    return 18;
    case "Practice9": return 9;
    case "Practice6": return 6;
    case "Practice3": return 3;
  }
}

function formatVsPar(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShotEntryFlowProps {
  roundId: string;
  sessionType: SessionType;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ShotEntryFlow({ roundId, sessionType }: ShotEntryFlowProps) {
  const router = useRouter();
  const maxHoles = getMaxHoles(sessionType);

  // ── Hole / progression state (the field state lives in ShotForm) ──
  const [hole, setHole] = useState(1);
  const [par, setPar] = useState<3 | 4 | 5 | null>(null);
  const [shotNo, setShotNo] = useState(1);
  const [holePenalties, setHolePenalties] = useState(0);

  // ── UI state ──
  const [showSummary, setShowSummary] = useState(false);
  const [lastStrokes, setLastStrokes] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function startNextHole() {
    setHole((h) => h + 1);
    setPar(null);
    setShotNo(1);
    setHolePenalties(0);
    setShowSummary(false);
  }

  async function handleShotSubmit(values: ShotFormValues) {
    // ShotForm guarantees club / par / result (and execution) are present.
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

      const totalPenalties = holePenalties + values.penalty;
      if (values.result === "Make") {
        setLastStrokes(shotNo + totalPenalties);
        setHolePenalties(totalPenalties);
        setShowSummary(true);
      } else {
        setHolePenalties(totalPenalties);
        setShotNo((n) => n + 1);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shot.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Hole summary view ──────────────────────────────────────────────────────

  if (showSummary) {
    const isLastHole = hole === maxHoles;

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
          {isLastHole ? (
            <Button
              onClick={() => router.push(`/rounds/${roundId}`)}
              className="h-14 w-full text-base font-semibold"
            >
              Finish Round →
            </Button>
          ) : (
            <Button
              onClick={startNextHole}
              className="h-14 w-full text-base font-semibold"
            >
              Hole {hole + 1} →
            </Button>
          )}

          {!isLastHole && (
            <Button
              variant="outline"
              onClick={() => router.push(`/rounds/${roundId}`)}
              className="h-12 w-full text-sm"
            >
              Finish Early
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Shot entry view ────────────────────────────────────────────────────────

  const parLocked = shotNo > 1; // par is set on shot 1 and cannot change mid-hole

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-10 pt-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            Hole {hole}
            <span className="text-base font-normal text-muted-foreground">
              {" "}of {maxHoles}
            </span>
          </h2>
          <span className="text-sm text-muted-foreground">Shot {shotNo}</span>
        </div>

        {parLocked ? (
          <p className="text-sm text-muted-foreground">Par {par}</p>
        ) : (
          <div className="flex gap-2">
            {([3, 4, 5] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPar(p)}
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
        )}
      </div>

      <Separator />

      <ShotForm
        key={`${hole}-${shotNo}`}
        par={par}
        shotNo={shotNo}
        busy={isSubmitting}
        submitLabel={(v) => (v.result === "Make" ? "Finish Hole →" : "Next Shot →")}
        onSubmit={handleShotSubmit}
      />

      {hole > 1 && (
        <Button
          variant="outline"
          onClick={() => router.push(`/rounds/${roundId}`)}
          className="h-11 w-full text-sm"
        >
          Finish Early
        </Button>
      )}
    </div>
  );
}
