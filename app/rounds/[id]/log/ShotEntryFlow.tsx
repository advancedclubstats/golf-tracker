"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveShot, editShot, pickUpHole } from "@/lib/shots/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ShotForm, type ShotFormValues } from "@/components/shot-entry/ShotForm";
import {
  RESULTS,
  MISS_DIRECTIONS,
  PUTT_SIDES,
  PUTT_LENGTHS,
  START_LIES,
  SITUATIONS,
  DECISION_QUALITIES,
  type Result,
  type MissDirection,
  type PuttSide,
  type PuttLength,
  type StartLie,
  type Situation,
  type DecisionQuality,
} from "@/lib/constants";
import { nextStartLie, type PrevFinish } from "@/lib/shots/lie";
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
  /** The user's club bag, in order (from the Setup page). */
  clubs: string[];
  /** Known par per hole (from the course, or from already-logged shots). */
  parByHole: Record<number, number>;
  /** Selectable holes, ascending. */
  holeNumbers: number[];
  initialLogged: Record<number, HoleLog>;
  /** Last logged shot per hole, to seed the start-lie carry-forward on resume. */
  lastShotByHole: Record<number, PrevFinish | null>;
}

/** Results that auto-incur a penalty stroke (matches ShotForm / SPEC). */
const PENALTY_RESULTS = new Set<Result>(["OB", "Hazard", "Lost", "Unplayable"]);
/** Stroke-and-distance penalties: you replay from the same spot (same lie, same
 *  distance), so the next shot is a do-over — skip the "what did it leave you?"
 *  step (nothing changed) and carry the lie forward unchanged. */
const STROKE_AND_DISTANCE = new Set<Result>(["OB", "Lost"]);
/** Results that warrant a miss-direction tag. */
const MISS_RESULTS = new Set<Result>([
  "Rough",
  "Bunker",
  "Recovery",
  "OB",
  "Hazard",
  "Lost",
  "Unplayable",
]);
/** Start lies that are around the green (drive the short-sided prompt). */
const GREENSIDE_LIES = new Set<StartLie>(["Greenside bunker", "Fringe", "Sand"]);
/** Lies offered in the override picker (Tee is auto for shot 1; Green = putt). */
const OVERRIDE_LIES = START_LIES.filter((l) => l !== "Green");
/** Clubs that, off the tee on a par 4/5, skip the yardage step. */
const TEE_NO_YARDAGE = new Set<string>(["D", "3W", "5W"]);

/** Putts are entered in feet (stored canonically as yards = feet / 3). Feet
 *  gives 1-ft resolution where the expected-strokes curve is steepest — the
 *  3–8 ft range — which buckets threw away. */
const puttYardsFromFeet = (feet: string): number | undefined =>
  feet === "" ? undefined : Number(feet) / 3;

const EXEC_LABELS = ["Bad", "Okay", "Good", "Great"];

type Step = "club" | "yards" | "strike" | "result" | "miss" | "situation" | "putt";

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
  clubs,
  parByHole,
  holeNumbers,
  initialLogged,
  lastShotByHole,
}: ShotEntryFlowProps) {
  const router = useRouter();

  const [logged, setLogged] = useState<Record<number, HoleLog>>(initialLogged);
  const [localPar, setLocalPar] = useState<Record<number, number>>({});
  const [lastShot, setLastShot] =
    useState<Record<number, PrevFinish | null>>(lastShotByHole);
  const [hole, setHole] = useState<number>(
    holeNumbers.find((h) => !holeDone(initialLogged, h)) ?? holeNumbers[0],
  );

  // Draft (the shot being entered) ------------------------------------------
  const [step, setStep] = useState<Step>("club");
  const [club, setClub] = useState<string | null>(null);
  const [yards, setYards] = useState<string>("");
  const [skipYards, setSkipYards] = useState(false);
  const [execution, setExecution] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [missDirection, setMissDirection] = useState<MissDirection | null>(null);
  // Decision quality (spec 1A): default Good; the player taps Bad on the result
  // step only for a genuine process error before choosing the result chip.
  const [decisionQuality, setDecisionQuality] = useState<DecisionQuality>("Good");
  // Start lie: `lieOverride` is the player's one-tap override (else the
  // carry-forward default is used). Domino fields default to no-trouble.
  const [lieOverride, setLieOverride] = useState<StartLie | null>(null);
  const [lieOpen, setLieOpen] = useState(false);
  const [shortSided, setShortSided] = useState(false);
  // Putt mode
  const [puttNo, setPuttNo] = useState(1);
  const [puttPhase, setPuttPhase] = useState<"main" | "miss">("main");
  const [puttFeet, setPuttFeet] = useState<string>("");
  const [puttExec, setPuttExec] = useState<number | null>(null);
  const [puttSide, setPuttSide] = useState<PuttSide | null>(null);
  const [puttLength, setPuttLength] = useState<PuttLength | null>(null);

  const [busy, setBusy] = useState(false);
  // Synchronous re-entry guard against same-tick double-taps.
  const submitting = useRef(false);

  // The just-committed shot, so it can be reopened/edited from the next shot's
  // club step (the common "wait, I mis-tapped that" case).
  const [lastCommitted, setLastCommitted] = useState<{
    id: string;
    hole: number;
    shotNo: number;
    values: ShotFormValues;
  } | null>(null);
  const [editingLast, setEditingLast] = useState(false);

  // Keep the active hole chip visible in the horizontal strip.
  const currentChipRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    currentChipRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [hole]);

  const courseParKnown = parByHole[hole] != null;
  const par = parByHole[hole] ?? localPar[hole] ?? null;
  const holeLog = logged[hole];
  const shotNo = (holeLog?.count ?? 0) + 1;
  const parLocked = courseParKnown || (holeLog?.count ?? 0) > 0;
  const { vsPar, holes: holesPlayed } = roundScore(logged, parByHole, localPar);
  const canPickUp =
    (holeLog?.count ?? 0) > 0 && !holeLog?.complete && !holeLog?.conceded;
  // The just-committed shot is the previous one on this hole → offer a quick edit.
  const editLastEligible =
    lastCommitted != null &&
    lastCommitted.hole === hole &&
    lastCommitted.shotNo === shotNo - 1;

  // Start-lie default carries forward from the prior shot's finish; the player
  // can override (one tap). Null default = penalty drop / unknown → set it.
  const defaultLie: StartLie | null =
    shotNo === 1 ? "Tee" : nextStartLie(lastShot[hole] ?? null);
  const effectiveLie: StartLie | null = lieOverride ?? defaultLie;
  // Short-sided is a green-side concept: shown when the shot missed the green
  // from an approach distance or a greenside lie.
  const distNum = yards === "" ? null : Number(yards);
  const showShortSided =
    !!result &&
    result !== "Green" &&
    result !== "Make" &&
    ((effectiveLie != null && GREENSIDE_LIES.has(effectiveLie)) ||
      (distNum != null && distNum <= 175));

  function resetDraft() {
    setClub(null);
    setYards("");
    setSkipYards(false);
    setExecution(null);
    setResult(null);
    setMissDirection(null);
    setDecisionQuality("Good");
    setLieOverride(null);
    setLieOpen(false);
    setShortSided(false);
    setPuttPhase("main");
    setPuttFeet("");
    setPuttExec(null);
    setPuttSide(null);
    setPuttLength(null);
    setStep("club");
  }

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

  // ── Persisting a shot ──────────────────────────────────────────────────────

  interface ShotDraft {
    club: string;
    yardage?: number;
    execution?: number;
    result?: Result;
    missDirection?: MissDirection;
    puttSide?: PuttSide;
    puttLength?: PuttLength;
    penalty?: number;
    situation?: Situation;
    shortSided?: boolean;
    /** Decision quality. Omitted (e.g. putts) → DB default 'Good'. */
    decisionQuality?: DecisionQuality;
  }

  /** Write the shot, update local progress, return the fresh map + made flag. */
  async function commitShot(
    d: ShotDraft,
  ): Promise<{ ok: boolean; made: boolean; map: Record<number, HoleLog>; strokes: number }> {
    const empty = { ok: false, made: false, map: logged, strokes: 0 };
    if (submitting.current || par === null) return empty;
    submitting.current = true;
    setBusy(true);
    const sn = (logged[hole]?.count ?? 0) + 1;
    // Start lie: putts are always on the green; otherwise the effective lie
    // (override or carry-forward default). distance_unit: feet for putts.
    const isPutt = d.club === "Putter";
    const lie: StartLie | null = isPutt ? "Green" : effectiveLie;
    try {
      const { id } = await saveShot({
        round_id: roundId,
        hole,
        par,
        shot_no: sn,
        club: d.club,
        yardage: d.yardage,
        distance_unit: isPutt ? "ft" : "yd",
        start_lie: lie ?? undefined,
        start_lie_manual: !isPutt && lieOverride !== null,
        situation_created: d.situation,
        short_sided: d.shortSided,
        decision_quality: d.decisionQuality,
        execution: d.execution,
        result: d.result,
        miss_direction: d.missDirection,
        putt_side: d.puttSide,
        putt_length: d.puttLength,
        penalty: d.penalty ?? 0,
      });
      const prev =
        logged[hole] ?? { count: 0, complete: false, conceded: false, penalties: 0 };
      const made = d.result === "Make";
      const penalties = prev.penalties + (d.penalty ?? 0);
      const map = {
        ...logged,
        [hole]: { count: sn, complete: made, conceded: prev.conceded, penalties },
      };
      setLogged(map);
      // Remember this finish so the next shot's start-lie carries forward.
      // `startLie` (the lie this shot played from) lets a stroke-and-distance
      // penalty replay from the same spot — a re-tee stays on the Tee.
      setLastShot((m) => ({
        ...m,
        [hole]: {
          result: d.result ?? null,
          club: d.club,
          yardage: d.yardage ?? null,
          startLie: lie,
        },
      }));
      // Remember the row so it can be edited from the next shot's club step.
      setLastCommitted({
        id,
        hole,
        shotNo: sn,
        values: {
          club: d.club,
          yardage: d.yardage ?? null,
          execution: d.execution ?? null,
          result: d.result ?? null,
          missDirection: d.missDirection ?? null,
          puttSide: d.puttSide ?? null,
          puttLength: d.puttLength ?? null,
          penalty: d.penalty ?? 0,
          decisionQuality: d.decisionQuality ?? "Good",
        },
      });
      return { ok: true, made, map, strokes: sn + penalties };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shot.");
      return empty;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  /** After a Make / holed putt: announce the hole score and move on. */
  function completeHole(map: Record<number, HoleLog>, strokes: number) {
    if (par !== null) {
      toast.success(`Hole ${hole}: ${strokes} (${formatDiff(strokes - par)})`);
    }
    const target = nextUnfinishedHole(map, hole);
    if (target !== null) {
      setHole(target);
      resetDraft();
    } else {
      router.push(`/rounds/${roundId}`);
    }
  }

  // ── Step handlers ──────────────────────────────────────────────────────────

  function chooseClub(c: string) {
    setClub(c);
    if (c === "Putter") {
      // Logging a putt directly → putt mode (e.g. resuming on the green).
      setPuttNo(1);
      setPuttPhase("main");
      setPuttFeet("");
      setPuttExec(null);
      setPuttSide(null);
      setPuttLength(null);
      setStep("putt");
      return;
    }
    // A tee shot with a long club on a par 4/5 skips yardage — including a
    // re-tee after an OB/Lost penalty (effectiveLie carries "Tee" forward),
    // which is the same shot played again.
    const teeNoYardage =
      effectiveLie === "Tee" && (par ?? 0) >= 4 && TEE_NO_YARDAGE.has(c);
    setSkipYards(teeNoYardage);
    setStep(teeNoYardage ? "strike" : "yards");
  }

  function chooseExecution(e: number) {
    setExecution(e);
    setStep("result");
  }

  async function chooseResult(r: Result) {
    setResult(r);
    // Terminal results commit immediately; everything else gathers a
    // miss-direction (if relevant) and the "situation created" before saving.
    if (r === "Make" || r === "Green") {
      const res = await commitShot({
        club: club!,
        yardage: yards === "" ? undefined : Number(yards),
        execution: execution ?? undefined,
        result: r,
        decisionQuality,
      });
      if (!res.ok) return;
      if (r === "Make") completeHole(res.map, res.strokes);
      else enterPutt();
      return;
    }
    setStep(MISS_RESULTS.has(r) ? "miss" : "situation");
  }

  async function chooseMiss(dir: MissDirection) {
    setMissDirection(dir);
    // Stroke-and-distance (OB / Lost): the next shot is a replay from the same
    // spot, so the "what did it leave you?" step is meaningless — skip it and
    // save with a Neutral situation. (Pass `dir` explicitly; the setState above
    // hasn't applied yet this tick.)
    if (STROKE_AND_DISTANCE.has(result!)) {
      await commitNonTerminal("Neutral", dir);
      return;
    }
    setStep("situation");
  }

  /** Save a non-terminal shot (records the domino field), then advance to the
   *  next shot. `missDir` overrides the `missDirection` state for callers that
   *  commit in the same tick they set it. */
  async function commitNonTerminal(sit: Situation, missDir?: MissDirection) {
    const r = result!;
    const res = await commitShot({
      club: club!,
      yardage: yards === "" ? undefined : Number(yards),
      execution: execution ?? undefined,
      result: r,
      missDirection: missDir ?? missDirection ?? undefined,
      situation: sit,
      shortSided: showShortSided ? shortSided : undefined,
      penalty: PENALTY_RESULTS.has(r) ? 1 : 0,
      decisionQuality,
    });
    if (!res.ok) return;
    resetDraft(); // non-terminal → next shot
  }

  /** Final step for a non-terminal shot: record the domino field, then save. */
  async function chooseSituation(sit: Situation) {
    await commitNonTerminal(sit);
  }

  function enterPutt() {
    setLieOverride(null);
    setLieOpen(false);
    setPuttNo(1);
    setPuttPhase("main");
    setPuttFeet("");
    setPuttExec(null);
    setPuttSide(null);
    setPuttLength(null);
    setStep("putt");
  }

  async function holePutt() {
    const res = await commitShot({
      club: "Putter",
      yardage: puttYardsFromFeet(puttFeet),
      execution: puttExec ?? undefined,
      result: "Make",
    });
    if (!res.ok) return;
    completeHole(res.map, res.strokes);
  }

  async function nextPutt() {
    const yardage = puttYardsFromFeet(puttFeet);
    const res = await commitShot({
      club: "Putter",
      yardage,
      execution: puttExec ?? undefined,
      puttSide: puttSide ?? undefined,
      puttLength: puttLength ?? undefined,
    });
    if (!res.ok) return;
    setPuttNo((n) => n + 1);
    setPuttFeet("");
    setPuttExec(null);
    setPuttSide(null);
    setPuttLength(null);
    setPuttPhase("main");
  }

  async function handlePickUp() {
    const prev = logged[hole];
    if (!prev || prev.count === 0) return;
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await pickUpHole(roundId, hole);
      const map = { ...logged, [hole]: { ...prev, conceded: true } };
      setLogged(map);
      const target = nextUnfinishedHole(map, hole);
      if (target !== null) {
        setHole(target);
        resetDraft();
      } else {
        router.push(`/rounds/${roundId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pick up hole.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  /**
   * Always-available back. Within a shot it walks the sub-steps back; at the
   * start of a shot (club picker / first putt) it reopens the just-logged shot
   * for editing, and on the very first shot of a hole it exits to the round.
   */
  function back() {
    // Sub-steps of the shot being entered.
    if (step === "yards" || (step === "strike" && skipYards)) return setStep("club");
    if (step === "strike") return setStep("yards");
    if (step === "result") return setStep("strike");
    if (step === "miss") return setStep("result");
    if (step === "situation") return setStep(missDirection ? "miss" : "result");
    // Putt miss detail → back to the putt's distance screen.
    if (step === "putt" && puttPhase === "miss") return setPuttPhase("main");
    // Start of a shot: reopen the previous shot to edit, else leave the flow.
    if (editLastEligible && lastCommitted) return setEditingLast(true);
    router.push(`/rounds/${roundId}`);
  }

  /** Save edits to the just-committed shot (reopened from the club step). */
  async function saveLastEdit(values: ShotFormValues) {
    if (!lastCommitted || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await editShot(lastCommitted.id, roundId, {
        club: values.club!,
        yardage: values.yardage,
        execution: values.execution,
        result: values.result,
        miss_direction: values.missDirection,
        putt_side: values.puttSide,
        putt_length: values.puttLength,
        penalty: values.penalty,
        decision_quality: values.decisionQuality,
      });
      const h = lastCommitted.hole;
      const penaltyDelta = (values.penalty ?? 0) - (lastCommitted.values.penalty ?? 0);
      // Re-sync the bits of local state this shot drives: carry-forward lie,
      // the hole's penalty total, and completeness if it became a Make.
      setLastShot((m) => ({
        ...m,
        [h]: { result: values.result, club: values.club!, yardage: values.yardage },
      }));
      setLogged((m) => {
        const cur = m[h] ?? { count: 0, complete: false, conceded: false, penalties: 0 };
        return {
          ...m,
          [h]: {
            ...cur,
            penalties: cur.penalties + penaltyDelta,
            complete: values.result === "Make" ? true : cur.complete,
          },
        };
      });
      setLastCommitted({ ...lastCommitted, values });
      setEditingLast(false);
      toast.success("Shot updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update shot.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function jumpToHole(h: number) {
    setHole(h);
    resetDraft();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  const STEP_ORDER: Step[] = ["club", "yards", "strike", "result"];
  const stepperIdx = STEP_ORDER.indexOf(
    step === "miss" || step === "situation" ? "result" : step,
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-10 pt-4">
      {/* Context header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg transition-colors hover:bg-muted/70"
        >
          ←
        </button>
        <div className="flex-1">
          <h2 className="font-heading text-xl font-bold leading-none">Hole {hole}</h2>
          {par !== null && (
            <p className="eyebrow mt-1">Par {par}</p>
          )}
        </div>
        <div className="text-right">
          {holesPlayed > 0 && (
            <p
              className={cn(
                "font-mono text-lg font-bold leading-none tabular-nums",
                vsPar < 0
                  ? "text-positive"
                  : vsPar > 0
                  ? "text-destructive"
                  : "text-foreground",
              )}
            >
              {formatDiff(vsPar)}
            </p>
          )}
          <p className="eyebrow mt-1">
            {holesPlayed > 0 ? `thru ${holesPlayed} · ` : ""}shot {shotNo}
          </p>
        </div>
      </div>

      {/* Stepper (hidden in putt mode) */}
      {step !== "putt" && (
        <div className="flex gap-1.5">
          {STEP_ORDER.map((s, i) => {
            const isYards = s === "yards";
            const muted = isYards && skipYards;
            return (
              <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-full rounded-full",
                    i < stepperIdx
                      ? "bg-primary"
                      : i === stepperIdx
                      ? "bg-highlight"
                      : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "font-mono text-[9px] uppercase tracking-wide",
                    i === stepperIdx
                      ? "text-foreground"
                      : i < stepperIdx
                      ? "text-primary"
                      : muted
                      ? "text-muted-foreground/40 line-through"
                      : "text-muted-foreground/60",
                  )}
                >
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Start lie — carries forward; one tap to override */}
      {step !== "putt" && effectiveLie !== "Green" && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setLieOpen((o) => !o)}
            className="flex items-center gap-2 self-start rounded-full bg-muted px-3 py-1.5 text-sm transition-colors hover:bg-muted/70"
          >
            <span className="eyebrow">Lie</span>
            <span className="font-medium">{effectiveLie ?? "Set lie"}</span>
            {lieOverride && <span className="text-[10px] text-muted-foreground">edited</span>}
            <span className="text-xs text-muted-foreground">▾</span>
          </button>
          {lieOpen && (
            <div className="grid grid-cols-3 gap-2">
              {OVERRIDE_LIES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLieOverride(l);
                    setLieOpen(false);
                  }}
                  className={cn(
                    "h-10 rounded-xl border-2 px-2 text-xs font-medium transition-colors",
                    effectiveLie === l
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-muted/50",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compact hole selector — jump to any hole to fix / resume */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-1.5">
          {holeNumbers.map((h) => {
            const l = logged[h];
            const isCurrent = h === hole;
            return (
              <button
                key={h}
                ref={isCurrent ? currentChipRef : undefined}
                type="button"
                onClick={() => jumpToHole(h)}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "h-8 w-8 shrink-0 rounded-lg font-mono text-xs font-medium tabular-nums transition-colors",
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : l?.complete
                    ? "bg-muted text-muted-foreground ring-1 ring-positive/40"
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

      {/* Par picker when par is unknown (no course, no prior shot) */}
      {!parLocked && step === "club" && (
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Par</span>
          <div className="flex gap-2">
            {([3, 4, 5] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setLocalPar({ ...localPar, [hole]: p })}
                className={cn(
                  "h-10 flex-1 rounded-xl text-sm font-semibold transition-colors",
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

      {/* ── Steps ─────────────────────────────────────────────────────────── */}

      {step === "club" && par !== null && (
        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-2xl font-bold">Which club?</h3>
          {clubs.includes("D") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => chooseClub("D")}
              className="h-14 rounded-2xl border-2 border-border bg-card text-lg font-bold transition-transform active:scale-[0.97]"
            >
              Driver
            </button>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            {clubs
              .filter((c) => c !== "D" && c !== "Putter")
              .map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={busy}
                  onClick={() => chooseClub(c)}
                  className="h-14 rounded-2xl border-2 border-border bg-card font-mono text-lg font-semibold transition-transform active:scale-[0.97]"
                >
                  {c}
                </button>
              ))}
          </div>
          {clubs.includes("Putter") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => chooseClub("Putter")}
              className="h-14 rounded-2xl border-2 border-border bg-card text-lg font-bold transition-transform active:scale-[0.97]"
            >
              Putter
            </button>
          )}

          {/* Edit just-logged shot / Pick up / Done */}
          <div className="mt-1 flex flex-col gap-2">
            {editLastEligible && lastCommitted && (
              <button
                type="button"
                onClick={() => setEditingLast(true)}
                disabled={busy}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-muted/60 text-sm font-medium transition-colors hover:bg-muted"
              >
                ← Edit shot {lastCommitted.shotNo}
                <span className="font-mono text-xs text-muted-foreground">
                  {lastCommitted.values.club}
                  {lastCommitted.values.result ? ` · ${lastCommitted.values.result}` : ""}
                </span>
              </button>
            )}
            {canPickUp && (
              <button
                type="button"
                onClick={handlePickUp}
                disabled={busy}
                className="h-11 rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Pick up hole →
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push(`/rounds/${roundId}`)}
              className="h-11 rounded-xl text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {step === "yards" && (
        <div className="flex flex-col gap-4">
          <h3 className="font-heading text-2xl font-bold">How far?</h3>
          <div className="text-center">
            <div className="font-mono text-6xl font-extrabold tabular-nums">
              {yards === "" ? "—" : yards}
            </div>
            <div className="eyebrow mt-1">yards to the hole</div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setYards((y) => (y.length < 3 ? (y + k).replace(/^0+/, "") : y))}
                className="h-12 rounded-xl bg-muted font-mono text-2xl font-semibold transition-transform active:scale-[0.96]"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setYards("")}
              className="h-12 rounded-xl bg-muted font-mono text-sm text-muted-foreground transition-transform active:scale-[0.96]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setYards((y) => (y.length < 3 ? (y + "0").replace(/^0+/, "") : y))}
              className="h-12 rounded-xl bg-muted font-mono text-2xl font-semibold transition-transform active:scale-[0.96]"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setYards((y) => y.slice(0, -1))}
              className="h-12 rounded-xl bg-muted font-mono text-xl text-muted-foreground transition-transform active:scale-[0.96]"
            >
              ⌫
            </button>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                setYards("");
                setStep("strike");
              }}
              className="h-14 flex-1 rounded-2xl bg-muted text-base font-bold text-muted-foreground transition-transform active:scale-[0.97]"
            >
              No yardage
            </button>
            <button
              type="button"
              onClick={() => setStep("strike")}
              className="h-14 flex-1 rounded-2xl bg-primary text-base font-bold text-primary-foreground transition-transform active:scale-[0.97]"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {step === "strike" && (
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-2xl font-bold">How&apos;d you strike it?</h3>
          <p className="mb-2 text-sm text-muted-foreground">Your honest 1–4 quality rating.</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2, 3, 4].map((e) => (
              <button
                key={e}
                type="button"
                disabled={busy}
                onClick={() => chooseExecution(e)}
                className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border bg-card transition-transform active:scale-[0.97]"
              >
                <span className="font-mono text-2xl font-extrabold">{e}</span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {EXEC_LABELS[e - 1]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "result" && (
        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-2xl font-bold">Where&apos;d it end up?</h3>

          {/* Decision quality (spec 1A): one tap, default Good. Flag Bad only for
              a process error (risk / club / line / didn't commit) — not a good
              play that drew a bad result. Set before tapping the result chip. */}
          <div className="flex items-center justify-between rounded-2xl border-2 border-border bg-card px-4 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">Decision</span>
              <span className="text-xs text-muted-foreground">
                Tap Bad only for a thinking mistake
              </span>
            </div>
            <div className="flex gap-1.5">
              {DECISION_QUALITIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy}
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

          <div className="grid grid-cols-2 gap-2.5">
            {RESULTS.filter((r) => r !== "Make").map((r) => (
              <button
                key={r}
                type="button"
                disabled={busy}
                onClick={() => chooseResult(r)}
                className="h-14 rounded-2xl border-2 border-border bg-card text-base font-bold transition-transform active:scale-[0.97]"
              >
                {r}
                {PENALTY_RESULTS.has(r) && (
                  <span className="ml-1 align-super font-mono text-[9px] text-chart-3">+1</span>
                )}
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => chooseResult("Make")}
              className="col-span-2 h-14 rounded-2xl border-2 border-primary bg-primary text-base font-bold text-primary-foreground transition-transform active:scale-[0.97]"
            >
              ● Holed it
            </button>
          </div>
        </div>
      )}

      {step === "miss" && (
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-2xl font-bold">Which way?</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Tag the miss so dispersion stays honest.
          </p>
          <div className="grid grid-cols-3 grid-rows-3 gap-2.5">
            {MISS_DIRECTIONS.map((d) => (
              <button
                key={d}
                type="button"
                disabled={busy}
                onClick={() => chooseMiss(d)}
                className={cn(
                  "flex h-[72px] items-center justify-center rounded-2xl border-2 border-border bg-card text-base font-bold transition-transform active:scale-[0.97]",
                  d === "Long" && "col-start-2 row-start-1",
                  d === "Left" && "col-start-1 row-start-2",
                  d === "Right" && "col-start-3 row-start-2",
                  d === "Short" && "col-start-2 row-start-3",
                )}
              >
                {d}
              </button>
            ))}
            <span className="col-start-2 row-start-2 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground/50">
              Pin
            </span>
          </div>
        </div>
      )}

      {step === "situation" && (
        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-2xl font-bold">What did it leave you?</h3>
          <p className="-mt-1 text-sm text-muted-foreground">
            One tap — did this shot help or hurt your next one?
          </p>

          {showShortSided && (
            <div className="flex items-center justify-between rounded-2xl border-2 border-border bg-card px-4 py-2.5">
              <span className="text-sm font-medium">Short-sided?</span>
              <button
                type="button"
                onClick={() => setShortSided((s) => !s)}
                className={cn(
                  "h-9 rounded-lg border-2 px-4 text-sm font-bold transition-colors",
                  shortSided
                    ? "border-chart-3 bg-chart-3 text-white"
                    : "border-input bg-card text-muted-foreground",
                )}
              >
                {shortSided ? "Yes" : "No"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            {SITUATIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => chooseSituation(s)}
                className={cn(
                  "h-16 rounded-2xl border-2 text-base font-bold transition-transform active:scale-[0.97]",
                  s === "Neutral"
                    ? "border-primary/40 bg-card"
                    : "border-border bg-card",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "putt" && (
        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-2xl font-bold">
            {puttNo === 1 ? "First putt" : puttNo === 2 ? "Second putt" : `Putt ${puttNo}`}
          </h3>

          {puttPhase === "main" ? (
            <>
              <p className="text-sm text-muted-foreground">
                How far, in feet? (step off long ones — a pace ≈ 3 ft)
              </p>
              <div className="text-center">
                <div className="font-mono text-5xl font-extrabold tabular-nums">
                  {puttFeet === "" ? "—" : puttFeet}
                  <span className="ml-1 align-baseline text-xl text-muted-foreground">
                    ft
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      setPuttFeet((f) => (f.length < 2 ? (f + k).replace(/^0+/, "") : f))
                    }
                    className="h-11 rounded-xl bg-muted font-mono text-xl font-semibold transition-transform active:scale-[0.96]"
                  >
                    {k}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPuttFeet("")}
                  className="h-11 rounded-xl bg-muted font-mono text-sm text-muted-foreground transition-transform active:scale-[0.96]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPuttFeet((f) => (f.length < 2 ? (f + "0").replace(/^0+/, "") : f))
                  }
                  className="h-11 rounded-xl bg-muted font-mono text-xl font-semibold transition-transform active:scale-[0.96]"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPuttFeet((f) => f.slice(0, -1))}
                  className="h-11 rounded-xl bg-muted font-mono text-lg text-muted-foreground transition-transform active:scale-[0.96]"
                >
                  ⌫
                </button>
              </div>
              {/* Optional strike rating — putts are on the green; this keeps the
                  flow fast (tap if you want it) but lets you rate the stroke. */}
              <div className="flex items-center gap-2">
                <span className="eyebrow shrink-0">Strike</span>
                <div className="grid flex-1 grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setPuttExec((cur) => (cur === e ? null : e))}
                      className={cn(
                        "h-10 rounded-xl border-2 font-mono text-base font-semibold transition-transform active:scale-[0.97]",
                        puttExec === e
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card",
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={busy || puttFeet === ""}
                  onClick={() => setPuttPhase("miss")}
                  className="h-16 rounded-2xl border-2 border-border bg-card text-lg font-bold transition-transform active:scale-[0.97] disabled:opacity-40"
                >
                  Missed
                </button>
                <button
                  type="button"
                  disabled={busy || puttFeet === ""}
                  onClick={holePutt}
                  className="h-16 rounded-2xl border-2 border-primary bg-primary text-lg font-bold text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-40"
                >
                  ● Holed it
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Rare: a Texas-wedge / chip with the putter — log normally.
                  setStep("club");
                }}
                className="mt-1 text-sm text-muted-foreground underline underline-offset-4"
              >
                Putted off the green?
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Putt miss — material only. Skip if it was close.
              </p>
              <div className="flex flex-col gap-1.5">
                <span className="eyebrow">Side</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {PUTT_SIDES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPuttSide((cur) => (cur === s ? null : s))}
                      className={cn(
                        "h-14 rounded-2xl border-2 text-base font-bold transition-transform active:scale-[0.97]",
                        puttSide === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="eyebrow">Length</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {PUTT_LENGTHS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setPuttLength((cur) => (cur === l ? null : l))}
                      className={cn(
                        "h-14 rounded-2xl border-2 text-base font-bold transition-transform active:scale-[0.97]",
                        puttLength === l
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={nextPutt}
                className="mt-1 h-14 rounded-2xl bg-primary text-base font-bold text-primary-foreground transition-transform active:scale-[0.97]"
              >
                Next putt →
              </button>
            </>
          )}
        </div>
      )}

      {/* Quick-edit the just-logged shot (core fields). */}
      <Sheet open={editingLast} onOpenChange={(o) => !o && setEditingLast(false)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
          {lastCommitted && (
            <>
              <SheetHeader>
                <SheetTitle>
                  Edit shot {lastCommitted.shotNo} · Hole {lastCommitted.hole}
                </SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">
                <ShotForm
                  key={lastCommitted.id}
                  clubs={clubs}
                  par={par}
                  shotNo={lastCommitted.shotNo}
                  requireExecution={false}
                  busy={busy}
                  initial={lastCommitted.values}
                  submitLabel={() => "Save changes"}
                  onSubmit={saveLastEdit}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
