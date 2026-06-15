/* ============================================================================
   distance-tables.jsx — the six drill-down tables + the consistent gap cell.
   Exports: GapBar, GapChip, fmtSg, sevHex, and the five table components.
   The gap treatment is ONE primitive used everywhere a Tour benchmark exists;
   miss-patterns and around-the-green carry no benchmark, so they stay plain.
   ============================================================================ */
const { useState: useStateD } = React;

const fmtSg = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
const fmtGap = (g) => (g >= 0 ? "+" : "−") + Math.abs(g);

// severity → token hex (matches colors_and_type.css)
const SEV_HEX = ["#1E8F59", "#66726B", "#E07A3E", "#D5443B"]; // 0 ahead/even,1 low,2 clay,3 red
const sevHex = (sev) => SEV_HEX[sev ?? 1];

/* ── GapBar ────────────────────────────────────────────────────────────────
   Your achievement reads as a calm solid fill; the SHORTFALL to Tour is the
   striped, severity-colored space — the gap is literally the highlighted
   absence. Tour sits as a tick. Ahead-of-Tour shows the surplus in fairway. */
function GapBar({ you, tour, sev, max = 100, h = 8, dark = false }) {
  const ahead = you >= tour;
  const lo = Math.min(you, tour), hi = Math.max(you, tour);
  const col = ahead ? (dark ? "#7FE0A6" : "#1E8F59") : sevHex(sev);
  const stripe = `repeating-linear-gradient(-45deg, ${col}, ${col} 1.5px, transparent 1.5px, transparent 4px)`;
  return (
    <div className={"gapbar" + (dark ? " on-dark" : "")} style={{ height: h }}>
      {/* your achievement */}
      <span className="gb-fill" style={{ width: you + "%" }} />
      {/* the gap / surplus, striped + tinted by severity */}
      <span
        className="gb-gap"
        style={{
          left: lo + "%", width: (hi - lo) + "%",
          backgroundImage: stripe, opacity: ahead ? 0.5 : 0.85,
        }}
      />
      {/* Tour tick */}
      <span className="gb-tick" style={{ left: tour + "%" }} />
    </div>
  );
}

/* ── GapChip — signed points gap, severity-colored ─────────────────────────*/
function GapChip({ gap, sev, big }) {
  const ahead = gap >= 0;
  const cls = "gapchip" + (big ? " big" : "") + (ahead ? " ahead" : " sev" + sev);
  return <span className={cls}>{fmtGap(gap)}</span>;
}

/* ── GapCell — the consistent in-table treatment. style toggled via Tweaks ──
   'bar'  → mini you-vs-Tour bar + chip (default)
   'chip' → chip only
   'heat' → heat-mapped number only                                          */
function GapCell({ row, style }) {
  if (row.thin) return <span className="cell-thin" title={"n=" + row.n + " · below the 10-shot floor"}>—</span>;
  const sev = row.sev, gap = row.gap;
  const ahead = gap >= 0;
  if (style === "chip") return <div className="gc"><GapChip gap={gap} sev={sev} /></div>;
  if (style === "heat")
    return (
      <div className="gc">
        <span className="gc-heat" style={{ color: ahead ? "#1E8F59" : sevHex(sev) }}>{fmtGap(gap)}</span>
        <span className="gc-tour">≈ {row.tour}</span>
      </div>
    );
  // default: bar + chip
  return (
    <div className="gc">
      <div className="gc-row">
        <GapBar you={row.you} tour={row.tour} sev={sev} />
        <GapChip gap={gap} sev={sev} />
      </div>
      <span className="gc-tour">Tour ≈ {row.tour}%</span>
    </div>
  );
}

/* ── ordering: distance order, or biggest-gap (opportunity) first ───────────*/
function order(rows, sort, benched) {
  if (sort !== "gap" || !benched) return rows;
  return [...rows].sort((a, b) => {
    if (a.thin && !b.thin) return 1;
    if (b.thin && !a.thin) return -1;
    return (a.sgRd ?? 0) - (b.sgRd ?? 0);
  });
}

/* ── Table shell ───────────────────────────────────────────────────────────*/
function Section({ eyebrow, note, foot, children }) {
  return (
    <section className="d-block">
      <div className="d-sechead">
        <p className="eyebrow">{eyebrow}</p>
        {note ? <span className="d-note">{note}</span> : null}
      </div>
      <div className="tbl-wrap">
        <div className="tbl-scroll">{children}</div>
      </div>
      {foot ? <p className="d-foot">{foot}</p> : null}
    </section>
  );
}

/* ── 1. Make rate by distance ──────────────────────────────────────────────*/
function MakeRateTable({ W, cellStyle, sort }) {
  const rows = order(W.makeRate, sort, true);
  return (
    <Section eyebrow="Putting — make rate by distance">
      <table className="dtbl">
        <thead>
          <tr><th className="stick">Distance</th><th>Putts</th><th>Makes</th><th>Make%</th><th className="wgap">vs Tour</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.dist}>
              <td className="stick dist">{r.dist}</td>
              <td className="num">{r.n}</td>
              <td className="num">{r.makes}</td>
              <td className="num big">{r.you}%</td>
              <td className="gapwrap"><GapCell row={r} style={cellStyle} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

/* ── 2. Performance by first-putt distance ─────────────────────────────────*/
function FirstPuttTable({ W, cellStyle, sort }) {
  const rows = order(W.firstPutt, sort, true);
  return (
    <Section eyebrow="Putting — by first-putt distance">
      <table className="dtbl">
        <thead>
          <tr><th className="stick">Distance</th><th>Faced</th><th>Avg</th><th>1-Putt%</th><th className="wgap">vs Tour</th><th>3-Putt%</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.dist}>
              <td className="stick dist">{r.dist}</td>
              <td className="num">{r.faced}</td>
              <td className="num">{r.avg.toFixed(2)}</td>
              <td className="num big">{r.you}%</td>
              <td className="gapwrap"><GapCell row={r} style={cellStyle} /></td>
              <td className={"num" + (r.three >= 10 ? " warn" : "")}>{r.three}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

/* ── 3. Miss patterns (diagnostic — no benchmark) ──────────────────────────*/
function MissTable({ W }) {
  return (
    <Section eyebrow="Putting — miss patterns" note="diagnostic · no Tour band">
      <table className="dtbl">
        <thead>
          <tr><th className="stick">Distance</th><th>Misses</th><th>High</th><th>Low</th><th>Short</th><th>Long</th></tr>
        </thead>
        <tbody>
          {W.missPattern.map((r) => {
            const cells = [["high", r.high], ["low", r.low], ["short", r.short], ["long", r.long]];
            const top = Math.max(r.high, r.low, r.short, r.long);
            return (
              <tr key={r.dist} className={r.thin ? "rthin" : ""}>
                <td className="stick dist">{r.dist}</td>
                <td className="num">{r.n}{r.thin ? <span className="thin-tag">thin</span> : null}</td>
                {cells.map(([k, v]) => (
                  <td key={k} className={"num" + (!r.thin && v === top && v > 0 ? " lead" : "")}>{v}%</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

/* ── 4. Around the green (under 30 yds — no benchmark) ─────────────────────*/
function AroundGreenTable({ W }) {
  return (
    <Section eyebrow="Around the green — under 30 yds">
      <table className="dtbl">
        <thead>
          <tr><th className="stick">Distance</th><th>Shots</th><th>Qual</th><th>On Green%</th><th>Up&amp;Down%</th></tr>
        </thead>
        <tbody>
          {W.aroundGreen.map((r) => (
            <tr key={r.dist} className={r.thin ? "rthin" : ""}>
              <td className="stick dist">{r.dist}</td>
              <td className="num">{r.n}{r.thin ? <span className="thin-tag">thin</span> : null}</td>
              <td className="num">{r.qual.toFixed(2)}</td>
              <td className="num big">{r.onGreen}%</td>
              <td className="num">{r.updown}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

/* ── 5. Approach shots (30+ yds) ───────────────────────────────────────────*/
function ApproachTable({ W, cellStyle, sort }) {
  const rows = order(W.approach, sort, true);
  const foot = (
    <>Your widest gap by percentage is <strong>175+ yds (−24)</strong> — but it's a low-expectation range. You face <strong>75–125 yds</strong> nearly as often from distance you should hit, so it costs more strokes and ranks higher above.</>
  );
  return (
    <Section eyebrow="Approach shots — 30+ yds" foot={foot}>
      <table className="dtbl">
        <thead>
          <tr><th className="stick">Distance</th><th>Shots</th><th>Qual</th><th>Green%</th><th className="wgap">vs Tour</th><th>Miss L</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.dist}>
              <td className="stick dist">{r.dist}</td>
              <td className="num">{r.n}</td>
              <td className="num">{r.qual.toFixed(2)}</td>
              <td className="num big">{r.you}%</td>
              <td className="gapwrap"><GapCell row={r} style={cellStyle} /></td>
              <td className="num">{r.missL}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

Object.assign(window, {
  fmtSg, fmtGap, sevHex, GapBar, GapChip, GapCell,
  MakeRateTable, FirstPuttTable, MissTable, AroundGreenTable, ApproachTable,
});
