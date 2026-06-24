"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveShot, editShot, deleteShot, pickUpHole, clearHole } from "@/lib/shots/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ShotForm, type ShotFormValues } from "@/components/shot-entry/ShotForm";
import {
  RESULT_GRID,
  PUTT_SIDES,
  PUTT_LENGTHS,
  START_LIES,
  DECISION_QUALITIES,
  OBSTRUCTION,
  OBSTRUCTION_COPY,
  SHOT_SHAPES,
  SHOT_STARTS,
  type Result,
  type MissDirection,
  type PuttSide,
  type PuttLength,
  type StartLie,
  type DecisionQuality,
  type Obstruction,
  type ShotShape,
  type ShotContact,
  type ShotStart,
  type TargetOffset,
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

/** A shot as shown in the "This hole" recap strip (B5). */
export interface RecapShot {
  club: string;
  result: Result | null;
  yardage: number | null;
  isPutt: boolean;
  miss: MissDirection | null;
  penalty: number;
  /** The shot's START obstruction (carried in from the prior finish). */
  obstruction: Obstruction;
}

interface ShotEntryFlowProps {
  roundId: string;
  /** The user's club bag, in order (from the Setup page). */
  clubs: string[];
  /** Known par per hole (from the course, or from already-logged shots). */
  parByHole: Record<number, number>;
  /** Shots already logged per hole, for the "This hole" recap strip (B5). */
  shotsByHole: Record<number, RecapShot[]>;
  /** Tee yardage per hole for the round's selected tee (empty if no tee). Shown
   *  as on-course reference — most useful on the tee shot, where the wizard
   *  skips yardage entry for driver/woods. */
  yardageByHole: Record<number, number>;
  /** The player's most-typical distances per club (B3 smart-yardage chips),
   *  most common first. Missing club → no chips. */
  clubYardages: Record<string, number[]>;
  /** Selectable holes, ascending. */
  holeNumbers: number[];
  /** Hole the player teed off on — seeds the opening hole (D-13). */
  startingHole: number;
  initialLogged: Record<number, HoleLog>;
  /** Last logged shot per hole, to seed the start-lie carry-forward on resume. */
  lastShotByHole: Record<number, PrevFinish | null>;
}

/** Results that auto-incur a penalty stroke (matches ShotForm / SPEC). */
const PENALTY_RESULTS = new Set<Result>(["OB", "Hazard", "Lost", "Unplayable"]);
/** Stroke-and-distance penalties: you replay from the same spot (same lie, same
 *  distance), so the next shot is a do-over — skip the "what did it leave you?"
 *  step (nothing changed) and carry the lie forward unchanged. */
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
/** Lies offered in the override picker (Tee is auto for shot 1; Green = putt). */
const OVERRIDE_LIES = START_LIES.filter((l) => l !== "Green");

/** Putts are entered in feet (stored canonically as yards = feet / 3). Feet
 *  gives 1-ft resolution where the expected-strokes curve is steepest — the
 *  3–8 ft range — which buckets threw away. */
const puttYardsFromFeet = (feet: string): number | undefined =>
  feet === "" ? undefined : Number(feet) / 3;

const EXEC_LABELS = ["Bad", "Okay", "Good", "Great"];

type Step =
  | "club"
  | "yards"
  | "strike"
  | "contact"
  | "start"
  | "curve"
  | "result"
  | "offset"
  | "putt";

/** Off-the-tee drives capture side only; everything else gets the pin-relative
 *  grid (long/short is meaningless without a pin). Mirrors `categoryOf`'s tee
 *  branch (a par-3 tee shot is an approach → grid). */
function offsetIsSideOnly(lie: StartLie | null, par: number | null): boolean {
  return lie === "Tee" && (par ?? 0) >= 4;
}

/** Collapse a 3×3 target offset to the legacy single-axis miss_direction, so the
 *  existing dispersion analytics (which read miss_direction) stay unchanged.
 *  Lateral wins for diagonals; Center has no legacy equivalent. */
function legacyMiss(o: TargetOffset): MissDirection | undefined {
  switch (o) {
    case "Long":
      return "Long";
    case "Short":
      return "Short";
    case "Left":
    case "LongLeft":
    case "ShortLeft":
      return "Left";
    case "Right":
    case "LongRight":
    case "ShortRight":
      return "Right";
    case "Center":
      return undefined;
  }
}

/** Pin-relative grid cells in row-major order, with display labels. */
const OFFSET_GRID: { value: TargetOffset; label: string }[] = [
  { value: "LongLeft", label: "Long left" },
  { value: "Long", label: "Long" },
  { value: "LongRight", label: "Long right" },
  { value: "Left", label: "Left" },
  { value: "Center", label: "At pin" },
  { value: "Right", label: "Right" },
  { value: "ShortLeft", label: "Short left" },
  { value: "Short", label: "Short" },
  { value: "ShortRight", label: "Short right" },
];

/** Side-only row for tee shots (no long/short). */
const OFFSET_SIDE: { value: TargetOffset; label: string }[] = [
  { value: "Left", label: "Left" },
  { value: "Center", label: "Middle" },
  { value: "Right", label: "Right" },
];

/**
 * A shot committed this session, kept so the back arrow can step back into it.
 * Stepping back deletes the DB row and restores this snapshot into the draft, so
 * re-advancing re-inserts the shot cleanly (shot numbers stay contiguous and the
 * lie chain recomputes). Only shots logged this session are rewindable.
 */
interface HistoryEntry {
  id: string;
  hole: number;
  shotNo: number;
  isPutt: boolean;
  /** Draft field values as they were when the shot committed. */
  draft: {
    club: string | null;
    yards: string;
    skipYards: boolean;
    execution: number | null;
    result: Result | null;
    missDirection: MissDirection | null;
    shotShape: ShotShape | null;
    shotContact: ShotContact | null;
    shotStart: ShotStart | null;
    targetOffset: TargetOffset | null;
    decisionQuality: DecisionQuality;
    lieOverride: StartLie | null;
    obstruction: Obstruction;
    puttNo: number;
    puttFeet: string;
    puttExec: number | null;
    puttSide: PuttSide | null;
    puttLength: PuttLength | null;
  };
  /** The screen this shot committed from — where back returns you. */
  landStep: Step;
  landPuttPhase: "main" | "miss";
  /** The hole's carry-forward finish before this shot, to restore on rewind. */
  prevLastShot: PrevFinish | null;
  /** Penalty this shot added, to subtract from the hole total on rewind. */
  penalty: number;
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

// Shared step-body styles from the Modern Clubhouse handoff (.q/.tap/.cta).
const Q = "font-heading text-[28px] font-extrabold tracking-[-0.02em]";
const QSUB = "text-[14px] leading-[1.4] text-muted-foreground";
const TAP =
  "w-full rounded-[18px] border-[1.5px] border-input bg-card text-[17px] font-bold text-foreground transition-transform active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40";
const TAP_SEL = "border-primary bg-primary text-white";
// Contact faults (Thin/Chunk) select in clay so the two shape-step axes read apart.
const CONTACT_SEL = "border-clay bg-clay text-white";
const TAP_SOFT = "border-transparent bg-muted text-muted-foreground";
const CTA =
  "flex w-full items-center justify-center gap-2 rounded-[18px] bg-primary text-[17px] font-bold text-white shadow-[0_8px_22px_rgba(21,120,74,0.26)] transition-transform active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40";
const FOOT_LINK =
  "h-11 rounded-[13px] text-[14px] font-semibold text-muted-foreground transition-colors active:bg-muted";

/** Expanded recap row text: "{zone}{miss} · {obx}{+pen} · {dist}" (B5). */
function recapLabel(s: RecapShot): string {
  const zone = s.isPutt ? (s.result === "Make" ? "Holed" : "Putt") : (s.result ?? "—");
  const miss = s.miss ? ` ${s.miss.toLowerCase()}` : "";
  const obx =
    s.obstruction !== "Clear"
      ? ` · ${OBSTRUCTION_COPY[s.obstruction].label.toLowerCase()}`
      : "";
  const pen = s.penalty > 0 ? ` +${s.penalty}` : "";
  const dist =
    s.yardage == null
      ? ""
      : s.isPutt
        ? ` · ${Math.round(s.yardage * 3)}ft`
        : ` · ${Math.round(s.yardage)}yd`;
  return `${zone}${miss}${obx}${pen}${dist}`;
}

/**
 * Severity ramp for the obstruction levels — green → terracotta → red so the two
 * trouble levels never read as one. Maps to the existing theme tokens (positive /
 * clay / destructive) rather than hard-coding the handoff hexes.
 */
const OBSTRUCTION_DOT: Record<Obstruction, string> = {
  Clear: "bg-positive",
  Partial: "bg-clay",
  Blocked: "bg-destructive",
};
/** Tint for the collapsed pill when a non-Clear level is set. */
const OBSTRUCTION_TINT: Record<Obstruction, string> = {
  Clear: "",
  Partial: "border-clay/30 bg-clay/10 text-clay",
  Blocked: "border-destructive/30 bg-destructive/10 text-destructive",
};
/** Border + faint fill for the selected option in the expanded 3-option list. */
const OBSTRUCTION_SELECTED: Record<Obstruction, string> = {
  Clear: "border-positive bg-positive/5",
  Partial: "border-clay bg-clay/5",
  Blocked: "border-destructive bg-destructive/5",
};

export function ShotEntryFlow({
  roundId,
  clubs,
  parByHole,
  yardageByHole,
  clubYardages,
  shotsByHole,
  holeNumbers,
  startingHole,
  initialLogged,
  lastShotByHole,
}: ShotEntryFlowProps) {
  const router = useRouter();

  const [logged, setLogged] = useState<Record<number, HoleLog>>(initialLogged);
  const [localPar, setLocalPar] = useState<Record<number, number>>({});
  const [lastShot, setLastShot] =
    useState<Record<number, PrevFinish | null>>(lastShotByHole);
  // B5 "This hole" recap: shots per hole, seeded from the page + appended on commit.
  const [holeShots, setHoleShots] = useState<Record<number, RecapShot[]>>(
    shotsByHole ?? {},
  );
  const [recapOpen, setRecapOpen] = useState(false);
  // Open on the first unfinished hole at/after the declared starting hole, then
  // fall back to the first unfinished hole overall, then the starting hole (D-13).
  const [hole, setHole] = useState<number>(
    holeNumbers.find((h) => h >= startingHole && !holeDone(initialLogged, h)) ??
      holeNumbers.find((h) => !holeDone(initialLogged, h)) ??
      startingHole ??
      holeNumbers[0],
  );

  // Draft (the shot being entered) ------------------------------------------
  const [step, setStep] = useState<Step>("club");
  const [club, setClub] = useState<string | null>(null);
  const [yards, setYards] = useState<string>("");
  const [skipYards, setSkipYards] = useState(false);
  const [execution, setExecution] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // Ball-flight shape + contact (migration 016). Two orthogonal, optional axes
  // tagged on the dedicated shape step after strike. Null = not recalled / skipped.
  const [shotShape, setShotShape] = useState<ShotShape | null>(null);
  const [shotContact, setShotContact] = useState<ShotContact | null>(null);
  // Flight cause axes (migration 020): start-line + the curve above. Captured on
  // the sequential Contact → Start → Curve steps that replaced the shape step.
  const [shotStart, setShotStart] = useState<ShotStart | null>(null);
  // Outcome direction vs the pin/target — captured on the required offset step
  // that generalized the old miss step (fires on greens too, not only misses).
  const [targetOffset, setTargetOffset] = useState<TargetOffset | null>(null);
  // Decision quality (spec 1A): default Good; the player taps Bad on the result
  // step only for a genuine process error before choosing the result chip.
  const [decisionQuality, setDecisionQuality] = useState<DecisionQuality>("Good");
  // Start lie: `lieOverride` is the player's one-tap override (else the
  // carry-forward default is used). Domino fields default to no-trouble.
  const [lieOverride, setLieOverride] = useState<StartLie | null>(null);
  const [lieOpen, setLieOpen] = useState(false);
  // Obstruction (orthogonal start-state attribute of THIS shot — what was between
  // ball and target on the shot just played). Set on the result step, default
  // Clear (the ~80% case → zero taps). It prices the shot off the Recovery
  // baseline but never constrains the result: a flighted/punched shot can still
  // find the green, go OB, anything. See docs/design/obstruction_capture_brief.md.
  const [obstruction, setObstruction] = useState<Obstruction>("Clear");
  const [obxOpen, setObxOpen] = useState(false);
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

  // Shots committed this session, newest last — the back arrow steps back
  // through these (see HistoryEntry / rewind).
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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
  // Any hole with shots can be wiped and restarted (the redo path).
  const canClear = (holeLog?.count ?? 0) > 0;
  // The just-committed shot is the previous one on this hole → offer a quick edit.
  const editLastEligible =
    lastCommitted != null &&
    lastCommitted.hole === hole &&
    lastCommitted.shotNo === shotNo - 1;
  // The back arrow walks shot sub-steps, then steps back through the session's
  // logged shots. It only exits to the round when sitting at the start of a shot
  // with nothing left to undo (then it reads as a home button).
  const atFlowStart =
    history.length === 0 &&
    (step === "club" || (step === "putt" && puttPhase === "main"));

  // Start-lie default carries forward from the prior shot's finish; the player
  // can override (one tap). Null default = penalty drop / unknown → set it.
  const defaultLie: StartLie | null =
    shotNo === 1 ? "Tee" : nextStartLie(lastShot[hole] ?? null);
  const effectiveLie: StartLie | null = lieOverride ?? defaultLie;

  /**
   * Reset the draft for the next shot. Obstruction resets to Clear — it's tagged
   * per-shot on the result step when something was in the way, not carried over.
   */
  function resetDraft() {
    setClub(null);
    setYards("");
    setSkipYards(false);
    setExecution(null);
    setResult(null);
    setShotShape(null);
    setShotContact(null);
    setShotStart(null);
    setTargetOffset(null);
    setDecisionQuality("Good");
    setLieOverride(null);
    setLieOpen(false);
    setObstruction("Clear");
    setObxOpen(false);
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
    /** Ball-flight shape (curve). Omitted (putts / skipped) → stays null. */
    shotShape?: ShotShape;
    /** Strike fault. Omitted (putts / clean) → stays null. */
    shotContact?: ShotContact;
    /** Ball start-line. Omitted (putts) → stays null. */
    shotStart?: ShotStart;
    /** Where it finished vs the pin/target. Omitted (putts / Make) → null. */
    targetOffset?: TargetOffset;
    puttSide?: PuttSide;
    puttLength?: PuttLength;
    penalty?: number;
    /** Decision quality. Omitted (e.g. putts) → DB default 'Good'. */
    decisionQuality?: DecisionQuality;
    /** This shot's START obstruction. Omitted (e.g. putts) → DB default 'Clear'. */
    obstruction?: Obstruction;
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
    // Carry-forward finish before this shot — restored if the shot is rewound.
    const prevLastShot = lastShot[hole] ?? null;
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
        obstruction: isPutt ? "Clear" : d.obstruction,
        decision_quality: d.decisionQuality,
        execution: d.execution,
        result: d.result,
        miss_direction: d.missDirection,
        shot_shape: d.shotShape,
        shot_contact: d.shotContact,
        shot_start: d.shotStart,
        target_offset: d.targetOffset,
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
      // Append to the "This hole" recap (B5).
      setHoleShots((m) => ({
        ...m,
        [hole]: [
          ...(m[hole] ?? []),
          {
            club: d.club,
            result: d.result ?? null,
            yardage: d.yardage ?? null,
            isPutt,
            miss: d.missDirection ?? null,
            penalty: d.penalty ?? 0,
            obstruction: isPutt ? "Clear" : (d.obstruction ?? "Clear"),
          },
        ],
      }));
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
      // Record the shot so the back arrow can step back into it.
      setHistory((h) => [
        ...h,
        {
          id,
          hole,
          shotNo: sn,
          isPutt,
          draft: {
            club: d.club,
            yards,
            skipYards,
            execution: d.execution ?? null,
            result: d.result ?? null,
            missDirection: d.missDirection ?? null,
            shotShape: d.shotShape ?? null,
            shotContact: d.shotContact ?? null,
            shotStart: d.shotStart ?? null,
            targetOffset: d.targetOffset ?? null,
            decisionQuality: d.decisionQuality ?? "Good",
            lieOverride,
            obstruction: d.obstruction ?? "Clear",
            puttNo,
            puttFeet,
            puttExec,
            puttSide: d.puttSide ?? null,
            puttLength: d.puttLength ?? null,
          },
          // A Make commits from the result step; every other full shot commits
          // from the offset step; putts from the putt screen.
          landStep: isPutt ? "putt" : d.result === "Make" ? "result" : "offset",
          landPuttPhase: isPutt ? puttPhase : "main",
          prevLastShot,
          penalty: d.penalty ?? 0,
        },
      ]);
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
    // A par 4/5 tee shot skips yardage regardless of club: "yards to the hole"
    // is the hole length, known from course geometry (fillTeeDistances backfills
    // it for SG). Includes a re-tee after an OB/Lost penalty (effectiveLie
    // carries "Tee" forward). If the hole's tee yardage is unknown, fall through
    // to the yards step so the distance isn't silently lost.
    const teeNoYardage =
      effectiveLie === "Tee" && (par ?? 0) >= 4 && yardageByHole[hole] != null;
    setSkipYards(teeNoYardage);
    setStep(teeNoYardage ? "strike" : "yards");
  }

  function chooseExecution(e: number) {
    setExecution(e);
    setStep("contact");
  }

  // ── Flight cluster: Contact → Start → Curve, each one tap, auto-advancing ──

  /** Strike contact. "Clean" is the no-fault case → stored as null. */
  function chooseContact(c: ShotContact | null) {
    setShotContact(c);
    setStep("start");
  }

  function chooseStart(s: ShotStart) {
    setShotStart(s);
    setStep("curve");
  }

  function chooseCurve(s: ShotShape) {
    setShotShape(s);
    setStep("result");
  }

  async function chooseResult(r: Result) {
    setResult(r);
    // A holed shot is terminal — no target offset (it's in the hole). Everything
    // else gathers a required target offset next, then commits.
    if (r === "Make") {
      const res = await commitShot({
        club: club!,
        yardage: yards === "" ? undefined : Number(yards),
        execution: execution ?? undefined,
        result: r,
        shotShape: shotShape ?? undefined,
        shotContact: shotContact ?? undefined,
        shotStart: shotStart ?? undefined,
        decisionQuality,
        obstruction,
      });
      if (!res.ok) return;
      completeHole(res.map, res.strokes);
      return;
    }
    setStep("offset");
  }

  /** Required target offset → commit, then advance (Green → putt, else next).
   *  Pass `o` explicitly; the setState above hasn't applied yet this tick. */
  async function chooseOffset(o: TargetOffset) {
    setTargetOffset(o);
    const r = result!;
    const res = await commitShot({
      club: club!,
      yardage: yards === "" ? undefined : Number(yards),
      execution: execution ?? undefined,
      result: r,
      // Keep the legacy single-axis field populated for existing analytics.
      missDirection: MISS_RESULTS.has(r) ? legacyMiss(o) : undefined,
      shotShape: shotShape ?? undefined,
      shotContact: shotContact ?? undefined,
      shotStart: shotStart ?? undefined,
      targetOffset: o,
      penalty: PENALTY_RESULTS.has(r) ? 1 : 0,
      decisionQuality,
      obstruction,
    });
    if (!res.ok) return;
    if (r === "Green") enterPutt();
    else resetDraft();
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
   * Wipe every shot on the current hole and restart it from the tee. The redo
   * path: the wizard appends by shot number, so re-entering a hole that already
   * has shots would duplicate them — clearing first makes "start this hole over"
   * clean. Stays on the hole at shot 1.
   */
  async function handleClearHole() {
    const prev = logged[hole];
    if (!prev || prev.count === 0) return;
    if (submitting.current) return;
    if (
      !window.confirm(
        `Clear all ${prev.count} shot${prev.count === 1 ? "" : "s"} on hole ${hole} and start it over?`,
      )
    )
      return;
    submitting.current = true;
    setBusy(true);
    try {
      await clearHole(roundId, hole);
      setLogged((m) => {
        const next = { ...m };
        delete next[hole];
        return next;
      });
      setLastShot((m) => ({ ...m, [hole]: null }));
      setHoleShots((m) => ({ ...m, [hole]: [] }));
      setLastCommitted(null);
      // Those rows are gone — drop their (now unrewindable) history entries.
      setHistory((h) => h.filter((e) => e.hole !== hole));
      resetDraft();
      toast.success(`Hole ${hole} cleared — start from the tee.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear hole.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  /**
   * Always-available back. Within a shot it walks the sub-steps back; at the
   * start of a shot (club picker / first putt) it steps into the previously
   * logged shot (rewind), and once there's nothing left to undo it exits to the
   * round.
   */
  function back() {
    // Sub-steps of the shot being entered.
    if (step === "yards" || (step === "strike" && skipYards)) return setStep("club");
    if (step === "strike") return setStep("yards");
    if (step === "contact") return setStep("strike");
    if (step === "start") return setStep("contact");
    if (step === "curve") return setStep("start");
    if (step === "result") return setStep("curve");
    if (step === "offset") return setStep("result");
    // Putt miss detail → back to the putt's distance screen.
    if (step === "putt" && puttPhase === "miss") return setPuttPhase("main");
    // Start of a shot: step back into the previously logged shot, else exit.
    void rewind();
  }

  /**
   * Step back into the most recently logged shot: delete its row, restore its
   * values into the draft, and land on the screen it was committed from. The
   * delete keeps the round consistent (no orphan row, shot numbers stay
   * contiguous) and re-advancing re-inserts the shot. With nothing left in the
   * session's history, the back arrow exits to the round.
   */
  async function rewind() {
    const entry = history[history.length - 1];
    if (!entry) {
      router.push(`/rounds/${roundId}`);
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await deleteShot(entry.id, roundId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to step back.");
      submitting.current = false;
      setBusy(false);
      return;
    }
    // Un-commit locally: drop the shot from the hole's count, recap and history,
    // and restore the carry-forward finish it had overwritten.
    setLogged((m) => {
      const cur = m[entry.hole];
      if (!cur) return m;
      return {
        ...m,
        [entry.hole]: {
          count: Math.max(0, cur.count - 1),
          complete: false,
          conceded: cur.conceded,
          penalties: Math.max(0, cur.penalties - entry.penalty),
        },
      };
    });
    setHoleShots((m) => {
      const arr = m[entry.hole];
      if (!arr?.length) return m;
      return { ...m, [entry.hole]: arr.slice(0, -1) };
    });
    setLastShot((m) => ({ ...m, [entry.hole]: entry.prevLastShot }));
    setHistory((h) => h.slice(0, -1));
    setLastCommitted(null);
    // Restore the draft and land on the screen the shot was committed from.
    setHole(entry.hole);
    setClub(entry.draft.club);
    setYards(entry.draft.yards);
    setSkipYards(entry.draft.skipYards);
    setExecution(entry.draft.execution);
    setResult(entry.draft.result);
    setShotShape(entry.draft.shotShape);
    setShotContact(entry.draft.shotContact);
    setShotStart(entry.draft.shotStart);
    setTargetOffset(entry.draft.targetOffset);
    setDecisionQuality(entry.draft.decisionQuality);
    setLieOverride(entry.draft.lieOverride);
    setLieOpen(false);
    setObstruction(entry.draft.obstruction);
    setObxOpen(false);
    setPuttNo(entry.draft.puttNo);
    setPuttFeet(entry.draft.puttFeet);
    setPuttExec(entry.draft.puttExec);
    setPuttSide(entry.draft.puttSide);
    setPuttLength(entry.draft.puttLength);
    setPuttPhase(entry.landPuttPhase);
    setStep(entry.landStep);
    submitting.current = false;
    setBusy(false);
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
      // Keep the recap (B5) in sync — the edited shot is the hole's last.
      setHoleShots((m) => {
        const arr = m[h];
        if (!arr || arr.length === 0) return m;
        const next = arr.slice();
        next[next.length - 1] = {
          club: values.club!,
          result: values.result,
          yardage: values.yardage,
          isPutt: values.club === "Putter",
          miss: values.missDirection,
          penalty: values.penalty ?? 0,
          // Obstruction isn't editable in the quick-edit form — preserve it.
          obstruction: arr[arr.length - 1].obstruction,
        };
        return { ...m, [h]: next };
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

  // The three flight sub-steps collapse to one "flight" dot; the offset step
  // sits under "result" so the bar stays at five legible milestones.
  const STEP_ORDER = ["club", "yards", "strike", "flight", "result"] as const;
  const stepperIdx = (() => {
    if (step === "contact" || step === "start" || step === "curve") return 3;
    if (step === "offset") return 4;
    return STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number]);
  })();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 pb-[30px] pt-5">
      {/* Context header */}
      <div className="mb-[18px] flex items-center gap-3">
        <button
          type="button"
          onClick={back}
          aria-label={atFlowStart ? "Exit to round" : "Back"}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-muted text-[20px] text-ink-700 transition-transform active:scale-[0.94]"
        >
          {atFlowStart ? "⌂" : "←"}
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[23px] font-extrabold leading-none tracking-[-0.02em]">
            Hole {hole}
          </h2>
          {par !== null && (
            <p className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Par {par}
              {yardageByHole[hole] != null && (
                <span className="text-ink-300"> · {yardageByHole[hole]} yd</span>
              )}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {holesPlayed > 0 && (
            <p
              className={cn(
                "font-mono text-[20px] font-extrabold leading-none tabular-nums",
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
          <p className="mt-[5px] font-mono text-[10px] font-semibold uppercase tracking-[0.03em] text-muted-foreground">
            {holesPlayed > 0 ? `thru ${holesPlayed} · ` : ""}shot {shotNo}
          </p>
        </div>
      </div>

      {/* Stepper (hidden in putt mode) */}
      {step !== "putt" && (
        <div className="mb-4 flex gap-2">
          {STEP_ORDER.map((s, i) => {
            const isYards = s === "yards";
            const muted = isYards && skipYards;
            return (
              <div key={s} className="flex flex-1 flex-col items-center gap-[7px]">
                <span
                  className={cn(
                    "h-[5px] w-full rounded-full",
                    i < stepperIdx
                      ? "bg-primary"
                      : i === stepperIdx
                      ? "bg-highlight"
                      : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "font-mono text-[9px] font-semibold uppercase tracking-[0.06em]",
                    i === stepperIdx
                      ? "text-foreground"
                      : i < stepperIdx
                      ? "text-primary"
                      : muted
                      ? "text-ink-300 line-through opacity-55"
                      : "text-ink-300",
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
        <div className="mb-[14px]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLieOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-full bg-muted px-[14px] py-2 transition-colors"
            >
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                Lie
              </span>
              <span className="text-[14px] font-semibold">{effectiveLie ?? "Set lie"}</span>
              {lieOverride && (
                <span className="font-mono text-[9px] uppercase tracking-[0.04em] text-clay">edited</span>
              )}
              <span className="text-[11px] text-muted-foreground">▾</span>
            </button>
          </div>
          {lieOpen && (
            <div className="mt-[10px] grid grid-cols-3 gap-2">
              {OVERRIDE_LIES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLieOverride(l);
                    setLieOpen(false);
                  }}
                  className={cn(
                    "h-[42px] rounded-[13px] border-[1.5px] text-[12.5px] font-semibold transition-transform active:scale-[0.96]",
                    effectiveLie === l
                      ? "border-primary bg-primary text-white"
                      : "border-input bg-card text-ink-700",
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
      <div className="-mx-5 mb-[22px] overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2">
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
                  "h-[38px] w-[38px] shrink-0 rounded-[12px] bg-muted font-mono text-[13px] font-semibold tabular-nums transition-transform active:scale-[0.92]",
                  isCurrent
                    ? "bg-primary text-white"
                    : l?.complete
                    ? "text-muted-foreground ring-[1.5px] ring-inset ring-fairway-300"
                    : l?.conceded
                    ? "text-ink-300 line-through ring-[1.5px] ring-inset ring-input"
                    : l?.count
                    ? "text-foreground ring-[1.5px] ring-inset ring-input"
                    : "text-ink-300",
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
        <div className="mb-[14px] flex flex-col gap-2">
          <span className="eyebrow">Par</span>
          <div className="flex gap-2.5">
            {([3, 4, 5] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setLocalPar({ ...localPar, [hole]: p })}
                className={cn(TAP, "h-[52px] flex-1", par === p && TAP_SEL)}
              >
                Par {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Steps ─────────────────────────────────────────────────────────── */}

      {step === "club" && par !== null && (
        <div className="step flex flex-col gap-2.5">
          <h3 className={cn(Q, "mb-1.5")}>Which club?</h3>
          {clubs.includes("D") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => chooseClub("D")}
              className={cn(TAP, "h-[64px] text-[18px]")}
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
                  className={cn(TAP, "h-[58px] font-mono text-[18px] font-semibold")}
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
              className={cn(TAP, "h-[64px] text-[18px]")}
            >
              Putter
            </button>
          )}

          {/* B5: "This hole" recap — collapsed club tokens / expanded shot list,
              with Edit on the last (just-committed) shot only. */}
          {(holeShots[hole]?.length ?? 0) > 0 && (
            <div className="mt-3.5 overflow-hidden rounded-[16px] bg-muted">
              <button
                type="button"
                onClick={() => setRecapOpen((o) => !o)}
                className="flex w-full items-center gap-2.5 px-3.5 py-[11px]"
              >
                <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  This hole
                </span>
                <span className="flex flex-1 flex-wrap justify-end gap-1.5">
                  {holeShots[hole]!.map((s, i) => (
                    <span
                      key={i}
                      className={cn(
                        "rounded-md bg-card px-1.5 py-[3px] font-mono text-[10px] font-semibold leading-none",
                        s.penalty > 0 ? "text-clay" : "text-ink-700",
                        s.obstruction !== "Clear" && "ring-1 ring-inset ring-destructive/50",
                      )}
                    >
                      {s.isPutt ? "P" : s.club}
                    </span>
                  ))}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[11px] text-muted-foreground transition-transform",
                    recapOpen && "rotate-180",
                  )}
                >
                  ▾
                </span>
              </button>
              {recapOpen && (
                <div className="px-3.5 pb-2.5">
                  {holeShots[hole]!.map((s, i, arr) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 border-t border-border py-[9px]"
                    >
                      <span className="w-[18px] shrink-0 text-center text-[12px] font-semibold text-ink-300">
                        {i + 1}
                      </span>
                      <span className="w-[34px] shrink-0 text-[13px] font-semibold">
                        {s.isPutt ? "Putt" : s.club}
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] text-ink-700">
                        {recapLabel(s)}
                      </span>
                      {i === arr.length - 1 && editLastEligible && (
                        <button
                          type="button"
                          onClick={() => setEditingLast(true)}
                          className="shrink-0 rounded-full bg-card px-3 py-1.5 text-[12px] font-bold text-primary transition-transform active:scale-95"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pick up / Clear / Done — shown at the start of a shot. Pick up
              concedes the hole (≠ Done, which just exits the flow). */}
          <div className="mt-2 flex flex-col gap-2">
            {canPickUp && (
              <button
                type="button"
                onClick={handlePickUp}
                disabled={busy}
                className={FOOT_LINK}
              >
                Pick up
              </button>
            )}
            {canClear && (
              <button
                type="button"
                onClick={handleClearHole}
                disabled={busy}
                className={cn(FOOT_LINK, "text-clay active:bg-clay/10")}
              >
                Clear hole &amp; restart
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push(`/rounds/${roundId}`)}
              className={FOOT_LINK}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {step === "yards" && (
        <div className="step flex flex-col gap-4">
          <h3 className={Q}>How far?</h3>
          <div className="text-center">
            <div className="font-heading text-[64px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
              {yards === "" ? "—" : yards}
            </div>
            <div className="mt-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              yards to the hole
            </div>
          </div>
          {/* B3 smart yardage: one-tap chips for the player's most-typical
              distances with this club (career history, most common first). */}
          {club != null && (clubYardages[club]?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                Typical {club}
              </span>
              {clubYardages[club]!.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setYards(String(v))}
                  className={cn(
                    "h-[38px] rounded-full border-[1.5px] px-4 font-mono text-[15px] font-semibold tabular-nums transition-transform active:scale-[0.95]",
                    String(v) === yards
                      ? "border-primary bg-primary text-white"
                      : "border-input bg-card text-ink-700",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setYards((y) => (y.length < 3 ? (y + k).replace(/^0+/, "") : y))}
                className="h-[52px] rounded-[18px] bg-muted font-mono text-[24px] font-semibold transition-transform active:scale-[0.95]"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setYards("")}
              className="h-[52px] rounded-[18px] bg-muted font-mono text-[14px] text-muted-foreground transition-transform active:scale-[0.95]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setYards((y) => (y.length < 3 ? (y + "0").replace(/^0+/, "") : y))}
              className="h-[52px] rounded-[18px] bg-muted font-mono text-[24px] font-semibold transition-transform active:scale-[0.95]"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setYards((y) => y.slice(0, -1))}
              className="h-[52px] rounded-[18px] bg-muted font-mono text-[14px] text-muted-foreground transition-transform active:scale-[0.95]"
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
              className={cn(TAP, TAP_SOFT, "h-[56px] flex-1 text-[16px]")}
            >
              No yardage
            </button>
            <button
              type="button"
              onClick={() => setStep("strike")}
              className={cn(CTA, "h-[56px] flex-1 text-[16px]")}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {step === "strike" && (
        <div className="step flex flex-col">
          <h3 className={cn(Q, "mb-1")}>How&apos;d you strike it?</h3>
          <p className={cn(QSUB, "mb-4")}>Your honest 1–4 quality rating.</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2, 3, 4].map((e) => (
              <button
                key={e}
                type="button"
                disabled={busy}
                onClick={() => chooseExecution(e)}
                className={cn(TAP, "flex h-[84px] flex-col items-center justify-center gap-1")}
              >
                <span className="font-mono text-[26px] font-extrabold">{e}</span>
                <span className="text-[13px] font-semibold text-muted-foreground">
                  {EXEC_LABELS[e - 1]}
                </span>
              </button>
            ))}
          </div>
          {/* B2: leave a shot unrated rather than forcing a guess. */}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setExecution(null);
              setStep("contact");
            }}
            className="mt-4 block w-full text-[14px] font-semibold text-muted-foreground underline underline-offset-[3px]"
          >
            Skip — don&apos;t rate this one
          </button>
        </div>
      )}

      {step === "contact" && (
        <div className="step flex flex-col">
          <h3 className={cn(Q, "mb-1")}>How&apos;d you catch it?</h3>
          <p className={cn(QSUB, "mb-6")}>Thin, clean, or fat.</p>
          <div className="grid grid-cols-3 gap-2.5">
            {([
              { label: "Thin", value: "Thin" as ShotContact | null },
              { label: "Clean", value: null },
              { label: "Fat", value: "Chunk" as ShotContact | null },
            ]).map((c) => {
              const selected = shotContact === c.value;
              return (
                <button
                  key={c.label}
                  type="button"
                  disabled={busy}
                  onClick={() => chooseContact(c.value)}
                  className={cn(
                    TAP,
                    "h-[84px] text-[16px]",
                    selected && (c.value === null ? TAP_SEL : CONTACT_SEL),
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "start" && (
        <div className="step flex flex-col">
          <h3 className={cn(Q, "mb-1")}>Where&apos;d it start?</h3>
          <p className={cn(QSUB, "mb-6")}>Its line off the club face.</p>
          <div className="grid grid-cols-3 gap-2.5">
            {SHOT_STARTS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => chooseStart(s)}
                className={cn(TAP, "h-[84px] text-[16px]", shotStart === s && TAP_SEL)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "curve" && (
        <div className="step flex flex-col">
          <h3 className={cn(Q, "mb-1")}>How&apos;d it curve?</h3>
          <p className={cn(QSUB, "mb-6")}>The shape in the air.</p>
          <div className="grid grid-cols-5 gap-2">
            {SHOT_SHAPES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => chooseCurve(s)}
                className={cn(TAP, "h-[88px] px-0.5 text-[13px]", shotShape === s && TAP_SEL)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "result" && (
        <div className="step flex flex-col">
          <h3 className={cn(Q, "mb-4")}>Where&apos;d it end up?</h3>

          {/* Decision quality (spec 1A): one tap, default Good. Flag Bad only for
              a process error (risk / club / line / didn't commit) — not a good
              play that drew a bad result. Set before tapping the result chip. */}
          <div className="mb-4 flex items-center justify-between gap-3 px-0.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-bold">Decision</span>
              <span className="text-[11.5px] text-muted-foreground">
                Tap Bad only for a thinking mistake
              </span>
            </div>
            <div className="flex rounded-full bg-muted p-[3px]">
              {DECISION_QUALITIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy}
                  onClick={() => setDecisionQuality(d)}
                  className={cn(
                    "h-[34px] rounded-full px-4 text-[13px] font-bold transition-colors",
                    decisionQuality === d
                      ? d === "Bad"
                        ? "bg-clay text-white"
                        : "bg-primary text-white"
                      : "text-muted-foreground",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Obstruction (a peer of Decision): the start-state of the shot just
              played — what was between ball and target. Prices the shot off the
              Recovery baseline, but never constrains the result below (a flighted
              shot can still find the green or go OB). Progressive disclosure —
              zero taps when Clear (the ~80% case), one deliberate tap otherwise. */}
          <div className="mb-4">
            <div className="flex items-center justify-between gap-3 px-0.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-bold">Obstruction</span>
                <span className="text-[11.5px] text-muted-foreground">
                  Only if something forced an abnormal shot.
                </span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setObxOpen((o) => !o)}
                aria-expanded={obxOpen}
                className={cn(
                  "inline-flex h-[34px] items-center gap-2 rounded-full border-[1.5px] px-[14px] text-[13px] font-bold transition-colors",
                  obstruction === "Clear"
                    ? "border-input bg-card text-muted-foreground"
                    : OBSTRUCTION_TINT[obstruction],
                )}
              >
                {obstruction !== "Clear" && (
                  <span className={cn("h-2 w-2 rounded-full", OBSTRUCTION_DOT[obstruction])} />
                )}
                {OBSTRUCTION_COPY[obstruction].label}
                <span className="text-[10px] opacity-70">▾</span>
              </button>
            </div>
            {obxOpen && (
              <div className="mt-3 flex flex-col gap-2">
                {OBSTRUCTION.map((o) => (
                  <button
                    key={o}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setObstruction(o);
                      setObxOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-[13px] border-[1.5px] px-3.5 py-3 text-left transition-transform active:scale-[0.98]",
                      obstruction === o ? OBSTRUCTION_SELECTED[o] : "border-input bg-card",
                    )}
                  >
                    <span
                      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", OBSTRUCTION_DOT[o])}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[14.5px] font-bold">
                        {OBSTRUCTION_COPY[o].label}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {OBSTRUCTION_COPY[o].hint}
                      </span>
                    </span>
                    {obstruction === o && (
                      <span className="ml-auto shrink-0 text-[14px] font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {RESULT_GRID.map((r) => {
              // Obstruction describes the shot's start, not its finish, so every
              // result stays available — a flighted/punched shot can end anywhere.
              // Unplayable is the odd one out (9 items) → full width.
              const orphan = r === "Unplayable";
              return (
                <button
                  key={r}
                  type="button"
                  disabled={busy}
                  onClick={() => chooseResult(r)}
                  className={cn(TAP, "relative h-[58px] text-[16px]", orphan && "col-span-2")}
                >
                  {r}
                  {PENALTY_RESULTS.has(r) && (
                    <span className="ml-0.5 align-super font-mono text-[9px] font-semibold text-clay">
                      +1
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              disabled={busy}
              onClick={() => chooseResult("Make")}
              className={cn(CTA, "col-span-2 h-[58px] text-[16px]")}
            >
              <span className="h-2 w-2 rounded-full bg-highlight" />
              Holed it
            </button>
          </div>
        </div>
      )}

      {step === "offset" && (
        offsetIsSideOnly(effectiveLie, par) ? (
          <div className="step flex flex-col">
            <h3 className={cn(Q, "mb-1")}>Which side?</h3>
            <p className={cn(QSUB, "mb-4")}>Where it finished off the tee.</p>
            <div className="grid grid-cols-3 gap-2.5">
              {OFFSET_SIDE.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={busy}
                  onClick={() => chooseOffset(o.value)}
                  className={cn(
                    TAP,
                    "h-[84px] text-[16px]",
                    o.value === "Center" && "text-muted-foreground",
                    targetOffset === o.value && TAP_SEL,
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="step flex flex-col">
            <h3 className={cn(Q, "mb-1")}>Where vs the pin?</h3>
            <p className={cn(QSUB, "mb-4")}>Tap where it finished. Center = at it.</p>
            <div className="grid grid-cols-3 gap-2.5">
              {OFFSET_GRID.map((o) => {
                const isCenter = o.value === "Center";
                return (
                  <button
                    key={o.value}
                    type="button"
                    disabled={busy}
                    onClick={() => chooseOffset(o.value)}
                    className={cn(
                      TAP,
                      "flex h-[80px] items-center justify-center px-0.5 text-center text-[13px] leading-tight",
                      isCenter && "border-dashed text-muted-foreground",
                      targetOffset === o.value && TAP_SEL,
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        )
      )}

      {step === "putt" && (
        <div className="step flex flex-col gap-3.5">
          <h3 className={Q}>
            {puttNo === 1 ? "First putt" : puttNo === 2 ? "Second putt" : `Putt ${puttNo}`}
          </h3>

          {puttPhase === "main" ? (
            <>
              <p className={cn(QSUB, "-mt-2")}>
                How far, in feet? (step off long ones — a pace ≈ 3 ft)
              </p>
              <div className="text-center">
                <div className="font-heading text-[50px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
                  {puttFeet === "" ? "—" : puttFeet}
                  <span className="ml-1.5 align-baseline text-[22px] font-bold text-muted-foreground">
                    ft
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      setPuttFeet((f) => (f.length < 2 ? (f + k).replace(/^0+/, "") : f))
                    }
                    className="h-[46px] rounded-[18px] bg-muted font-mono text-[20px] font-semibold transition-transform active:scale-[0.95]"
                  >
                    {k}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPuttFeet("")}
                  className="h-[46px] rounded-[18px] bg-muted font-mono text-[14px] text-muted-foreground transition-transform active:scale-[0.95]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPuttFeet((f) => (f.length < 2 ? (f + "0").replace(/^0+/, "") : f))
                  }
                  className="h-[46px] rounded-[18px] bg-muted font-mono text-[20px] font-semibold transition-transform active:scale-[0.95]"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPuttFeet((f) => f.slice(0, -1))}
                  className="h-[46px] rounded-[18px] bg-muted font-mono text-[14px] text-muted-foreground transition-transform active:scale-[0.95]"
                >
                  ⌫
                </button>
              </div>
              {/* Optional strike rating — putts are on the green; this keeps the
                  flow fast (tap if you want it) but lets you rate the stroke. */}
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Strike
                </span>
                <span className="flex-1 text-[11px] text-ink-300">optional</span>
                <div className="grid w-[188px] shrink-0 grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setPuttExec((cur) => (cur === e ? null : e))}
                      className={cn(
                        "h-[40px] rounded-[12px] border-[1.5px] font-mono text-[15px] font-semibold transition-transform active:scale-[0.95]",
                        puttExec === e
                          ? "border-primary bg-primary text-white"
                          : "border-input bg-card",
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
                  className={cn(TAP, "h-[64px] text-[18px]")}
                >
                  Missed
                </button>
                <button
                  type="button"
                  disabled={busy || puttFeet === ""}
                  onClick={holePutt}
                  className={cn(CTA, "h-[64px] text-[18px]")}
                >
                  <span className="h-2 w-2 rounded-full bg-highlight" />
                  Holed it
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Rare: a Texas-wedge / chip with the putter — log normally.
                  setStep("club");
                }}
                className="mt-4 block w-full text-[14px] font-semibold text-muted-foreground underline underline-offset-[3px]"
              >
                Putted off the green?
              </button>
              {/* Pick up — the putt screen is the start of a putt (no club step
                  to host the footer), so surface it here too. Concedes the hole. */}
              {canPickUp && (
                <button
                  type="button"
                  onClick={handlePickUp}
                  disabled={busy}
                  className={FOOT_LINK}
                >
                  Pick up
                </button>
              )}
            </>
          ) : (
            <>
              <p className={cn(QSUB, "-mt-2")}>
                Putt miss — material only. Skip if it was close.
              </p>
              <div className="flex flex-col gap-2">
                <span className="eyebrow">Side</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {PUTT_SIDES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPuttSide((cur) => (cur === s ? null : s))}
                      className={cn(TAP, "h-[58px] text-[16px]", puttSide === s && TAP_SEL)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="eyebrow">Length</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {PUTT_LENGTHS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setPuttLength((cur) => (cur === l ? null : l))}
                      className={cn(TAP, "h-[58px] text-[16px]", puttLength === l && TAP_SEL)}
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
                className={cn(CTA, "mt-1 h-[58px] text-[16px]")}
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
