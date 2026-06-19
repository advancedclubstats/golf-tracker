import { notFound } from "next/navigation";
import { getRound } from "@/lib/db/rounds";
import { getShotsByRound } from "@/lib/db/shots";
import { getCourseHoles, getTeeYardages } from "@/lib/db/courses";
import { getClubNames } from "@/lib/db/clubs";
import { aggregateByRoundHole, totalPenalties } from "@/lib/analytics/core";
import { SESSION_HOLE_COUNTS } from "@/lib/constants";
import type { PrevFinish } from "@/lib/shots/lie";
import { ShotEntryFlow, type HoleLog, type RecapShot } from "./ShotEntryFlow";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function LogPage({ params }: Props) {
  const { id } = await params;
  // getRound is scoped to the caller, so a visitor only resolves their own
  // sandbox round (owner rounds → notFound for them, and vice-versa).
  const round = await getRound(id);
  if (!round) notFound();

  const [shots, courseHoles, teeYardages, clubs] = await Promise.all([
    getShotsByRound(id),
    round.course_id ? getCourseHoles(round.course_id) : Promise.resolve([]),
    round.tee_id ? getTeeYardages([round.tee_id]) : Promise.resolve([]),
    getClubNames(),
  ]);

  // Known par per hole: course pars preferred, then any already-logged shot's par.
  const parByHole: Record<number, number> = {};
  for (const h of courseHoles) parByHole[h.hole_number] = h.par;

  // Tee yardage per hole for the round's tee — shown as on-course reference.
  const yardageByHole: Record<number, number> = {};
  for (const y of teeYardages) yardageByHole[y.hole_number] = y.yardage;

  // Per-hole progress so the flow can resume and skip completed holes, plus the
  // last shot per hole to seed the start-lie carry-forward on resume.
  const initialLogged: Record<number, HoleLog> = {};
  const lastShotByHole: Record<number, PrevFinish | null> = {};
  const shotsByHole: Record<number, RecapShot[]> = {};
  for (const rh of aggregateByRoundHole(shots)) {
    initialLogged[rh.hole] = {
      count: rh.lastShotNo,
      complete: rh.complete,
      conceded: rh.conceded,
      penalties: totalPenalties(rh.shots),
    };
    shotsByHole[rh.hole] = rh.shots.map((s) => ({
      club: s.club,
      result: s.result,
      yardage: s.yardage,
      isPutt: s.club === "Putter",
      miss: s.miss_direction,
      penalty: s.penalty ?? 0,
      obstruction: s.obstruction,
    }));
    const last = rh.shots[rh.shots.length - 1];
    lastShotByHole[rh.hole] = last
      ? {
          result: last.result,
          club: last.club,
          yardage: last.yardage,
          startLie: last.start_lie,
        }
      : null;
    if (parByHole[rh.hole] == null) parByHole[rh.hole] = rh.par;
  }

  const holeNumbers =
    courseHoles.length > 0
      ? courseHoles.map((h) => h.hole_number)
      : Array.from(
          { length: SESSION_HOLE_COUNTS[round.session_type] },
          (_, i) => i + 1,
        );

  return (
    <ShotEntryFlow
      roundId={id}
      clubs={clubs}
      parByHole={parByHole}
      yardageByHole={yardageByHole}
      shotsByHole={shotsByHole}
      holeNumbers={holeNumbers}
      startingHole={round.starting_hole}
      initialLogged={initialLogged}
      lastShotByHole={lastShotByHole}
    />
  );
}
