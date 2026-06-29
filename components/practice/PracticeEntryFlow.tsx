"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { HomeIcon, MinusIcon, PlusIcon, CheckIcon, CalendarIcon } from "lucide-react";
import type { PracticeGame } from "@/lib/practice/games";
import { gamePar } from "@/lib/practice/games";
import { scoreGame } from "@/lib/practice/scoring";
import { createPracticeSession } from "@/actions/practice";
import { fmtVsPar, fmtSg } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const STROKE_MIN = 1;
const STROKE_MAX = 15;

/**
 * Light practice-game entry (DL-022). The core insight: SG to hole-out needs
 * only the start state (from the game registry) + the strokes taken, so entry is
 * one stepper per ball — no shot-by-shot. The card's score-to-par and SG form
 * live as you tap, so the number to beat is visible before you save. Putts /
 * finish are deliberately omitted to keep it fast (optional color, can add later).
 */
export function PracticeEntryFlow({ game }: { game: PracticeGame }) {
  const router = useRouter();
  const [playedOn, setPlayedOn] = useState(todayString());
  // strokes[stationIndex][ballIndex], seeded at par so a clean card is zero taps.
  const [strokes, setStrokes] = useState<number[][]>(() =>
    game.stations.map((st) => Array.from({ length: st.balls }, () => game.parPerBall)),
  );
  const [saving, setSaving] = useState(false);

  const score = useMemo(() => scoreGame(game, strokes), [game, strokes]);

  function bump(si: number, bi: number, delta: number) {
    setStrokes((prev) =>
      prev.map((station, s) =>
        s === si
          ? station.map((v, b) =>
              b === bi ? Math.min(STROKE_MAX, Math.max(STROKE_MIN, v + delta)) : v,
            )
          : station,
      ),
    );
  }

  async function save() {
    setSaving(true);
    try {
      const results = strokes.flatMap((station, si) =>
        station.map((s, bi) => ({ station_index: si, ball_index: bi, strokes: s })),
      );
      await createPracticeSession({ game_id: game.id, played_on: playedOn, results });
      toast.success("Session logged");
      router.push(`/practice?game=${game.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 p-6 pb-32">
      {/* Focused flow has no bottom bar, so it carries its own escape. */}
      <Link
        href="/practice"
        aria-label="Back to practice"
        className="flex size-11 items-center justify-center rounded-xl border-[1.5px] border-input bg-card text-foreground shadow-sm transition-colors hover:border-ink-300"
      >
        <HomeIcon className="size-5" />
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{game.name}</h1>
        <p className="text-sm text-muted-foreground">
          Enter the strokes you took on each ball. Everything else is computed.
        </p>
      </div>

      {/* Date — bare native date input inside a flex card (min-w-0), so it
          flexes to fit and can't overflow on iOS WebKit (the round-form fix). */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Date
        </span>
        <div className="flex min-h-12 items-center gap-3 rounded-xl border-[1.5px] border-input bg-card px-4 shadow-sm transition-colors focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15 hover:border-ink-300">
          <CalendarIcon className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="date"
            aria-label="Date"
            value={playedOn}
            onChange={(e) => setPlayedOn(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none"
          />
        </div>
      </div>

      {/* Live score-to-par + SG as the card forms. */}
      <div className="sticky top-2 z-10 flex items-center justify-between rounded-2xl border border-border bg-fairway-900 px-5 py-3 text-[#EAF1EC] shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#EAF1EC]/70">
          Running score
        </span>
        <span className="flex items-baseline gap-3">
          <span className="font-heading text-3xl font-bold leading-none">
            {fmtVsPar(score.scoreToPar)}
          </span>
          <span className="text-sm text-[#EAF1EC]/80">
            {score.strokes}/{gamePar(game)}
            {score.sg != null && ` · ${fmtSg(score.sg)} SG`}
          </span>
        </span>
      </div>

      {game.stations.map((station, si) => (
        <section key={si} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-heading text-lg font-bold">{station.yards} yards</h2>
            <span className="text-xs text-muted-foreground">
              {station.lie} · {station.balls} balls
            </span>
          </div>
          <div className="space-y-2.5">
            {strokes[si].map((value, bi) => (
              <div key={bi} className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Ball {bi + 1}</span>
                <div className="flex items-center gap-3">
                  <Stepper
                    onClick={() => bump(si, bi, -1)}
                    disabled={value <= STROKE_MIN}
                    label={`Decrease ball ${bi + 1}`}
                  >
                    <MinusIcon className="size-4" strokeWidth={2.5} />
                  </Stepper>
                  <span
                    className={cn(
                      "w-8 text-center font-heading text-xl font-bold tabular-nums",
                      value > game.parPerBall
                        ? "text-destructive"
                        : value < game.parPerBall
                          ? "text-positive"
                          : "text-foreground",
                    )}
                  >
                    {value}
                  </span>
                  <Stepper
                    onClick={() => bump(si, bi, 1)}
                    disabled={value >= STROKE_MAX}
                    label={`Increase ball ${bi + 1}`}
                  >
                    <PlusIcon className="size-4" strokeWidth={2.5} />
                  </Stepper>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <Button onClick={save} disabled={saving} size="lg" className="h-12 w-full text-base">
        <CheckIcon className="size-5" strokeWidth={2.25} />
        {saving ? "Saving…" : "Log session"}
      </Button>
    </main>
  );
}

function Stepper({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full border-[1.5px] border-input bg-card text-foreground transition-colors hover:border-ink-300 active:scale-95 disabled:opacity-30 motion-reduce:transition-none"
    >
      {children}
    </button>
  );
}
