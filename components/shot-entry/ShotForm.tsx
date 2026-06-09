"use client";

import { useState, type ReactNode } from "react";
import { ClubSelector } from "@/components/shot-entry/ClubSelector";
import { ExecutionButtons } from "@/components/shot-entry/ExecutionButtons";
import { ResultChips } from "@/components/shot-entry/ResultChips";
import { MissDirectionChips } from "@/components/shot-entry/MissDirectionChips";
import { YardageInput } from "@/components/shot-entry/YardageInput";
import { PuttExtras } from "@/components/shot-entry/PuttExtras";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DECISION_QUALITIES,
  type Result,
  type MissDirection,
  type PuttSide,
  type PuttLength,
  type DecisionQuality,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

/** The descriptive fields of a single shot (no hole/par/shot_no). */
export interface ShotFormValues {
  club: string | null;
  yardage: number | null;
  execution: number | null;
  result: Result | null;
  missDirection: MissDirection | null;
  puttSide: PuttSide | null;
  puttLength: PuttLength | null;
  penalty: number;
  decisionQuality: DecisionQuality;
}

/** Results that automatically incur a penalty stroke. */
const PENALTY_RESULTS = new Set<Result>(["OB", "Hazard", "Lost", "Unplayable"]);

/** Results that warrant a miss-direction tag. */
const MISS_RESULTS = new Set<Result>([
  "Rough",
  "Bunker",
  "OB",
  "Hazard",
  "Lost",
  "Unplayable",
]);

interface ShotFormProps {
  /** The user's club bag, in order (from the Setup page). */
  clubs: string[];
  /** Hole par — context for the result chips and validation. */
  par: number | null;
  /** Shot number — context (e.g. tee-shot logic in the result chips). */
  shotNo: number;
  /** Prefilled values (edit mode). Omitted fields start empty. */
  initial?: Partial<ShotFormValues>;
  /** Require an execution rating before submit (true for new shots). */
  requireExecution?: boolean;
  /** Disable the form while a submit is in flight. */
  busy?: boolean;
  /** Submit button label, derived from the current values. */
  submitLabel: (values: ShotFormValues) => string;
  /** Called with validated values (club/par/result guaranteed present). */
  onSubmit: (values: ShotFormValues) => void;
  /** Optional extra control rendered under the submit button (e.g. Delete). */
  secondaryAction?: ReactNode;
}

/**
 * The shot field form: club, yardage, execution, result, conditional miss
 * direction / putt extras, penalty. Owns the field state and the
 * conditional rules (penalty auto-set, miss/putt visibility). Shared by the
 * new-shot entry flow and the edit sheet so those rules live in one place.
 */
export function ShotForm({
  clubs,
  par,
  shotNo,
  initial,
  requireExecution = true,
  busy = false,
  submitLabel,
  onSubmit,
  secondaryAction,
}: ShotFormProps) {
  const [club, setClub] = useState<string | null>(initial?.club ?? null);
  const [yardage, setYardage] = useState<number | null>(initial?.yardage ?? null);
  const [execution, setExecution] = useState<number | null>(initial?.execution ?? null);
  const [result, setResult] = useState<Result | null>(initial?.result ?? null);
  const [missDirection, setMissDirection] = useState<MissDirection | null>(
    initial?.missDirection ?? null,
  );
  const [puttSide, setPuttSide] = useState<PuttSide | null>(initial?.puttSide ?? null);
  const [puttLength, setPuttLength] = useState<PuttLength | null>(
    initial?.puttLength ?? null,
  );
  const [penalty, setPenalty] = useState<number>(initial?.penalty ?? 0);
  const [decisionQuality, setDecisionQuality] = useState<DecisionQuality>(
    initial?.decisionQuality ?? "Good",
  );
  const [error, setError] = useState<string | null>(null);

  function handleResultChange(r: Result | null) {
    setResult(r);
    // Clear miss direction when the result no longer implies a miss.
    if (!r || !MISS_RESULTS.has(r)) setMissDirection(null);
    // Auto-set penalty for OB / hazard; reset otherwise.
    setPenalty(r && PENALTY_RESULTS.has(r) ? 1 : 0);
  }

  function handleClubChange(c: string) {
    setClub(c);
    if (c !== "Putter") {
      setPuttSide(null);
      setPuttLength(null);
    }
  }

  const values: ShotFormValues = {
    club,
    yardage,
    execution,
    result,
    missDirection,
    puttSide,
    puttLength,
    penalty,
    decisionQuality,
  };

  function handleSubmit() {
    if (!club) return setError("Select a club.");
    if (par === null) return setError("Select par for this hole.");
    if (requireExecution && execution === null)
      return setError("Select an execution rating.");
    if (!result) return setError("Select a result.");
    setError(null);
    onSubmit(values);
  }

  const showMissDirection = result !== null && MISS_RESULTS.has(result);
  const showPuttExtras = club === "Putter";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Club</Label>
        <ClubSelector clubs={clubs} value={club} onChange={handleClubChange} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>
          Yardage{" "}
          <span className="text-xs font-normal text-muted-foreground">
            (yards to target)
          </span>
        </Label>
        <YardageInput value={yardage} onChange={setYardage} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Execution</Label>
        <ExecutionButtons value={execution} onChange={setExecution} />
      </div>

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

      {showMissDirection && (
        <div className="flex flex-col gap-2">
          <Label>Miss direction</Label>
          <MissDirectionChips value={missDirection} onChange={setMissDirection} />
        </div>
      )}

      {showPuttExtras && (
        <PuttExtras
          puttSide={puttSide}
          onPuttSideChange={setPuttSide}
          puttLength={puttLength}
          onPuttLengthChange={setPuttLength}
        />
      )}

      {/* Decision quality (spec 1A): one tap, default Good. */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <Label>Decision</Label>
          <p className="text-xs text-muted-foreground">
            Bad = a thinking mistake, not a bad bounce
          </p>
        </div>
        <div className="flex gap-1.5">
          {DECISION_QUALITIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDecisionQuality(d)}
              className={cn(
                "h-9 rounded-xl border-2 px-4 text-sm font-bold transition-colors",
                decisionQuality === d
                  ? d === "Bad"
                    ? "border-chart-3 bg-chart-3 text-white"
                    : "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

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
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg font-bold transition-colors hover:bg-muted/70"
          >
            −
          </button>
          <span className="w-5 text-center font-semibold tabular-nums">{penalty}</span>
          <button
            type="button"
            aria-label="Increase penalty"
            onClick={() => setPenalty((p) => p + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg font-bold transition-colors hover:bg-muted/70"
          >
            +
          </button>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={busy}
        className="mt-1 h-14 w-full text-base font-semibold"
      >
        {busy ? "Saving…" : submitLabel(values)}
      </Button>

      {secondaryAction}
    </div>
  );
}
