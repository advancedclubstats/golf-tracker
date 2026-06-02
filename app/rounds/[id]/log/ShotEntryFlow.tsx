"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClubSelector } from "@/components/shot-entry/ClubSelector";
import { ExecutionButtons } from "@/components/shot-entry/ExecutionButtons";
import { ResultChips } from "@/components/shot-entry/ResultChips";
import { MissDirectionChips } from "@/components/shot-entry/MissDirectionChips";
import { YardageInput } from "@/components/shot-entry/YardageInput";
import { PuttExtras } from "@/components/shot-entry/PuttExtras";
import { createShot } from "@/actions/shots";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import {
  type Club,
  type SessionType,
  type Result,
  type MissDirection,
  type PuttSide,
  type PuttLength,
} from "@/lib/constants";
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

/** Results that automatically incur a penalty stroke. */
const PENALTY_RESULTS = new Set<Result>(["OB", "Hazard", "Lost", "Unplayable"]);

/** Results that warrant a miss-direction tag. */
const MISS_RESULTS = new Set<Result>(["Rough", "Bunker", "OB", "Hazard", "Lost", "Unplayable"]);

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

  // ── Hole state ──
  const [hole, setHole] = useState(1);
  const [par, setPar] = useState<3 | 4 | 5 | null>(null);
  const [shotNo, setShotNo] = useState(1);
  const [holePenalties, setHolePenalties] = useState(0);

  // ── UI state ──
  const [showSummary, setShowSummary] = useState(false);
  const [lastStrokes, setLastStrokes] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ── Current shot form state ──
  const [club, setClub] = useState<Club | null>(null);
  const [yardage, setYardage] = useState<number | null>(null);
  const [execution, setExecution] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [missDirection, setMissDirection] = useState<MissDirection | null>(null);
  const [puttSide, setPuttSide] = useState<PuttSide | null>(null);
  const [puttLength, setPuttLength] = useState<PuttLength | null>(null);
  const [mulligan, setMulligan] = useState(false);
  const [penalty, setPenalty] = useState(0);

  // ── Derived-state event handlers ──
  // These co-locate related state updates in the event handler rather than
  // using effects, avoiding cascading renders (react-hooks/set-state-in-effect).

  function handleResultChange(r: Result | null) {
    setResult(r);
    // Clear miss direction when result no longer implies a miss.
    if (!r || !MISS_RESULTS.has(r)) setMissDirection(null);
    // Auto-set penalty for OB / hazard; reset otherwise.
    setPenalty(r && PENALTY_RESULTS.has(r) ? 1 : 0);
  }

  function handleClubChange(c: Club) {
    setClub(c);
    // Clear putt extras when switching away from Putter.
    if (c !== "Putter") {
      setPuttSide(null);
      setPuttLength(null);
    }
  }

  // ── Shot helpers ──

  function resetShot() {
    setClub(null);
    setYardage(null);
    setExecution(null);
    setResult(null);
    setMissDirection(null);
    setPuttSide(null);
    setPuttLength(null);
    setMulligan(false);
    setPenalty(0);
    setValidationError(null);
  }

  function startNextHole() {
    setHole((h) => h + 1);
    setPar(null);
    setShotNo(1);
    setHolePenalties(0);
    setShowSummary(false);
    resetShot();
  }

  async function handleNextShot() {
    if (!club)           { setValidationError("Select a club.");             return; }
    if (par === null)    { setValidationError("Select par for this hole.");   return; }
    if (execution === null) { setValidationError("Select an execution rating."); return; }
    if (!result)         { setValidationError("Select a result.");            return; }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      await createShot({
        round_id:       roundId,
        hole,
        par,
        shot_no:        shotNo,
        club,
        yardage:        yardage ?? undefined,
        execution,
        result,
        miss_direction: missDirection ?? undefined,
        putt_side:      puttSide ?? undefined,
        putt_length:    puttLength ?? undefined,
        mulligan,
        penalty,
      });

      const totalPenalties = holePenalties + penalty;

      if (result === "Make") {
        setLastStrokes(shotNo + totalPenalties);
        setHolePenalties(totalPenalties);
        setShowSummary(true);
      } else {
        setHolePenalties(totalPenalties);
        setShotNo((n) => n + 1);
        resetShot();
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
      <div className="flex flex-col items-center gap-8 p-6 pt-12 max-w-lg mx-auto w-full">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
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
                    : "text-foreground"
                )}
              >
                {formatVsPar(lastStrokes, par)}
              </span>
            </p>
          )}
        </div>

        <div className="w-full flex flex-col gap-3">
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

  const showMissDirection = result !== null && MISS_RESULTS.has(result);
  const showPuttExtras = club === "Putter";
  const parLocked = shotNo > 1; // par is set on shot 1 and cannot change mid-hole

  return (
    <div className="flex flex-col gap-5 px-4 pb-10 pt-4 max-w-lg mx-auto w-full">

      {/* ── Header: hole / shot / par ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            Hole {hole}
            <span className="text-muted-foreground font-normal text-base">
              {" "}of {maxHoles}
            </span>
          </h2>
          <span className="text-sm text-muted-foreground">Shot {shotNo}</span>
        </div>

        {/* Par selector — shown until first shot on the hole is saved */}
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
                  "h-9 px-4 rounded-lg text-sm font-medium transition-colors",
                  par === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/70"
                )}
              >
                Par {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* ── Club ── */}
      <div className="flex flex-col gap-2">
        <Label>Club</Label>
        <ClubSelector value={club} onChange={handleClubChange} />
      </div>

      {/* ── Yardage ── */}
      <div className="flex flex-col gap-2">
        <Label>
          Yardage{" "}
          <span className="font-normal text-muted-foreground text-xs">
            (yards to target)
          </span>
        </Label>
        <YardageInput value={yardage} onChange={setYardage} />
      </div>

      {/* ── Execution ── */}
      <div className="flex flex-col gap-2">
        <Label>Execution</Label>
        <ExecutionButtons value={execution} onChange={setExecution} />
      </div>

      {/* ── Result ── */}
      <div className="flex flex-col gap-2">
        <Label>Result</Label>
        <ResultChips
          club={club}
          shotNo={shotNo}
          par={par}
          value={result}
          onChange={handleResultChange}
        />
      </div>

      {/* ── Miss direction (conditional) ── */}
      {showMissDirection && (
        <div className="flex flex-col gap-2">
          <Label>Miss direction</Label>
          <MissDirectionChips value={missDirection} onChange={setMissDirection} />
        </div>
      )}

      {/* ── Putt extras (conditional) ── */}
      {showPuttExtras && (
        <PuttExtras
          puttSide={puttSide}
          onPuttSideChange={setPuttSide}
          puttLength={puttLength}
          onPuttLengthChange={setPuttLength}
        />
      )}

      {/* ── Mulligan ── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <Label>Mulligan</Label>
          <p className="text-xs text-muted-foreground">I&apos;d take this one back</p>
        </div>
        <Toggle
          pressed={mulligan}
          onPressedChange={(p) => setMulligan(p)}
          variant="outline"
          className={cn(
            "h-10 px-4 text-sm font-medium",
            mulligan && "bg-primary text-primary-foreground border-primary"
          )}
        >
          {mulligan ? "Yes" : "No"}
        </Toggle>
      </div>

      {/* ── Penalty ── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <Label>Penalty strokes</Label>
          <p className="text-xs text-muted-foreground">Auto-set for OB / hazard</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Decrease penalty"
            onClick={() => setPenalty((p) => Math.max(0, p - 1))}
            className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center font-bold text-lg hover:bg-muted/70 transition-colors"
          >
            −
          </button>
          <span className="w-5 text-center font-semibold tabular-nums">
            {penalty}
          </span>
          <button
            type="button"
            aria-label="Increase penalty"
            onClick={() => setPenalty((p) => p + 1)}
            className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center font-bold text-lg hover:bg-muted/70 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* ── Validation error ── */}
      {validationError && (
        <p className="text-sm text-destructive font-medium">{validationError}</p>
      )}

      {/* ── Submit ── */}
      <Button
        onClick={handleNextShot}
        disabled={isSubmitting}
        className="h-14 w-full text-base font-semibold mt-1"
      >
        {isSubmitting
          ? "Saving…"
          : result === "Make"
          ? "Finish Hole →"
          : "Next Shot →"}
      </Button>

      {/* Finish early (available after hole 1 starts) */}
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
