"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createShot, concedeHole } from "@/actions/shots";
import {
  CLUBS,
  RESULTS,
  MISS_DIRECTIONS,
  PUTT_SIDES,
  PUTT_LENGTHS,
  type Club,
  type Result,
  type MissDirection,
  type PuttSide,
  type PuttLength,
} from "@/lib/constants";
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

/** Results that auto-incur a penalty stroke (matches ShotForm / SPEC). */
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
/** Clubs that, off the tee on a par 4/5, skip the yardage step. */
const TEE_NO_YARDAGE = new Set<Club>(["D", "3W", "5W"]);

/**
 * Putt distance buckets → a representative numeric yardage (stored in
 * `yardage`, in yards). Each value sits squarely inside the matching feet
 * bucket once analytics multiply by 3, so make-rate / first-putt distance
 * analytics keep working. Distance is therefore captured as a bucket, not an
 * exact figure (the fast cart-entry tradeoff).
 */
const PUTT_DIST: { label: string; yards: number }[] = [
  { label: "≤3 ft", yards: 1 }, //  3 ft → 0–3
  { label: "3–6 ft", yards: 2 }, //  6 ft → 3–6
  { label: "6–10 ft", yards: 3 }, //  9 ft → 6–10
  { label: "10–20 ft", yards: 5 }, // 15 ft → 10–20
  { label: "20+ ft", yards: 8 }, // 24 ft → 20+
];

const EXEC_LABELS = ["Bad", "Okay", "Good", "Great"];

type Step = "club" | "yards" | "strike" | "result" | "miss" | "putt";

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

  // Draft (the shot being entered) ------------------------------------------
  const [step, setStep] = useState<Step>("club");
  const [club, setClub] = useState<Club | null>(null);
  const [yards, setYards] = useState<string>("");
  const [skipYards, setSkipYards] = useState(false);
  const [execution, setExecution] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [mulligan, setMulligan] = useState(false);
  // Putt mode
  const [puttNo, setPuttNo] = useState(1);
  const [puttPhase, setPuttPhase] = useState<"main" | "miss">("main");
  const [puttDist, setPuttDist] = useState<string | null>(null);
  const [puttSide, setPuttSide] = useState<PuttSide | null>(null);
  const [puttLength, setPuttLength] = useState<PuttLength | null>(null);

  const [busy, setBusy] = useState(false);
  // Synchronous re-entry guard against same-tick double-taps.
  const submitting = useRef(false);

  const courseParKnown = parByHole[hole] != null;
  const par = parByHole[hole] ?? localPar[hole] ?? null;
  const holeLog = logged[hole];
  const shotNo = (holeLog?.count ?? 0) + 1;
  const parLocked = courseParKnown || (holeLog?.count ?? 0) > 0;
  const { vsPar, holes: holesPlayed } = roundScore(logged, parByHole, localPar);

  function resetDraft() {
    setClub(null);
    setYards("");
    setSkipYards(false);
    setExecution(null);
    setResult(null);
    setMulligan(false);
    setPuttPhase("main");
    setPuttDist(null);
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
    club: Club;
    yardage?: number;
    execution?: number;
    result?: Result;
    missDirection?: MissDirection;
    puttSide?: PuttSide;
    puttLength?: PuttLength;
    mulligan?: boolean;
    penalty?: number;
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
    try {
      await createShot({
        round_id: roundId,
        hole,
        par,
        shot_no: sn,
        club: d.club,
        yardage: d.yardage,
        execution: d.execution,
        result: d.result,
        miss_direction: d.missDirection,
        putt_side: d.puttSide,
        putt_length: d.puttLength,
        mulligan: d.mulligan ?? false,
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

  function chooseClub(c: Club) {
    setClub(c);
    if (c === "Putter") {
      // Logging a putt directly → putt mode (e.g. resuming on the green).
      setPuttNo(1);
      setPuttPhase("main");
      setPuttDist(null);
      setPuttSide(null);
      setPuttLength(null);
      setStep("putt");
      return;
    }
    const teeNoYardage = shotNo === 1 && (par ?? 0) >= 4 && TEE_NO_YARDAGE.has(c);
    setSkipYards(teeNoYardage);
    setStep(teeNoYardage ? "strike" : "yards");
  }

  function chooseExecution(e: number) {
    setExecution(e);
    setStep("result");
  }

  async function chooseResult(r: Result) {
    setResult(r);
    if (MISS_RESULTS.has(r)) {
      setStep("miss");
      return;
    }
    const res = await commitShot({
      club: club!,
      yardage: yards === "" ? undefined : Number(yards),
      execution: execution ?? undefined,
      result: r,
      mulligan,
      penalty: 0,
    });
    if (!res.ok) return;
    if (r === "Make") completeHole(res.map, res.strokes);
    else if (r === "Green") enterPutt();
    else resetDraft(); // Fairway → next shot
  }

  async function chooseMiss(dir: MissDirection) {
    const r = result!;
    const res = await commitShot({
      club: club!,
      yardage: yards === "" ? undefined : Number(yards),
      execution: execution ?? undefined,
      result: r,
      missDirection: dir,
      mulligan,
      penalty: PENALTY_RESULTS.has(r) ? 1 : 0,
    });
    if (!res.ok) return;
    resetDraft(); // miss results are never Make/Green → next shot
  }

  function enterPutt() {
    setPuttNo(1);
    setPuttPhase("main");
    setPuttDist(null);
    setPuttSide(null);
    setPuttLength(null);
    setStep("putt");
  }

  async function holePutt() {
    const yardage = PUTT_DIST.find((d) => d.label === puttDist)?.yards;
    const res = await commitShot({ club: "Putter", yardage, result: "Make" });
    if (!res.ok) return;
    completeHole(res.map, res.strokes);
  }

  async function nextPutt() {
    const yardage = PUTT_DIST.find((d) => d.label === puttDist)?.yards;
    const res = await commitShot({
      club: "Putter",
      yardage,
      puttSide: puttSide ?? undefined,
      puttLength: puttLength ?? undefined,
    });
    if (!res.ok) return;
    setPuttNo((n) => n + 1);
    setPuttDist(null);
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
      await concedeHole(roundId, hole);
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

  function back() {
    if (step === "yards" || (step === "strike" && skipYards)) setStep("club");
    else if (step === "strike") setStep("yards");
    else if (step === "result") setStep("strike");
    else if (step === "miss") setStep("result");
  }

  function jumpToHole(h: number) {
    setHole(h);
    resetDraft();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  const STEP_ORDER: Step[] = ["club", "yards", "strike", "result"];
  const stepperIdx = STEP_ORDER.indexOf(step === "miss" ? "result" : step);
  const canPickUp =
    (logged[hole]?.count ?? 0) > 0 &&
    !logged[hole]?.complete &&
    !logged[hole]?.conceded;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-10 pt-4">
      {/* Context header */}
      <div className="flex items-center gap-3">
        {step !== "club" && step !== "putt" && (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg transition-colors hover:bg-muted/70"
          >
            ←
          </button>
        )}
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

      {/* Compact hole selector — jump to any hole to fix / resume */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-1.5">
          {holeNumbers.map((h) => {
            const l = logged[h];
            const isCurrent = h === hole;
            return (
              <button
                key={h}
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
          <button
            type="button"
            disabled={busy}
            onClick={() => chooseClub("D")}
            className="h-14 rounded-2xl border-2 border-border bg-card text-lg font-bold transition-transform active:scale-[0.97]"
          >
            Driver
          </button>
          <div className="grid grid-cols-3 gap-2.5">
            {CLUBS.filter((c) => c !== "D" && c !== "Putter").map((c) => (
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
          <button
            type="button"
            disabled={busy}
            onClick={() => chooseClub("Putter")}
            className="h-14 rounded-2xl border-2 border-border bg-card text-lg font-bold transition-transform active:scale-[0.97]"
          >
            Putter
          </button>

          {/* Pick up / Done */}
          <div className="mt-1 flex flex-col gap-2">
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
            <div className="eyebrow mt-1">yards to target</div>
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
          <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Take this one back?</span>
            <button
              type="button"
              onClick={() => setMulligan((m) => !m)}
              className={cn(
                "h-10 rounded-xl border-2 px-4 text-sm font-bold transition-colors",
                mulligan
                  ? "border-chart-3 bg-chart-3 text-white"
                  : "border-input bg-card text-foreground",
              )}
            >
              Mulligan
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

      {step === "putt" && (
        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-2xl font-bold">
            {puttNo === 1 ? "First putt" : puttNo === 2 ? "Second putt" : `Putt ${puttNo}`}
          </h3>

          {puttPhase === "main" ? (
            <>
              <p className="text-sm text-muted-foreground">Pick the distance, then the result.</p>
              <div className="grid grid-cols-3 gap-2.5">
                {PUTT_DIST.map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setPuttDist(d.label)}
                    className={cn(
                      "h-12 rounded-2xl border-2 font-mono text-sm font-semibold transition-transform active:scale-[0.97]",
                      puttDist === d.label
                        ? "border-highlight bg-highlight text-highlight-foreground"
                        : "border-border bg-card",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={busy || !puttDist}
                  onClick={() => setPuttPhase("miss")}
                  className="h-16 rounded-2xl border-2 border-border bg-card text-lg font-bold transition-transform active:scale-[0.97] disabled:opacity-40"
                >
                  Missed
                </button>
                <button
                  type="button"
                  disabled={busy || !puttDist}
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
    </div>
  );
}
