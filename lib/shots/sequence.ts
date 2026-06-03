/**
 * Shot-number sequencing helpers (pure).
 *
 * Score on a hole is `max(shot_no) + penalties`, so shot numbers must stay a
 * contiguous 1..n sequence — a gap inflates the score (the exact bug seen in
 * the imported 05-21 hole 6). When a shot is deleted, the remaining shots are
 * renumbered with this helper.
 */

export interface SeqShot {
  id: string;
  shot_no: number;
}

/**
 * Given the shots remaining on a hole (any order), return the minimal set of
 * `{ id, shot_no }` updates that make the shot numbers a contiguous 1..n
 * sequence. Updates are ordered ascending by target shot number so they can be
 * applied one-by-one without ever colliding on the (round_id, hole, shot_no)
 * unique constraint (targets are always ≤ the current number).
 */
export function renumberContiguous(shots: readonly SeqShot[]): SeqShot[] {
  const sorted = [...shots].sort((a, b) => a.shot_no - b.shot_no);
  const updates: SeqShot[] = [];
  sorted.forEach((s, i) => {
    const target = i + 1;
    if (s.shot_no !== target) updates.push({ id: s.id, shot_no: target });
  });
  return updates;
}
