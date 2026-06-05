/**
 * Strokes-Gained schema validation prototype (Phase-1 gate, throwaway).
 *
 * Validates that the proposed shot-chain schema actually yields clean SG
 * *before* any form/migration changes. It runs the carry-forward backfill
 * itself (start_lie[N] = finish_zone[N-1]) so it simultaneously validates
 * SG-on-history. Reads the live DB read-only; writes nothing.
 *
 *   node scripts/sg-prototype.mjs
 *
 * The baseline below is a provisional, PGA-Tour-*shaped* benchmark (Broadie).
 * It is per-category shape-correct (so cross-category leak ranking is valid in
 * direction) but NOT scratch-calibrated — absolute SG values will shift when we
 * drop in a real scratch/amateur table. The gate here is: does the pipeline
 * produce sensible, well-covered SG, and where does coverage break?
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── env ──────────────────────────────────────────────────────────────────────
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// ── provisional benchmark (expected strokes to hole out) ─────────────────────
// Non-green lies keyed by YARDS; Green keyed by FEET.
const TABLES = {
  Tee: { 100: 2.92, 140: 2.97, 180: 3.05, 220: 3.17, 260: 3.45, 300: 3.71, 340: 3.86, 380: 3.96, 420: 4.02, 460: 4.13, 500: 4.25, 540: 4.34, 580: 4.43, 620: 4.5 },
  Fairway: { 10: 2.18, 20: 2.4, 40: 2.6, 60: 2.7, 80: 2.75, 100: 2.8, 120: 2.85, 140: 2.91, 160: 2.98, 180: 3.08, 200: 3.19, 220: 3.32, 240: 3.45, 260: 3.58, 280: 3.69, 300: 3.78 },
  Rough: { 10: 2.4, 20: 2.59, 40: 2.78, 60: 2.91, 80: 2.96, 100: 3.02, 120: 3.08, 140: 3.15, 160: 3.23, 180: 3.31, 200: 3.42, 220: 3.53, 240: 3.64, 260: 3.74, 280: 3.83, 300: 3.9 },
  Sand: { 10: 2.45, 20: 2.53, 40: 2.82, 60: 3.0, 80: 3.1, 100: 3.23, 120: 3.25, 140: 3.28, 160: 3.33, 180: 3.39, 200: 3.47, 220: 3.56, 240: 3.66 },
  Recovery: { 20: 3.45, 100: 3.45, 180: 3.45, 220: 3.95, 260: 3.95, 300: 4.1 },
  Green: { 2: 1.01, 3: 1.04, 4: 1.13, 5: 1.23, 6: 1.34, 7: 1.42, 8: 1.5, 9: 1.56, 10: 1.61, 12: 1.7, 15: 1.78, 20: 1.87, 25: 1.94, 30: 2.0, 40: 2.1, 50: 2.18, 60: 2.26, 80: 2.42, 90: 2.5 },
};
function expected(lie, dist) {
  const t = TABLES[lie];
  if (!t || dist == null) return null;
  const ks = Object.keys(t).map(Number).sort((a, b) => a - b);
  if (dist <= ks[0]) return t[ks[0]];
  if (dist >= ks[ks.length - 1]) return t[ks[ks.length - 1]];
  for (let i = 0; i < ks.length - 1; i++) {
    if (dist >= ks[i] && dist <= ks[i + 1]) {
      const f = (dist - ks[i]) / (ks[i + 1] - ks[i]);
      return t[ks[i]] + f * (t[ks[i + 1]] - t[ks[i]]);
    }
  }
  return null;
}

// ── carry-forward: previous shot's finish → this shot's start lie ────────────
function startLieFromPrev(prev, curr) {
  if (!prev) return "Tee";
  if (prev.club === "Putter") return "Green"; // missed putt stays on green
  // Inference: a non-putter logged with NO result that's immediately followed
  // by a putt must have reached the green (you can only putt from the green).
  // Recovers the dominant historical gap (untagged chips/pitches before putts).
  if (prev.result == null && curr && curr.club === "Putter") return "Green";
  switch (prev.result) {
    case "Fairway": return "Fairway";
    case "Green": return "Green";
    case "Rough": return "Rough";
    case "Bunker": return "Sand";
    case "OB": case "Hazard": case "Lost": case "Unplayable": return "Penalty"; // drop lie unknown from history
    case null: case undefined: return "Unknown";
    default: return "Unknown";
  }
}
function category(lie, distYd, par) {
  if (lie === "Green") return "Putting";
  if (lie === "Tee") return par >= 4 ? "Off the tee" : "Approach";
  if (distYd != null && distYd <= 30 && lie !== "Recovery") return "Short game";
  return "Approach";
}

async function main() {
  const [{ data: rounds }, { data: shots }, { data: tees }, { data: ty }] = await Promise.all([
    supabase.from("rounds").select("id,date,tee_id"),
    supabase.from("shots").select("*").order("round_id").order("hole").order("shot_no"),
    supabase.from("course_tees").select("id,name"),
    supabase.from("tee_yardages").select("tee_id,hole_number,yardage"),
  ]);

  // Representative tee-shot distance per hole: the round's own tee when known,
  // else the average across that course's tees (one course → fine approximation).
  const byTee = {}; // tee_id -> { hole -> yds }
  const avgByHole = {}; // hole -> [yds...]
  for (const r of ty) {
    (byTee[r.tee_id] ??= {})[r.hole_number] = r.yardage;
    (avgByHole[r.hole_number] ??= []).push(r.yardage);
  }
  const repHoleYds = {};
  for (const h of Object.keys(avgByHole)) {
    const a = avgByHole[h];
    repHoleYds[h] = Math.round(a.reduce((s, x) => s + x, 0) / a.length);
  }
  const roundTee = Object.fromEntries(rounds.map((r) => [r.id, r.tee_id]));
  const roundDate = Object.fromEntries(rounds.map((r) => [r.id, r.date]));
  void tees;

  function teeShotDist(roundId, hole) {
    const tid = roundTee[roundId];
    if (tid && byTee[tid]?.[hole] != null) return byTee[tid][hole];
    return repHoleYds[hole] ?? null;
  }

  // Group shots by round+hole.
  const holes = new Map();
  for (const s of shots) {
    const k = `${s.round_id}|${s.hole}`;
    (holes.get(k) ?? holes.set(k, []).get(k)).push(s);
  }

  // ── per-shot SG over the reconstructed chain ───────────────────────────────
  const cat = {}; // category -> { n, sg }
  const gaps = { startDist: 0, leaveDist: 0, penaltyLie: 0, unknownLie: 0, tail: 0 };
  let computable = 0, totalScored = 0;
  const noGreenMarker = []; // GIR-fallback holes (reconciliation edge cases)
  const layups = []; // par-5 chains for the distance-semantics question
  const samples = [];

  for (const [k, hShots] of holes) {
    hShots.sort((a, b) => a.shot_no - b.shot_no);
    const [roundId, holeNo] = k.split("|");
    const par = hShots[0].par;
    const completed = hShots.some((s) => s.result === "Make");

    // distance-to-hole + start lie per shot
    const enriched = hShots.map((s, i) => {
      const prev = i > 0 ? hShots[i - 1] : null;
      const startLie = startLieFromPrev(prev, s);
      const isPutt = s.club === "Putter" || startLie === "Green";
      let distYd = null, distForE = null;
      const yards = s.yardage == null ? null : Number(s.yardage);
      if (isPutt) {
        if (yards != null) { distForE = yards * 3; distYd = yards; } // stored yds → feet
      } else if (yards != null) {
        distYd = yards; distForE = yards;
      } else if (s.shot_no === 1) {
        distYd = teeShotDist(roundId, Number(holeNo)); distForE = distYd;
      }
      return { s, startLie, isPutt, distYd, distForE };
    });

    // GIR reconciliation: does a legacy result==="Green" marker exist?
    if (completed && !hShots.some((s) => s.result === "Green")) {
      noGreenMarker.push({ date: roundDate[roundId], hole: holeNo, par,
        chain: hShots.map((s) => `${s.club}/${s.result ?? "-"}`).join(" ") });
    }
    if (par === 5) {
      layups.push({ date: roundDate[roundId], hole: holeNo,
        chain: enriched.map((e) => `${e.s.club} ${e.distYd ?? "?"}${e.isPutt ? "yd(putt)" : "y"}→${e.s.result ?? "-"}`).join("  ") });
    }

    for (let i = 0; i < enriched.length; i++) {
      const e = enriched[i];
      const next = enriched[i + 1];
      totalScored++;

      const startE = ["Penalty", "Unknown"].includes(e.startLie)
        ? null
        : expected(e.startLie === "Green" ? "Green" : e.startLie, e.startLie === "Green" ? e.distForE : e.distYd);
      if (e.startLie === "Penalty") gaps.penaltyLie++;
      else if (e.startLie === "Unknown") gaps.unknownLie++;
      else if (e.distForE == null) gaps.startDist++;

      let finishE = null;
      if (e.s.result === "Make") finishE = 0;
      else if (next) {
        if (["Penalty", "Unknown"].includes(next.startLie)) { /* counted via its own startE */ }
        else if (next.distForE == null) gaps.leaveDist++;
        else finishE = expected(next.startLie === "Green" ? "Green" : next.startLie, next.startLie === "Green" ? next.distForE : next.distYd);
      } else {
        gaps.tail++; // incomplete hole tail (no Make, no next shot)
      }

      if (startE != null && finishE != null) {
        const sg = startE - finishE - 1 - (e.s.penalty ?? 0);
        const c = category(e.startLie, e.distYd, par);
        (cat[c] ??= { n: 0, sg: 0 }).n++;
        cat[c].sg += sg;
        computable++;
        if (samples.length < 12 && Number(holeNo) <= 3)
          samples.push(`${roundDate[roundId]} h${holeNo} s${e.s.shot_no} ${e.startLie}/${e.distYd ?? "?"} ${e.s.club}→${e.s.result ?? "-"}  SG ${sg >= 0 ? "+" : ""}${sg.toFixed(2)}  [${c}]`);
      }
    }
  }

  // ── report ─────────────────────────────────────────────────────────────────
  const pct = (a, b) => `${((100 * a) / b).toFixed(1)}%`;
  console.log("\n===== SG SCHEMA PROTOTYPE (provisional PGA-shaped baseline) =====\n");
  console.log(`Rounds ${rounds.length} · holes ${holes.size} · shots ${totalScored}`);
  console.log(`\n-- COVERAGE --`);
  console.log(`Shots with computable SG: ${computable}/${totalScored}  (${pct(computable, totalScored)})`);
  console.log(`Gap reasons (a missing distance kills the shot AND its predecessor's leave):`);
  console.log(`  missing start distance : ${gaps.startDist}`);
  console.log(`  missing leave (next d) : ${gaps.leaveDist}`);
  console.log(`  penalty-drop lie unknown: ${gaps.penaltyLie}`);
  console.log(`  unknown lie (null prev) : ${gaps.unknownLie}`);
  console.log(`  incomplete hole tail    : ${gaps.tail}`);

  console.log(`\n-- STROKES GAINED BY CATEGORY (provisional; direction valid, magnitude not yet calibrated) --`);
  let tot = 0, totn = 0;
  for (const c of ["Off the tee", "Approach", "Short game", "Putting"]) {
    const v = cat[c];
    if (!v) { console.log(`  ${c.padEnd(13)}  (no covered shots)`); continue; }
    tot += v.sg; totn += v.n;
    console.log(`  ${c.padEnd(13)}  n=${String(v.n).padStart(3)}  total ${v.sg >= 0 ? "+" : ""}${v.sg.toFixed(1)}  avg/shot ${(v.sg / v.n >= 0 ? "+" : "")}${(v.sg / v.n).toFixed(3)}`);
  }
  console.log(`  ${"TOTAL".padEnd(13)}  n=${String(totn).padStart(3)}  total ${tot >= 0 ? "+" : ""}${tot.toFixed(1)} vs this baseline`);

  console.log(`\n-- GREEN RECONCILIATION --`);
  console.log(`In backfill, start_lie is derived FROM result, so the two agree by construction;`);
  console.log(`this harness matters going forward when start_lie is entered independently.`);
  console.log(`Completed holes with NO legacy result="Green" marker (GIR-fallback / chip-in): ${noGreenMarker.length}`);
  for (const h of noGreenMarker.slice(0, 8)) console.log(`  ${h.date} h${h.hole} par${h.par}: ${h.chain}`);

  console.log(`\n-- LAYUP / DISTANCE-SEMANTICS CHECK (par 5s; *=putt in ft) --`);
  console.log(`If "yardage to target" was distance-to-PIN, the middle-shot numbers should`);
  console.log(`decline monotonically toward the hole; a layup target would break that.`);
  for (const l of layups.slice(0, 10)) console.log(`  ${l.date} h${l.hole}: ${l.chain}`);

  console.log(`\n-- SAMPLE PER-SHOT SG (holes 1-3) --`);
  for (const s of samples) console.log(`  ${s}`);
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
