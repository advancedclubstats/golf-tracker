// tables.jsx — Ask 2: trend treatment for the detail tables.
// Primary: compact in-cell trend (glyph or mini-sparkline), never a new
// numeric column. Fallback: one global "Last N / All" filter when even a
// glyph would overflow. 2N floor applies per row — no data, no trend.
const { useState: useStateT } = React;

const fmtT = (v) => (v >= 0 ? '+' : '−') + Math.abs(v);

/* Carry-trend glyph: ▲/▼ + signed value, colored, appended to an existing
   cell. Below the 40-shot floor → a faint dash, never a guess.            */
function CarryTrend({ d, floor }) {
  if (floor) return <span className="ct-none" title="Needs 40 shots">—</span>;
  const up = d >= 0;
  return <span className={'ct ' + (up ? 'pos' : 'neg')}>{up ? '▲' : '▼'}{Math.abs(d)}</span>;
}

const CLUBS = [
  { c: 'Driver', carry: 248, d: +3, total: 271, smash: 1.48, disp: 31, miss: '8L / 12R' },
  { c: '3W', carry: 226, d: -2, total: 241, smash: 1.46, disp: 28, miss: '6L / 9R' },
  { c: '5i', carry: 188, d: +2, total: 196, smash: 1.38, disp: 24, miss: '5L / 7R' },
  { c: '7i', carry: 162, d: +4, total: 168, smash: 1.33, disp: 19, miss: '4L / 6R' },
  { c: '9i', carry: 138, d: -1, total: 142, smash: 1.28, disp: 15, miss: '3L / 5R' },
  { c: 'PW', carry: 118, d: -3, total: 120, smash: 1.24, disp: 12, miss: '2L / 4R' },
  { c: 'GW', carry: 96, floor: true, total: 97, smash: 1.21, disp: 11, miss: '3L / 3R' },
  { c: '4i', carry: 178, floor: true, total: 185, smash: 1.36, disp: 26, miss: '—' },
];

function ClubsTable() {
  return (
    <div className="card tbl-card">
      <div className="m-head">
        <p className="eyebrow">Clubs · carry</p>
        <span className="tbl-win">▲▼ = vs prior 20 shots</span>
      </div>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr><th className="sticky-c">Club</th><th>Carry</th><th>Total</th><th>Smash</th><th>Disp</th><th>Miss L/R</th></tr>
          </thead>
          <tbody>
            {CLUBS.map((r) => (
              <tr key={r.c}>
                <td className="sticky-c club">{r.c}</td>
                <td className="num"><span className="cnum">{r.carry}</span><CarryTrend d={r.d} floor={r.floor} /></td>
                <td className="num">{r.total}</td>
                <td className="num">{r.smash.toFixed(2)}</td>
                <td className="num">{r.disp}<span className="u">y</span></td>
                <td className="num miss">{r.miss}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="tbl-fade"></div>
      </div>
      <p className="m-foot">In-cell glyph rides inside the Carry value — no new column, no extra width. GW &amp; 4i sit below the 40-shot floor, so they show no trend.</p>
    </div>
  );
}

/* Holes — fewer columns, so a mini-sparkline tucks INSIDE the vs-par cell.
   Window: last 5 times you played the hole. Floor = 10 plays.            */
const HOLES = [
  { h: 7, par: 3, avg: 3.9, vs: +0.9, spark: [0.4, 0.6, 0.5, 0.8, 0.7, 0.9, 1.0, 0.9, 1.1, 0.9], dir: 'down' },
  { h: 1, par: 4, avg: 4.6, vs: +0.6, spark: [0.9, 0.8, 0.7, 0.8, 0.6, 0.7, 0.5, 0.6, 0.5, 0.4], dir: 'up' },
  { h: 2, par: 5, avg: 4.9, vs: -0.1, spark: [0.3, 0.2, 0.1, 0.0, 0.1, -0.1, 0.0, -0.1, -0.2, -0.1], dir: 'up' },
  { h: 12, par: 4, avg: 4.2, vs: +0.2, spark: [0.5, 0.4, 0.5, 0.3, 0.4, 0.2, 0.3, 0.2, 0.1, 0.2], dir: 'up' },
  { h: 18, par: 5, avg: 5.5, vs: +0.5, floor: true },
];

function HolesTable() {
  return (
    <div className="card tbl-card">
      <div className="m-head">
        <p className="eyebrow">Holes · scoring</p>
        <span className="tbl-win">trend = last 5 plays</span>
      </div>
      <div className="tbl-scroll">
        <table className="tbl holes">
          <thead>
            <tr><th className="sticky-c">Hole</th><th>Par</th><th>Avg</th><th className="vp-h">vs Par · last 5</th></tr>
          </thead>
          <tbody>
            {HOLES.map((r) => {
              const up = r.dir === 'up';
              const color = up ? 'var(--positive)' : 'var(--destructive)';
              return (
                <tr key={r.h}>
                  <td className="sticky-c club">{r.h}</td>
                  <td className="num">{r.par}</td>
                  <td className="num">{r.avg.toFixed(1)}</td>
                  <td className="num vp">
                    <span className={'vpnum ' + (r.vs > 0 ? 'neg' : 'pos')}>{fmtT(r.vs)}</span>
                    {r.floor
                      ? <span className="ct-none vp-none">— needs 10 plays</span>
                      : <span style={{ color }}><Sparkline points={r.spark} color={color} w={56} h={20} showZero={true} /></span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="m-foot">Sparkline lives inside the vs-par cell — last 5 times you played the hole. Hole 18 (9 plays) is below the 10-play floor: no spark, no guess.</p>
    </div>
  );
}

/* Distance / gapping — wide enough that an in-cell glyph would push Roll +
   Total off-screen. Breakpoint reached → ONE global window control re-windows
   the whole table. No per-row trend, no extra width.                       */
const DIST = {
  recent: [
    { c: 'Driver', carry: 251, roll: 22, total: 273, gap: 25 },
    { c: '3W', carry: 226, roll: 14, total: 240, gap: 38 },
    { c: '5i', carry: 188, roll: 8, total: 196, gap: 26 },
    { c: '7i', carry: 162, roll: 6, total: 168, gap: 24 },
    { c: '9i', carry: 138, roll: 4, total: 142, gap: 20 },
    { c: 'PW', carry: 118, roll: 2, total: 120, gap: null },
  ],
  all: [
    { c: 'Driver', carry: 248, roll: 23, total: 271, gap: 24 },
    { c: '3W', carry: 224, roll: 15, total: 239, gap: 36 },
    { c: '5i', carry: 188, roll: 8, total: 196, gap: 26 },
    { c: '7i', carry: 158, roll: 6, total: 164, gap: 22 },
    { c: '9i', carry: 136, roll: 4, total: 140, gap: 20 },
    { c: 'PW', carry: 116, roll: 2, total: 118, gap: null },
  ],
};

function DistanceFallback() {
  const [win, setWin] = useStateT('recent');
  const rows = DIST[win];
  return (
    <div className="card tbl-card">
      <div className="m-head">
        <p className="eyebrow">Distance · gapping</p>
      </div>
      <div className="seg">
        <button className={'seg-btn' + (win === 'recent' ? ' on' : '')} onClick={() => setWin('recent')}>Last 20 shots</button>
        <button className={'seg-btn' + (win === 'all' ? ' on' : '')} onClick={() => setWin('all')}>All time</button>
      </div>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr><th className="sticky-c">Club</th><th>Carry</th><th>Roll</th><th>Total</th><th>Gap</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c}>
                <td className="sticky-c club">{r.c}</td>
                <td className="num">{r.carry}</td>
                <td className="num">{r.roll}</td>
                <td className="num">{r.total}</td>
                <td className="num">{r.gap == null ? '—' : r.gap + 'y'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-foot">Five numeric columns leave no room for a per-cell glyph. One window control re-computes every row — never per-row, never per-section.</p>
    </div>
  );
}

Object.assign(window, { ClubsTable, HolesTable, DistanceFallback });
