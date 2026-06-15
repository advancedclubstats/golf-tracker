/* ============================================================================
   distance-hero.jsx — "Biggest gaps to Tour": the ranked top-3 leaderboard.
   Answers "where am I furthest from elite, and does it matter?" in strokes,
   weighted by frequency, gated to n≥10 — before the player reads a table.
   ============================================================================ */

function heroSev(sgRd) {
  if (sgRd > -0.20) return 1;
  if (sgRd > -0.45) return 2;
  return 3;
}

function GapHero({ W, winLabel, dark = true }) {
  const top = W.hero;
  const total = top.reduce((s, g) => s + g.sgRd, 0);
  const totalStr = (total >= 0 ? "+" : "−") + Math.abs(total).toFixed(1);

  return (
    <div className={"hero" + (dark ? "" : " light")}>
      <div className="hero-head">
        <p className="eyebrow">Biggest gaps to Tour</p>
        <span className="hero-win">{winLabel}</span>
      </div>

      <div className="hero-lead">
        <span className="hero-num">{totalStr}<span className="u">strokes / round</span></span>
        <p className="hero-cap">live in your three widest gaps to elite play — ranked by <strong>strokes</strong>, not by raw percentage.</p>
      </div>

      <ol className="gaprank">
        {top.map((g, i) => {
          const sev = heroSev(g.sgRd);
          const per = g.perRound >= 1 ? "~" + g.perRound.toFixed(1) + " a round" : "~" + Math.round(g.perRound * 18) + " a round*";
          return (
            <li className="gr" key={g.label}>
              <div className="gr-top">
                <span className="gr-rank">{i + 1}</span>
                <span className="gr-name">{g.label}</span>
                <span className="gr-sg" style={{ color: window.sevHex(sev) }}>
                  {window.fmtSg(g.sgRd)}<span className="u">/rd</span>
                </span>
              </div>
              <div className="gr-bar">
                <window.GapBar you={g.you} tour={g.tour} sev={sev} h={10} dark={dark} />
              </div>
              <p className="gr-sub">
                {g.you}% {g.unit} vs Tour ≈ {g.tour}% · {g.count} {g.noun} · {per}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="hero-foot">
        Weighted by how often you face the shot · gated to buckets with ≥10 attempts · Tour values are band averages.
      </p>
    </div>
  );
}

window.GapHero = GapHero;
