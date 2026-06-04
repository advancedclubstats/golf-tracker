import { notFound } from "next/navigation";
import { getRound } from "@/lib/db/rounds";
import { getShotsByRound } from "@/lib/db/shots";
import { getCourseHoles } from "@/lib/db/courses";
import { getClubNames } from "@/lib/db/clubs";
import { aggregateByRoundHole, totalPenalties } from "@/lib/analytics/core";
import { SESSION_HOLE_COUNTS } from "@/lib/constants";
import { ShotEntryFlow, type HoleLog } from "./ShotEntryFlow";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function LogPage({ params }: Props) {
  const { id } = await params;
  const round = await getRound(id);
  if (!round) notFound();

  const [shots, courseHoles, clubs] = await Promise.all([
    getShotsByRound(id),
    round.course_id ? getCourseHoles(round.course_id) : Promise.resolve([]),
    getClubNames(),
  ]);

  // Known par per hole: course pars preferred, then any already-logged shot's par.
  const parByHole: Record<number, number> = {};
  for (const h of courseHoles) parByHole[h.hole_number] = h.par;

  // Per-hole progress so the flow can resume and skip completed holes.
  const initialLogged: Record<number, HoleLog> = {};
  for (const rh of aggregateByRoundHole(shots)) {
    initialLogged[rh.hole] = {
      count: rh.lastShotNo,
      complete: rh.complete,
      conceded: rh.conceded,
      penalties: totalPenalties(rh.shots),
    };
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
      holeNumbers={holeNumbers}
      initialLogged={initialLogged}
    />
  );
}
