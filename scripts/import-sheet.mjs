/**
 * P6-T1 — Google Sheet → Supabase import (one-off, re-runnable).
 *
 * Parses a CSV export of the `Shots` tab, applies the agreed data corrections,
 * validates every row, and builds plain `rounds` + `shots` objects ready to
 * insert. Importable (`buildImport`) and runnable as a CLI (emits SQL).
 *
 * CLI:   node scripts/import-sheet.mjs <csv> > /tmp/import.sql
 * Exec:  node scripts/run-import.mjs <csv>      (inserts via Supabase)
 *
 * Agreed transforms (confirmed with the user, 2026-06):
 *   - L60  2026-05-07 h6  s3: Result '' → 'Green', Miss 'Green' → '' (column swap)
 *   - L89  2026-05-07 h13 s3: Result 'Short' → '', Miss '' → 'Short'
 *   - L108 2026-05-07 h18 s1: Result 'Long'  → '', Miss '' → 'Long'
 *   - 2026-05-21 h6: shot numbers [1,3,4,5] renumbered to [1,2,3,4] (scores par)
 *   - Mulligan 'Y' → true; blank execution/yardage/result/etc. → null; penalty blank → 0
 *   - session_type: 18 holes → Full18, 9 → Practice9, 6 → Practice6, 3 → Practice3
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

export const V1_USER_ID = "1b3a0171-726e-4c64-a8e0-f97a717f2851";

const CLUBS = new Set(["D","3W","5W","4i","5i","6i","7i","8i","9i","PW","GW","SW","LW","Putter"]);
const RESULTS = new Set(["Fairway","Green","Rough","Bunker","OB","Hazard","Lost","Unplayable","Make"]);
const MISS = new Set(["Left","Right","Long","Short"]);
const SIDES = new Set(["High","Low"]);
const LENGTHS = new Set(["Short","Long"]);
const SESSION_BY_HOLES = { 18: "Full18", 9: "Practice9", 6: "Practice6", 3: "Practice3" };

const str = (v) => (v === "" || v == null ? null : v);
const num = (v) => (v === "" || v == null ? null : Number(v));

/** Parse + correct + validate; returns { rounds, shots, summary } or throws. */
export function buildImport(csvPath) {
  const raw = readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines[0].split(",");
  const rows = lines.slice(1).map((l) => {
    const c = l.split(",");
    const o = {};
    header.forEach((h, i) => (o[h] = (c[i] ?? "").trim()));
    return o;
  });

  // Corrections
  const at = (r, rid, hole, sn) => r.RoundID === rid && r.Hole === hole && r.ShotNo === sn;
  for (const r of rows) {
    if (at(r, "2026-05-07_R1", "6", "3"))  { r.Result = "Green"; r.MissDirection = ""; }
    if (at(r, "2026-05-07_R1", "13", "3")) { r.Result = ""; r.MissDirection = "Short"; }
    if (at(r, "2026-05-07_R1", "18", "1")) { r.Result = ""; r.MissDirection = "Long"; }
  }
  rows
    .filter((r) => r.RoundID === "2026-05-21_R1" && r.Hole === "6")
    .sort((a, b) => Number(a.ShotNo) - Number(b.ShotNo))
    .forEach((r, i) => (r.ShotNo = String(i + 1)));

  // Validate
  const errors = [];
  for (const [i, r] of rows.entries()) {
    const w = `L${i + 2} ${r.RoundID} h${r.Hole} s${r.ShotNo}`;
    if (!CLUBS.has(r.Club)) errors.push(`${w}: bad club "${r.Club}"`);
    if (r.Result && !RESULTS.has(r.Result)) errors.push(`${w}: bad result "${r.Result}"`);
    if (r.MissDirection && !MISS.has(r.MissDirection)) errors.push(`${w}: bad miss "${r.MissDirection}"`);
    if (r.PuttSide && !SIDES.has(r.PuttSide)) errors.push(`${w}: bad puttSide "${r.PuttSide}"`);
    if (r.PuttLength && !LENGTHS.has(r.PuttLength)) errors.push(`${w}: bad puttLength "${r.PuttLength}"`);
    if (r.Execution && !/^[1-4]$/.test(r.Execution)) errors.push(`${w}: bad execution "${r.Execution}"`);
    if (r.Penalty && !/^\d+$/.test(r.Penalty)) errors.push(`${w}: bad penalty "${r.Penalty}"`);
    if (!["3","4","5"].includes(r.Par)) errors.push(`${w}: bad par "${r.Par}"`);
  }
  const parKey = {};
  for (const r of rows) {
    const k = `${r.RoundID}|${r.Hole}`;
    if (parKey[k] && parKey[k] !== r.Par) errors.push(`${k}: inconsistent par`);
    parKey[k] = r.Par;
  }
  if (errors.length) throw new Error(`${errors.length} validation error(s):\n` + errors.join("\n"));

  // Build rounds + shots
  const roundsMap = new Map();
  for (const r of rows) {
    if (!roundsMap.has(r.RoundID)) roundsMap.set(r.RoundID, { id: randomUUID(), date: r.Date, holes: new Set() });
    roundsMap.get(r.RoundID).holes.add(r.Hole);
  }
  const rounds = [...roundsMap.values()].map((rd) => ({
    id: rd.id,
    user_id: V1_USER_ID,
    date: rd.date,
    session_type: SESSION_BY_HOLES[rd.holes.size] ?? "Full18",
    notes: null,
  }));
  const shots = rows.map((r) => ({
    user_id: V1_USER_ID,
    round_id: roundsMap.get(r.RoundID).id,
    hole: Number(r.Hole),
    par: Number(r.Par),
    shot_no: Number(r.ShotNo),
    club: r.Club,
    yardage: num(r.Yardage),
    execution: num(r.Execution),
    result: str(r.Result),
    miss_direction: str(r.MissDirection),
    putt_side: str(r.PuttSide),
    putt_length: str(r.PuttLength),
    mulligan: /^(y|yes|true|x)$/i.test(r.Mulligan),
    penalty: r.Penalty === "" ? 0 : Number(r.Penalty),
    notes: null,
  }));

  return {
    rounds,
    shots,
    summary: [...roundsMap.entries()].map(([rid, rd]) => ({
      rid, id: rd.id, session: SESSION_BY_HOLES[rd.holes.size] ?? "Full18", holes: rd.holes.size,
    })),
  };
}

// ── CLI: emit SQL ──
if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) { console.error("usage: node scripts/import-sheet.mjs <csv>"); process.exit(1); }
  const { rounds, shots, summary } = buildImport(path);
  const q = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : typeof v === "boolean" ? v : `'${String(v).replace(/'/g, "''")}'`);
  const roundVals = rounds.map((r) => `  (${q(r.id)}, ${q(r.user_id)}, ${q(r.date)}, ${q(r.session_type)}, NULL)`);
  const shotVals = shots.map((s) =>
    `  (${q(s.user_id)}, ${q(s.round_id)}, ${s.hole}, ${s.par}, ${s.shot_no}, ${q(s.club)}, ${q(s.yardage)}, ${q(s.execution)}, ${q(s.result)}, ${q(s.miss_direction)}, ${q(s.putt_side)}, ${q(s.putt_length)}, ${q(s.mulligan)}, ${s.penalty}, NULL)`);
  process.stderr.write(`✓ validated ${shots.length} shots / ${rounds.length} rounds\n`);
  process.stdout.write(
    `BEGIN;\nDELETE FROM shots;\nDELETE FROM rounds;\n` +
    `INSERT INTO rounds (id, user_id, date, session_type, notes) VALUES\n${roundVals.join(",\n")};\n` +
    `INSERT INTO shots (user_id, round_id, hole, par, shot_no, club, yardage, execution, result, miss_direction, putt_side, putt_length, mulligan, penalty, notes) VALUES\n${shotVals.join(",\n")};\nCOMMIT;\n`,
  );
}
