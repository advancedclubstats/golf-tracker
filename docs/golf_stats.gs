/**
 * Golf Stats — Hole_Summary, Club_Summary, Distance_Summary rebuilders
 *
 * Install:
 *   1. Open the Golf Analytics sheet
 *   2. Extensions → Apps Script
 *   3. Replace any existing code with this file's contents → Save
 *   4. Reload the spreadsheet — a "Golf Stats" menu appears
 *   5. Use Golf Stats → Rebuild All Summaries (or run individual ones)
 *
 * Conventions assumed (per the Reference sheet):
 *   - Putt Yardage column is in YARDS (6 ft = 2 yd). The script multiplies
 *     by 3 to bucket putts in feet. If you actually enter putts in feet,
 *     change `const PUTT_YD_TO_FT = 3` to 1.
 *   - A round-hole "counts" only if its highest-ShotNo row has Result = "Make".
 *     Holes with partial logs are excluded and listed in Hole_Summary's footer.
 */

const COL = {
  roundId: 'RoundID',
  date: 'Date',
  hole: 'Hole',
  par: 'Par',
  shotNo: 'ShotNo',
  club: 'Club',
  yardage: 'Yardage',
  execution: 'Execution',
  result: 'Result',         // Fairway / Green / Rough / Bunker / OB / Hazard / Lost / Unplayable / Make / blank
  missDirection: 'MissDirection',
};

// These columns are optional — the script skips them if the headers aren't present.
const COL_OPTIONAL = {
  puttSide: 'PuttSide',       // High / Low / blank
  puttLength: 'PuttLength',   // Short / Long / blank
  mulligan: 'Mulligan',       // Y, TRUE, checkbox, or blank
  penalty: 'Penalty',         // int: penalty strokes on this shot (0/1, rarely 2)
};

const PUTT_YD_TO_FT = 3;  // change to 1 if you enter putts in feet

// Putt buckets use upper-inclusive boundaries so a 6-ft putt falls in "3–6 ft".
const PUTT_BUCKETS = [
  { label: '0–3 ft',   minExc: -Infinity, maxInc: 3 },
  { label: '3–6 ft',   minExc: 3,         maxInc: 6 },
  { label: '6–10 ft',  minExc: 6,         maxInc: 10 },
  { label: '10–20 ft', minExc: 10,        maxInc: 20 },
  { label: '20+ ft',   minExc: 20,        maxInc: Infinity },
];

function puttBucketOf(buckets, ft) {
  for (const b of buckets) {
    if (ft > b.minExc && ft <= b.maxInc) return b;
  }
  return null;
}

function isMulligan(val) {
  if (val === true || val === 1) return true;
  if (typeof val !== 'string') return false;
  const v = val.trim().toLowerCase();
  return v === 'y' || v === 'yes' || v === 'true' || v === 'x' || v === '✓';
}

// Returns the penalty stroke count for a row (0 if column absent or cell empty).
function penaltyOf(row, idx) {
  if (idx.penalty === undefined || idx.penalty === -1) return 0;
  const v = row[idx.penalty];
  if (typeof v === 'number') return v > 0 ? v : 0;
  if (typeof v === 'string') {
    const n = parseInt(v.trim(), 10);
    return (Number.isFinite(n) && n > 0) ? n : 0;
  }
  return 0;
}

// Total penalty strokes across all shots in a hole.
function totalPenalties(shots, idx) {
  let t = 0;
  for (const s of shots) t += penaltyOf(s, idx);
  return t;
}

// Penalty strokes incurred on shots before the first putter (used for GIR fallback).
function penaltiesBeforeFirstPutt(shots, idx) {
  let t = 0;
  for (const s of shots) {
    if (s[idx.club] === 'Putter') break;
    t += penaltyOf(s, idx);
  }
  return t;
}

// A "real putt" = a Putter stroke taken when the ball was already on the green.
// Convention: the shot that brings the ball ONTO the green has Result='Green'
// (whatever club, including the Putter for a fringe putt). Subsequent on-green
// putts have blank Result. So: real putt = Putter shot with Result != 'Green'.
function isRealPutt(row, idx) {
  return row[idx.club] === 'Putter' && row[idx.result] !== 'Green';
}

// Total strokes (including penalties) to put the ball on the green.
// Primary signal: first shot tagged Result='Green'.
// Fallback A (legacy data, untagged approach): use shot before first Putter as the reach,
//   but only if that Putter isn't itself a hole-out from off-green (Result=Make with no
//   preceding Green tag — i.e., a Texas wedge that went in directly).
// Fallback B (no putts, or Texas wedge hole-out): use total strokes (chip-in / hole-out).
function strokesToReachGreen(r, idx) {
  for (let i = 0; i < r.shots.length; i++) {
    if (r.shots[i][idx.result] === 'Green') {
      const shotNo = r.shots[i][idx.shotNo];
      let pen = 0;
      for (let j = 0; j <= i; j++) pen += penaltyOf(r.shots[j], idx);
      return shotNo + pen;
    }
  }
  const firstPutterIdx = r.shots.findIndex(s => s[idx.club] === 'Putter');
  if (firstPutterIdx !== -1) {
    const firstPutter = r.shots[firstPutterIdx];
    if (firstPutter[idx.result] !== 'Make') {
      const shotNo = firstPutter[idx.shotNo];
      return (shotNo - 1) + penaltiesBeforeFirstPutt(r.shots, idx);
    }
  }
  return r.strokes;
}

// ─── shared helpers ──────────────────────────────────────────────────────────

function loadShots() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shots = ss.getSheetByName('Shots');
  if (!shots) throw new Error('Missing Shots sheet');
  const data = shots.getDataRange().getValues();
  const header = data[0];
  const idx = {};
  for (const k in COL) idx[k] = header.indexOf(COL[k]);
  for (const k in idx) {
    if (idx[k] === -1) throw new Error('Missing column in Shots: ' + COL[k]);
  }
  // optional columns — may be -1 (absent), which the rebuilders handle gracefully
  for (const k in COL_OPTIONAL) idx[k] = header.indexOf(COL_OPTIONAL[k]);
  return { ss, data, idx };
}

function aggregateByRoundHole(data, idx) {
  const rh = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rid = row[idx.roundId];
    const hole = row[idx.hole];
    const sn = row[idx.shotNo];
    if (!rid || hole === '' || hole === null || !sn) continue;
    const key = rid + '||' + hole;
    if (!rh[key]) {
      rh[key] = {
        roundId: rid, hole: hole, par: row[idx.par],
        shots: [],
        lastShotNo: 0, lastShotResult: '',
      };
    }
    rh[key].shots.push(row);
    if (sn > rh[key].lastShotNo) {
      rh[key].lastShotNo = sn;
      rh[key].lastShotResult = row[idx.result];
    }
  }
  for (const key in rh) {
    rh[key].shots.sort((a, b) => a[idx.shotNo] - b[idx.shotNo]);
    rh[key].complete = rh[key].lastShotResult === 'Make';
  }
  return rh;
}

function bucketOf(buckets, value) {
  for (const b of buckets) {
    if (value >= b.min && value < b.max) return b;
  }
  return null;
}

function r2(n) { return Math.round(n * 100) / 100; }
function ui()  { return SpreadsheetApp.getUi(); }

// ─── HOLE_SUMMARY ────────────────────────────────────────────────────────────

function rebuildHoleSummary() {
  const { ss, data, idx } = loadShots();
  const summary = ss.getSheetByName('Hole_Summary');
  if (!summary) { ui().alert('Missing Hole_Summary sheet'); return; }

  const rh = aggregateByRoundHole(data, idx);
  const complete = Object.values(rh).filter(r => r.complete);
  const incomplete = Object.values(rh).filter(r => !r.complete);

  for (const r of complete) {
    // Strokes = highest ShotNo on this hole + any penalty strokes recorded.
    // Using max(ShotNo) instead of row count makes us robust to gaps in the
    // ShotNo sequence (e.g., a row that was skipped during data entry).
    r.strokes = r.lastShotNo + totalPenalties(r.shots, idx);
    // "Real putts" = Putter shots taken once the ball is on the green.
    // The shot that brings the ball onto the green is tagged Result='Green'
    // (even if a Texas wedge with the putter), so a real putt is any Putter
    // row whose own Result is NOT 'Green'.
    r.putts = r.shots.filter(s => isRealPutt(s, idx)).length;
    r.gir = strokesToReachGreen(r, idx) <= r.par - 2;
    r.teeResult = r.shots[0][idx.result];
    let nps = 0, npc = 0;
    for (const s of r.shots) {
      if (s[idx.club] === 'Putter') continue;
      const e = s[idx.execution];
      if (typeof e === 'number' && e > 0) { nps += e; npc++; }
    }
    r.nonPuttExecSum = nps;
    r.nonPuttExecCount = npc;
  }

  const byHole = {};
  for (const r of complete) {
    if (!byHole[r.hole]) byHole[r.hole] = [];
    byHole[r.hole].push(r);
  }

  const holes = Object.keys(byHole).map(Number).sort((a, b) => a - b);
  const out = [[
    'Hole', 'Par', 'Rounds', 'Avg Score', 'Best', 'Avg vs Par', 'All-Time vs Par',
    'FW %', 'GIR %', 'Scramble %', 'Avg Putts', '3-Putt %', 'Shot Quality (non-putt)'
  ]];

  for (const hole of holes) {
    const rounds = byHole[hole];
    const par = rounds[0].par;
    const n = rounds.length;
    const totalStrokes = rounds.reduce((s, r) => s + r.strokes, 0);
    const avgScore = totalStrokes / n;
    const bestScore = Math.min.apply(null, rounds.map(r => r.strokes));
    const allTimeVsPar = totalStrokes - par * n;

    const fwPct = par >= 4
      ? rounds.filter(r => r.teeResult === 'Fairway').length / n
      : '';
    const girPct = rounds.filter(r => r.gir).length / n;
    const girMissed = rounds.filter(r => !r.gir);
    const scramblePct = girMissed.length > 0
      ? girMissed.filter(r => r.strokes <= par).length / girMissed.length
      : '';
    const avgPutts = rounds.reduce((s, r) => s + r.putts, 0) / n;
    const threePuttPct = rounds.filter(r => r.putts >= 3).length / n;
    const tnps = rounds.reduce((s, r) => s + r.nonPuttExecSum, 0);
    const tnpc = rounds.reduce((s, r) => s + r.nonPuttExecCount, 0);
    const shotQuality = tnpc > 0 ? tnps / tnpc : '';

    out.push([
      hole, par, n,
      r2(avgScore), bestScore, r2(avgScore - par), allTimeVsPar,
      fwPct, girPct, scramblePct,
      r2(avgPutts), threePuttPct,
      shotQuality === '' ? '' : r2(shotQuality)
    ]);
  }

  summary.clear();
  summary.getRange(1, 1, out.length, out[0].length).setValues(out);

  if (out.length > 1) {
    const last = out.length;
    summary.getRange(2, 7,  last - 1, 1).setNumberFormat('+0;-0;"E"');  // All-Time vs Par
    summary.getRange(2, 8,  last - 1, 1).setNumberFormat('0%');
    summary.getRange(2, 9,  last - 1, 1).setNumberFormat('0%');
    summary.getRange(2, 10, last - 1, 1).setNumberFormat('0%');
    summary.getRange(2, 12, last - 1, 1).setNumberFormat('0%');
  }
  summary.getRange(1, 1, 1, out[0].length).setFontWeight('bold').setBackground('#f0f0f0');
  summary.setFrozenRows(1);
  summary.autoResizeColumns(1, out[0].length);

  writeFooter(summary, out.length, complete.length, incomplete);
}

function writeFooter(sheet, lastDataRow, completeCount, incompleteList) {
  const r = lastDataRow + 2;
  sheet.getRange(r, 1).setValue('Last rebuilt: ' + new Date()).setFontStyle('italic').setFontSize(10);
  sheet.getRange(r + 1, 1).setValue(
    'Complete round-holes counted: ' + completeCount +
    ' · Incomplete round-holes excluded: ' + incompleteList.length
  ).setFontStyle('italic').setFontSize(10);
  if (incompleteList.length > 0) {
    const list = incompleteList
      .sort((a, b) => (a.roundId + a.hole).localeCompare(b.roundId + b.hole))
      .map(x => x.roundId + ' / Hole ' + x.hole)
      .join(', ');
    sheet.getRange(r + 2, 1).setValue('Excluded: ' + list).setFontStyle('italic').setFontSize(10);
  }
}

// ─── CLUB_SUMMARY ────────────────────────────────────────────────────────────

const CLUB_ORDER = ['D', '3W', '4W', '5W', '7W', '2H', '3H', '4H', '5H',
                    '2i', '3i', '4i', '5i', '6i', '7i', '8i', '9i',
                    'PW', 'GW', 'SW', 'LW'];

function rebuildClubSummary() {
  const { ss, data, idx } = loadShots();
  const summary = ss.getSheetByName('Club_Summary');
  if (!summary) { ui().alert('Missing Club_Summary sheet'); return; }

  const clubs = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const club = row[idx.club];
    const sn = row[idx.shotNo];
    if (!club || !sn) continue;
    if (club === 'Putter') continue; // putter handled in Distance_Summary
    if (!clubs[club]) {
      clubs[club] = {
        club, shots: 0,
        execSum: 0, execCount: 0,
        ydSum: 0, ydCount: 0,
        teeShots: 0, fwHits: 0,
        approachShots: 0, greenHits: 0,
        missL: 0, missR: 0, missLong: 0, missShort: 0,
        bunkerShots: 0,
      };
    }
    const c = clubs[club];
    c.shots++;
    const exec = row[idx.execution];
    if (typeof exec === 'number' && exec > 0) {
      c.execSum += exec;
      c.execCount++;
    }
    const yd = row[idx.yardage];
    if (typeof yd === 'number' && yd > 0) {
      c.ydSum += yd;
      c.ydCount++;
    }
    if (sn === 1 && row[idx.par] !== 3) {
      // tee shot on par 4/5
      c.teeShots++;
      if (row[idx.result] === 'Fairway') c.fwHits++;
    } else {
      // approach (incl. par 3 tee shots)
      c.approachShots++;
      if (row[idx.result] === 'Green') c.greenHits++;
    }
    const md = row[idx.missDirection];
    if (md === 'Left')       c.missL++;
    else if (md === 'Right') c.missR++;
    else if (md === 'Long')  c.missLong++;
    else if (md === 'Short') c.missShort++;
    if (row[idx.result] === 'Bunker') c.bunkerShots++;
  }

  const sorted = Object.values(clubs).sort((a, b) => {
    const ai = CLUB_ORDER.indexOf(a.club);
    const bi = CLUB_ORDER.indexOf(b.club);
    if (ai === -1 && bi === -1) return a.club.localeCompare(b.club);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const out = [[
    'Club', 'Shots', 'Avg Quality', 'Avg Yds',
    'FW %', 'Green %',
    'Miss L %', 'Miss R %', 'Miss Long %', 'Miss Short %',
    'Bunker %'
  ]];

  for (const c of sorted) {
    out.push([
      c.club, c.shots,
      c.execCount > 0 ? r2(c.execSum / c.execCount) : '',
      c.ydCount > 0 ? Math.round(c.ydSum / c.ydCount) : '',
      c.teeShots > 0 ? c.fwHits / c.teeShots : '',
      c.approachShots > 0 ? c.greenHits / c.approachShots : '',
      c.shots > 0 ? c.missL / c.shots : 0,
      c.shots > 0 ? c.missR / c.shots : 0,
      c.shots > 0 ? c.missLong / c.shots : 0,
      c.shots > 0 ? c.missShort / c.shots : 0,
      c.shots > 0 ? c.bunkerShots / c.shots : 0,
    ]);
  }

  summary.clear();
  summary.getRange(1, 1, out.length, out[0].length).setValues(out);
  if (out.length > 1) {
    const last = out.length;
    summary.getRange(2, 5, last - 1, 1).setNumberFormat('0%');     // FW
    summary.getRange(2, 6, last - 1, 1).setNumberFormat('0%');     // Green
    summary.getRange(2, 7, last - 1, 5).setNumberFormat('0%');     // misses + bunker
  }
  summary.getRange(1, 1, 1, out[0].length).setFontWeight('bold').setBackground('#f0f0f0');
  summary.setFrozenRows(1);
  summary.autoResizeColumns(1, out[0].length);
}

// ─── DISTANCE_SUMMARY ────────────────────────────────────────────────────────

function rebuildDistanceSummary() {
  const { ss, data, idx } = loadShots();
  const summary = ss.getSheetByName('Distance_Summary');
  if (!summary) { ui().alert('Missing Distance_Summary sheet'); return; }

  const rh = aggregateByRoundHole(data, idx);
  const complete = Object.values(rh).filter(r => r.complete);

  // ── Putt buckets are upper-inclusive (a 6-ft putt is in "3–6 ft") ──

  // Sub-table 1: Make Rate by Distance (every Putter shot, including Texas wedges)
  const makeRate = PUTT_BUCKETS.map(b => ({ ...b, putts: 0, makes: 0 }));
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idx.club] !== 'Putter') continue;
    const yd = row[idx.yardage];
    if (typeof yd !== 'number' || yd < 0) continue;
    const ft = yd * PUTT_YD_TO_FT;
    const b = puttBucketOf(makeRate, ft);
    if (!b) continue;
    b.putts++;
    if (row[idx.result] === 'Make') b.makes++;
  }

  // Sub-table 2: First-Putt Performance (first REAL putt from the green)
  const firstPutt = PUTT_BUCKETS.map(b => ({
    ...b, faced: 0, totalPutts: 0, onePutt: 0, threePutt: 0
  }));
  for (const r of complete) {
    const realPutts = r.shots.filter(s => isRealPutt(s, idx));
    if (realPutts.length === 0) continue;
    const fp = realPutts[0];
    const yd = fp[idx.yardage];
    if (typeof yd !== 'number' || yd < 0) continue;
    const ft = yd * PUTT_YD_TO_FT;
    const totalPutts = realPutts.length;
    const b = puttBucketOf(firstPutt, ft);
    if (!b) continue;
    b.faced++;
    b.totalPutts += totalPutts;
    if (totalPutts === 1) b.onePutt++;
    if (totalPutts >= 3) b.threePutt++;
  }

  // Sub-table 5 (new): Putt Miss Patterns — only meaningful if PuttSide/PuttLength are logged
  const hasMissTags = idx.puttSide !== -1 || idx.puttLength !== -1;
  const missPatt = PUTT_BUCKETS.map(b => ({
    ...b, misses: 0, high: 0, low: 0, short: 0, long: 0
  }));
  if (hasMissTags) {
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[idx.club] !== 'Putter') continue;
      if (row[idx.result] === 'Make') continue; // we want misses only
      const yd = row[idx.yardage];
      if (typeof yd !== 'number' || yd < 0) continue;
      const ft = yd * PUTT_YD_TO_FT;
      const b = puttBucketOf(missPatt, ft);
      if (!b) continue;
      b.misses++;
      if (idx.puttSide !== -1) {
        const side = String(row[idx.puttSide] || '').trim().toLowerCase();
        if (side === 'high') b.high++;
        else if (side === 'low') b.low++;
      }
      if (idx.puttLength !== -1) {
        const length = String(row[idx.puttLength] || '').trim().toLowerCase();
        if (length === 'short') b.short++;
        else if (length === 'long') b.long++;
      }
    }
  }

  // Sub-table 3: Around the Green (under 30 yds, non-putt)
  const argBuckets = [
    { label: '0–10 yds',  min: 0,  max: 10 },
    { label: '10–30 yds', min: 10, max: 30 },
  ];
  const arg = argBuckets.map(b => ({
    ...b, shots: 0, execSum: 0, execCount: 0,
    onGreen: 0, upDown: 0, upDownEligible: 0
  }));
  for (const r of complete) {
    for (let i = 0; i < r.shots.length; i++) {
      const s = r.shots[i];
      if (s[idx.club] === 'Putter') continue;
      // skip tee shots on par 4/5
      if (s[idx.shotNo] === 1 && r.par !== 3) continue;
      const yd = s[idx.yardage];
      if (typeof yd !== 'number' || yd < 0 || yd >= 30) continue;
      const b = bucketOf(arg, yd);
      if (!b) continue;
      b.shots++;
      const exec = s[idx.execution];
      if (typeof exec === 'number' && exec > 0) {
        b.execSum += exec;
        b.execCount++;
      }
      if (s[idx.result] === 'Green') b.onGreen++;
      // up-and-down: this shot was holed, OR next shot is a Make putt
      b.upDownEligible++;
      if (s[idx.result] === 'Make') {
        b.upDown++;
      } else if (i + 1 < r.shots.length) {
        const next = r.shots[i + 1];
        if (next[idx.club] === 'Putter' && next[idx.result] === 'Make') {
          b.upDown++;
        }
      }
    }
  }

  // Sub-table 4: Approaches (≥30 yds, includes par 3 tee shots)
  const apprBuckets = [
    { label: '30–75 yds',   min: 30,  max: 75 },
    { label: '75–125 yds',  min: 75,  max: 125 },
    { label: '125–175 yds', min: 125, max: 175 },
    { label: '175+ yds',    min: 175, max: Infinity },
  ];
  const appr = apprBuckets.map(b => ({
    ...b, shots: 0, execSum: 0, execCount: 0, greenHit: 0,
    missL: 0, missR: 0, missLong: 0, missShort: 0
  }));
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idx.club] === 'Putter') continue;
    const sn = row[idx.shotNo];
    const par = row[idx.par];
    if (sn === 1 && par !== 3) continue; // tee on par 4/5 → not an approach
    const yd = row[idx.yardage];
    if (typeof yd !== 'number' || yd < 30) continue;
    const b = bucketOf(appr, yd);
    if (!b) continue;
    b.shots++;
    const exec = row[idx.execution];
    if (typeof exec === 'number' && exec > 0) {
      b.execSum += exec;
      b.execCount++;
    }
    if (row[idx.result] === 'Green') b.greenHit++;
    const md = row[idx.missDirection];
    if (md === 'Left')       b.missL++;
    else if (md === 'Right') b.missR++;
    else if (md === 'Long')  b.missLong++;
    else if (md === 'Short') b.missShort++;
  }

  // ── Build rows ──
  const rows = [];
  const sectionStarts = [];

  sectionStarts.push(rows.length + 1);
  rows.push(['PUTTING — MAKE RATE BY DISTANCE']);
  rows.push(['Distance', 'Putts', 'Makes', 'Make %']);
  for (const b of makeRate) {
    rows.push([b.label, b.putts, b.makes, b.putts > 0 ? b.makes / b.putts : '']);
  }
  rows.push(['']);

  sectionStarts.push(rows.length + 1);
  rows.push(['PUTTING — PERFORMANCE BY FIRST-PUTT DISTANCE']);
  rows.push(['Distance', 'First Putts Faced', 'Avg Putts to Finish', '1-Putt %', '3-Putt %']);
  for (const b of firstPutt) {
    rows.push([
      b.label, b.faced,
      b.faced > 0 ? r2(b.totalPutts / b.faced) : '',
      b.faced > 0 ? b.onePutt / b.faced : '',
      b.faced > 0 ? b.threePutt / b.faced : '',
    ]);
  }
  rows.push(['']);

  sectionStarts.push(rows.length + 1);
  rows.push(['AROUND THE GREEN (under 30 yds, non-putt)']);
  rows.push(['Distance', 'Shots', 'Avg Quality', 'On Green %', 'Up & Down %']);
  for (const b of arg) {
    rows.push([
      b.label, b.shots,
      b.execCount > 0 ? r2(b.execSum / b.execCount) : '',
      b.shots > 0 ? b.onGreen / b.shots : '',
      b.upDownEligible > 0 ? b.upDown / b.upDownEligible : '',
    ]);
  }
  rows.push(['']);

  sectionStarts.push(rows.length + 1);
  rows.push(['APPROACH SHOTS (30+ yds, includes par 3 tees)']);
  rows.push(['Distance', 'Shots', 'Avg Quality', 'Green Hit %',
             'Miss L %', 'Miss R %', 'Miss Long %', 'Miss Short %']);
  for (const b of appr) {
    rows.push([
      b.label, b.shots,
      b.execCount > 0 ? r2(b.execSum / b.execCount) : '',
      b.shots > 0 ? b.greenHit / b.shots : '',
      b.shots > 0 ? b.missL / b.shots : 0,
      b.shots > 0 ? b.missR / b.shots : 0,
      b.shots > 0 ? b.missLong / b.shots : 0,
      b.shots > 0 ? b.missShort / b.shots : 0,
    ]);
  }
  rows.push(['']);

  // New sub-table — only render if PuttSide / PuttLength columns exist
  let missPattStart = -1;
  if (hasMissTags) {
    missPattStart = rows.length + 1;
    sectionStarts.push(missPattStart);
    rows.push(['PUTTING — MISS PATTERNS (where missed putts ended up)']);
    rows.push(['Distance', 'Misses', 'High %', 'Low %', 'Short %', 'Long %']);
    for (const b of missPatt) {
      rows.push([
        b.label, b.misses,
        b.misses > 0 ? b.high / b.misses : '',
        b.misses > 0 ? b.low / b.misses : '',
        b.misses > 0 ? b.short / b.misses : '',
        b.misses > 0 ? b.long / b.misses : '',
      ]);
    }
  }

  // Pad rows to the widest column count
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  for (const r of rows) while (r.length < maxCols) r.push('');

  summary.clear();
  summary.getRange(1, 1, rows.length, maxCols).setValues(rows);

  // Format section headers + their column-header rows
  for (const sr of sectionStarts) {
    summary.getRange(sr, 1, 1, maxCols).setFontWeight('bold').setBackground('#e0e0e0');
    summary.getRange(sr + 1, 1, 1, maxCols).setFontWeight('bold');
  }

  // Format percentage columns within each sub-table
  // (sectionStarts[N] + 2 = first data row of that section)
  summary.getRange(sectionStarts[0] + 2, 4, makeRate.length, 1).setNumberFormat('0%');
  summary.getRange(sectionStarts[1] + 2, 4, firstPutt.length, 2).setNumberFormat('0%');
  summary.getRange(sectionStarts[2] + 2, 4, arg.length, 2).setNumberFormat('0%');
  summary.getRange(sectionStarts[3] + 2, 4, appr.length, 5).setNumberFormat('0%');
  if (missPattStart > 0) {
    summary.getRange(missPattStart + 2, 3, missPatt.length, 4).setNumberFormat('0%');
  }

  summary.autoResizeColumns(1, maxCols);
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function formatVsPar(n) {
  if (n === 0) return 'E';
  return (n > 0 ? '+' : '') + n;
}

function rebuildDashboard() {
  const { ss, data, idx } = loadShots();
  const dashboard = ss.getSheetByName('Dashboard');
  if (!dashboard) { ui().alert('Missing Dashboard sheet'); return; }

  const rh = aggregateByRoundHole(data, idx);
  const complete = Object.values(rh).filter(r => r.complete);

  dashboard.clear();
  if (complete.length === 0) {
    dashboard.getRange(1, 1).setValue('No complete round-holes logged yet.').setFontWeight('bold');
    return;
  }

  // Enrich complete round-holes
  for (const r of complete) {
    r.strokes = r.lastShotNo + totalPenalties(r.shots, idx);
    r.putts = r.shots.filter(s => isRealPutt(s, idx)).length;
    r.gir = strokesToReachGreen(r, idx) <= r.par - 2;
    const teeShot = r.shots[0];
    r.fwHit = teeShot[idx.result] === 'Fairway';
    r.teeMissTagged = teeShot[idx.missDirection] !== '' && teeShot[idx.missDirection] != null;
    r.over = Math.max(0, r.strokes - r.par);
    r.under = Math.max(0, r.par - r.strokes);
    r.puttsLost = Math.max(0, r.putts - 2);
    r.nonPuttLost = Math.max(0, r.over - r.puttsLost);
    // Attribution: only blame the tee when there's an explicit miss direction on shot 1
    r.teeLost = (r.par >= 4 && r.teeMissTagged && !r.fwHit) ? r.nonPuttLost : 0;
    r.approachLost = r.nonPuttLost - r.teeLost;
    r.date = teeShot[idx.date];
  }

  // Aggregate by round
  const byRound = {};
  for (const r of complete) {
    if (!byRound[r.roundId]) byRound[r.roundId] = {
      roundId: r.roundId, date: r.date,
      holes: [], strokes: 0, par: 0
    };
    byRound[r.roundId].holes.push(r);
    byRound[r.roundId].strokes += r.strokes;
    byRound[r.roundId].par += r.par;
  }
  for (const k in byRound) byRound[k].vsPar = byRound[k].strokes - byRound[k].par;
  const rounds = Object.values(byRound).sort((a, b) => {
    const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return db - da; // newest first
  });

  // Overall stats
  const totalStrokes = complete.reduce((s, r) => s + r.strokes, 0);
  const totalPar = complete.reduce((s, r) => s + r.par, 0);
  const totalVsPar = totalStrokes - totalPar;
  const avgVsParPerHole = totalVsPar / complete.length;
  const avgVsParPerRound = totalVsPar / rounds.length;

  const par45 = complete.filter(r => r.par >= 4);
  const fwPct = par45.length > 0 ? par45.filter(r => r.fwHit).length / par45.length : '';
  const girPct = complete.filter(r => r.gir).length / complete.length;
  const totalPutts = complete.reduce((s, r) => s + r.putts, 0);
  const avgPutts = totalPutts / complete.length;
  const threePuttRate = complete.filter(r => r.putts >= 3).length / complete.length;
  const girMissed = complete.filter(r => !r.gir);
  const scrambleN = girMissed.length;
  const scrambleHits = girMissed.filter(r => r.strokes <= r.par).length;
  const scramblePct = scrambleN > 0 ? scrambleHits / scrambleN : '';

  // Strokes lost
  const teeLostTotal = complete.reduce((s, r) => s + r.teeLost, 0);
  const apprLostTotal = complete.reduce((s, r) => s + r.approachLost, 0);
  const puttLostTotal = complete.reduce((s, r) => s + r.puttsLost, 0);
  const totalLost = teeLostTotal + apprLostTotal + puttLostTotal;

  // Hole pain points
  const byHole = {};
  for (const r of complete) {
    if (!byHole[r.hole]) byHole[r.hole] = { hole: r.hole, par: r.par, strokes: 0, par_total: 0, n: 0 };
    byHole[r.hole].strokes += r.strokes;
    byHole[r.hole].par_total += r.par;
    byHole[r.hole].n++;
  }
  const holesArr = Object.values(byHole).map(h => ({ ...h, vsPar: h.strokes - h.par_total }));
  const worstHole = holesArr.slice().sort((a, b) => b.vsPar - a.vsPar)[0];
  const bestHole  = holesArr.slice().sort((a, b) => a.vsPar - b.vsPar)[0];

  // Worst club (avg quality, min 3 shots, non-putter)
  const clubStats = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const club = row[idx.club];
    const sn = row[idx.shotNo];
    if (!club || !sn || club === 'Putter') continue;
    if (!clubStats[club]) clubStats[club] = { club, shots: 0, execSum: 0, execCount: 0 };
    clubStats[club].shots++;
    const e = row[idx.execution];
    if (typeof e === 'number' && e > 0) {
      clubStats[club].execSum += e;
      clubStats[club].execCount++;
    }
  }
  const eligibleClubs = Object.values(clubStats).filter(c => c.shots >= 3 && c.execCount > 0);
  const worstClub = eligibleClubs.length > 0
    ? eligibleClubs.slice().sort((a, b) => (a.execSum / a.execCount) - (b.execSum / b.execCount))[0]
    : null;

  // Worst approach distance bucket (min 3 shots)
  const apprBuckets = [
    { label: '30–75 yds',   min: 30,  max: 75 },
    { label: '75–125 yds',  min: 75,  max: 125 },
    { label: '125–175 yds', min: 125, max: 175 },
    { label: '175+ yds',    min: 175, max: Infinity },
  ];
  const apprStats = apprBuckets.map(b => ({ ...b, shots: 0, greenHit: 0 }));
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idx.club] === 'Putter') continue;
    const sn = row[idx.shotNo];
    const par = row[idx.par];
    if (sn === 1 && par !== 3) continue;
    const yd = row[idx.yardage];
    if (typeof yd !== 'number' || yd < 30) continue;
    const b = bucketOf(apprStats, yd);
    if (!b) continue;
    b.shots++;
    if (row[idx.result] === 'Green') b.greenHit++;
  }
  const eligibleAppr = apprStats.filter(b => b.shots >= 3);
  const worstAppr = eligibleAppr.length > 0
    ? eligibleAppr.slice().sort((a, b) => (a.greenHit / a.shots) - (b.greenHit / b.shots))[0]
    : null;

  // Worst putt distance bucket (min 3 putts, excluding tap-ins)
  const puttStats = PUTT_BUCKETS.map(b => ({ ...b, putts: 0, makes: 0 }));
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idx.club] !== 'Putter') continue;
    const yd = row[idx.yardage];
    if (typeof yd !== 'number' || yd < 0) continue;
    const ft = yd * PUTT_YD_TO_FT;
    const b = puttBucketOf(puttStats, ft);
    if (!b) continue;
    b.putts++;
    if (row[idx.result] === 'Make') b.makes++;
  }
  const eligiblePutt = puttStats.filter(b => b.putts >= 3 && b.label !== '0–3 ft');
  const worstPutt = eligiblePutt.length > 0
    ? eligiblePutt.slice().sort((a, b) => (a.makes / a.putts) - (b.makes / b.putts))[0]
    : null;

  // Mulligan tracking — optional, only if the column exists
  let mulligans = [];
  const mulliganByCat = { tee: 0, approach: 0, shortGame: 0, putt: 0 };
  if (idx.mulligan !== -1) {
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!isMulligan(row[idx.mulligan])) continue;
      const club = row[idx.club];
      const sn = row[idx.shotNo];
      const par = row[idx.par];
      const yd = row[idx.yardage];
      let cat;
      if (club === 'Putter') cat = 'putt';
      else if (sn === 1 && par !== 3) cat = 'tee';
      else if (typeof yd === 'number' && yd < 30) cat = 'shortGame';
      else cat = 'approach';
      mulliganByCat[cat]++;
      mulligans.push({
        date: row[idx.date],
        roundId: row[idx.roundId],
        hole: row[idx.hole],
        shotNo: sn,
        club: club,
        yardage: yd,
        category: cat,
      });
    }
    // sort by date descending for "recent mulligans" list
    mulligans.sort((a, b) => {
      const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
      const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
      return db - da;
    });
  }
  const totalMulligans = mulligans.length;

  // Records
  const bestRound = rounds.slice().sort((a, b) => a.vsPar - b.vsPar)[0];
  const worstRound = rounds.slice().sort((a, b) => b.vsPar - a.vsPar)[0];
  const birdies = complete.filter(r => r.strokes === r.par - 1).length;
  const eagles  = complete.filter(r => r.strokes <= r.par - 2).length;

  // ── Build rows ──
  const rows = [];
  const sectionStarts = [];

  function fmtDate(d) {
    if (!d) return '';
    if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return String(d);
  }

  sectionStarts.push(rows.length + 1);
  rows.push(['SNAPSHOT', '']);
  rows.push(['Rounds Logged', rounds.length]);
  rows.push(['Holes Logged', complete.length]);
  rows.push(['Total vs Par', totalVsPar]);
  rows.push(['Avg vs Par per Round', r2(avgVsParPerRound)]);
  rows.push(['Avg vs Par per Hole', r2(avgVsParPerHole)]);
  rows.push(['']);

  sectionStarts.push(rows.length + 1);
  rows.push(['STAT LINE (across all complete holes)', '']);
  rows.push(['FW %', fwPct]);
  rows.push(['GIR %', girPct]);
  rows.push(['Scramble %', scramblePct === '' ? '' : scramblePct]);
  rows.push(['Avg Putts per Hole', r2(avgPutts)]);
  rows.push(['3-Putt % per Hole', threePuttRate]);
  rows.push(['']);

  sectionStarts.push(rows.length + 1);
  rows.push(['STROKES LOST BY CATEGORY', '', '']);
  rows.push(['Category', 'Strokes Lost', '% of Total']);
  if (totalLost > 0) {
    rows.push(['Tee / Long Game', teeLostTotal, teeLostTotal / totalLost]);
    rows.push(['Approach / Short Game', apprLostTotal, apprLostTotal / totalLost]);
    rows.push(['Putting', puttLostTotal, puttLostTotal / totalLost]);
    rows.push(['TOTAL', totalLost, 1]);
  } else {
    rows.push(['(no over-par strokes yet — you\'re at or under par across all logged holes)', '', '']);
  }
  rows.push(['']);

  sectionStarts.push(rows.length + 1);
  rows.push(['WHAT TO WORK ON', '']);
  rows.push(['Area', 'Detail']);
  if (worstHole) rows.push([
    'Worst Hole',
    'Hole ' + worstHole.hole + ' (par ' + worstHole.par + ') · ' +
    formatVsPar(worstHole.vsPar) + ' across ' + worstHole.n + ' round' + (worstHole.n === 1 ? '' : 's')
  ]);
  if (worstAppr) rows.push([
    'Worst Approach Distance',
    worstAppr.label + ' · ' + Math.round(worstAppr.greenHit / worstAppr.shots * 100) +
    '% greens hit (' + worstAppr.shots + ' shots)'
  ]);
  if (worstPutt) rows.push([
    'Worst Putt Distance',
    worstPutt.label + ' · ' + Math.round(worstPutt.makes / worstPutt.putts * 100) +
    '% made (' + worstPutt.putts + ' putts)'
  ]);
  if (worstClub) rows.push([
    'Worst Club',
    worstClub.club + ' · ' + r2(worstClub.execSum / worstClub.execCount) +
    ' avg quality (' + worstClub.shots + ' shots)'
  ]);
  if (!worstHole && !worstAppr && !worstPutt && !worstClub) {
    rows.push(['(not enough data yet — needs more rounds)', '']);
  }
  rows.push(['']);

  sectionStarts.push(rows.length + 1);
  rows.push(['RECENT ROUNDS', '', '', '', '', '']);
  rows.push(['Date', 'RoundID', 'Holes', 'Strokes', 'Par', 'vs Par']);
  const recentN = Math.min(5, rounds.length);
  for (let i = 0; i < recentN; i++) {
    const r = rounds[i];
    rows.push([fmtDate(r.date), r.roundId, r.holes.length, r.strokes, r.par, r.vsPar]);
  }
  rows.push(['']);

  // Mulligan section (only if Mulligan column exists)
  let mulliganSectionStart = -1;
  let mulliganListStart = -1;
  if (idx.mulligan !== -1) {
    mulliganSectionStart = rows.length + 1;
    sectionStarts.push(mulliganSectionStart);
    rows.push(['SHOTS YOU\'D TAKE BACK (Mulligans)', '', '']);
    rows.push(['Metric', 'Count', '% of Total']);
    rows.push(['Total', totalMulligans, '']);
    rows.push([
      'Per round average',
      rounds.length > 0 ? r2(totalMulligans / rounds.length) : 0,
      ''
    ]);
    if (totalMulligans > 0) {
      rows.push(['Tee / Long Game', mulliganByCat.tee,     mulliganByCat.tee       / totalMulligans]);
      rows.push(['Approach',        mulliganByCat.approach, mulliganByCat.approach / totalMulligans]);
      rows.push(['Short Game',      mulliganByCat.shortGame, mulliganByCat.shortGame / totalMulligans]);
      rows.push(['Putts',           mulliganByCat.putt,     mulliganByCat.putt      / totalMulligans]);
    }
    rows.push(['']);

    if (mulligans.length > 0) {
      mulliganListStart = rows.length + 1;
      sectionStarts.push(mulliganListStart);
      rows.push(['Recent Mulligans (most recent first)', '', '', '', '']);
      rows.push(['Date', 'Round', 'Hole', 'Shot', 'Club']);
      const show = Math.min(5, mulligans.length);
      for (let i = 0; i < show; i++) {
        const m = mulligans[i];
        rows.push([fmtDate(m.date), m.roundId, m.hole, m.shotNo, m.club]);
      }
      rows.push(['']);
    }
  }

  sectionStarts.push(rows.length + 1);
  rows.push(['COURSE RECORDS', '']);
  rows.push([
    'Best Round (vs par)',
    bestRound.roundId + ' · ' + bestRound.holes.length + ' hole' + (bestRound.holes.length === 1 ? '' : 's') +
    ' · ' + bestRound.strokes + ' (' + formatVsPar(bestRound.vsPar) + ')'
  ]);
  rows.push([
    'Worst Round (vs par)',
    worstRound.roundId + ' · ' + worstRound.holes.length + ' hole' + (worstRound.holes.length === 1 ? '' : 's') +
    ' · ' + worstRound.strokes + ' (' + formatVsPar(worstRound.vsPar) + ')'
  ]);
  rows.push([
    'Best Hole',
    'Hole ' + bestHole.hole + ' (par ' + bestHole.par + ') · ' +
    formatVsPar(bestHole.vsPar) + ' across ' + bestHole.n + ' round' + (bestHole.n === 1 ? '' : 's')
  ]);
  rows.push(['Birdies', birdies]);
  rows.push(['Eagles or better', eagles]);
  rows.push(['']);

  rows.push(['Last rebuilt: ' + new Date()]);

  // Write
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  for (const r of rows) while (r.length < maxCols) r.push('');
  dashboard.getRange(1, 1, rows.length, maxCols).setValues(rows);

  // Format section headers
  for (const sr of sectionStarts) {
    dashboard.getRange(sr, 1, 1, maxCols).setFontWeight('bold').setBackground('#e0e0e0');
  }

  // Snapshot formats
  dashboard.getRange(sectionStarts[0] + 3, 2).setNumberFormat('+0;-0;"E"');           // Total vs Par
  dashboard.getRange(sectionStarts[0] + 4, 2).setNumberFormat('+0.00;-0.00;"E"');     // Avg per round
  dashboard.getRange(sectionStarts[0] + 5, 2).setNumberFormat('+0.00;-0.00;"E"');     // Avg per hole

  // Stat line percentage cells
  dashboard.getRange(sectionStarts[1] + 1, 2).setNumberFormat('0%');
  dashboard.getRange(sectionStarts[1] + 2, 2).setNumberFormat('0%');
  dashboard.getRange(sectionStarts[1] + 3, 2).setNumberFormat('0%');
  dashboard.getRange(sectionStarts[1] + 5, 2).setNumberFormat('0%');

  // Strokes Lost: % of Total column
  if (totalLost > 0) {
    dashboard.getRange(sectionStarts[2] + 2, 3, 4, 1).setNumberFormat('0%');
  }
  // Bold the sub-header row for Strokes Lost
  dashboard.getRange(sectionStarts[2] + 1, 1, 1, maxCols).setFontWeight('bold');
  // Bold the sub-header row for What to Work On
  dashboard.getRange(sectionStarts[3] + 1, 1, 1, maxCols).setFontWeight('bold');
  // Bold the sub-header row for Recent Rounds
  dashboard.getRange(sectionStarts[4] + 1, 1, 1, maxCols).setFontWeight('bold');

  // Recent Rounds: vs Par column (col 6)
  if (recentN > 0) {
    dashboard.getRange(sectionStarts[4] + 2, 6, recentN, 1).setNumberFormat('+0;-0;"E"');
  }

  // Mulligan section formatting
  if (mulliganSectionStart > 0 && totalMulligans > 0) {
    // Bold the column-header row
    dashboard.getRange(mulliganSectionStart + 1, 1, 1, maxCols).setFontWeight('bold');
    // % of Total column (col 3) on the category rows — 4 rows starting at + 4
    dashboard.getRange(mulliganSectionStart + 4, 3, 4, 1).setNumberFormat('0%');
  }
  if (mulliganListStart > 0) {
    dashboard.getRange(mulliganListStart, 1, 1, maxCols).setFontWeight('bold').setBackground('#e0e0e0');
    dashboard.getRange(mulliganListStart + 1, 1, 1, maxCols).setFontWeight('bold');
  }

  dashboard.setFrozenRows(0);
  dashboard.autoResizeColumns(1, maxCols);
  // Force col 2 wider so detail text isn't cramped
  dashboard.setColumnWidth(2, 360);
}

// ─── ENTRY POINTS ────────────────────────────────────────────────────────────

function rebuildAll() {
  rebuildHoleSummary();
  rebuildClubSummary();
  rebuildDistanceSummary();
  rebuildDashboard();
  ui().alert('All summaries rebuilt.');
}

function onOpen() {
  ui().createMenu('Golf Stats')
    .addItem('Rebuild All Summaries', 'rebuildAll')
    .addSeparator()
    .addItem('Rebuild Hole Summary', 'rebuildHoleSummary')
    .addItem('Rebuild Club Summary', 'rebuildClubSummary')
    .addItem('Rebuild Distance Summary', 'rebuildDistanceSummary')
    .addItem('Rebuild Dashboard', 'rebuildDashboard')
    .addToUi();
}
