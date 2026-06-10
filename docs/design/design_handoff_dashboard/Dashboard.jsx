/* Direction D — "Calm brief": hybrid of C (flat calm paper) + A's bold moments.
   Base = C's flat sections, hairline rows, two-up reference, no card chrome.
   Borrowed from A: the big stacked "Biggest leak" hero + the giant editorial
   "Where strokes are lost" number. Section headers are plain labels — no rule. */
function Dashboard() {
  const D = window.DASH;
  return (
    <div className="dir-d">
      <style>{`
        .dir-d { width:100%; min-height:100%; background:var(--paper); color:var(--ink-900);
                 font-family:var(--font-ui); padding:24px 22px 30px; box-sizing:border-box; }
        .dir-d .top { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
        .dir-d .top h1 { font-family:var(--font-display); font-weight:700; font-size:22px; letter-spacing:-.02em; margin:0; }
        .dir-d .nr { font-weight:600; font-size:13px; color:var(--fairway-900); background:var(--lime-500);
                 border:1px solid var(--lime-500); border-radius:var(--r-pill); padding:7px 15px; text-decoration:none; }

        /* hero — the anchor surface, tightened */
        .dir-d .hero { background:var(--lime-500); color:var(--fairway-900); border-radius:var(--r-md);
                 padding:16px 20px 18px; margin-bottom:36px; }
        .dir-d .hero .eb { font:var(--t-eyebrow); text-transform:uppercase; letter-spacing:.08em; word-spacing:-.14em;
                 color:color-mix(in oklab,var(--fairway-900) 55%,transparent); margin:0; }
        .dir-d .hero .ht { font-family:var(--font-display); font-weight:700; font-size:24px; letter-spacing:-.02em; margin:5px 0 2px; white-space:nowrap; }
        .dir-d .hero .hn { font-family:var(--font-mono); font-weight:700; font-size:38px; letter-spacing:-.03em; line-height:1; margin:7px 0 0; font-variant-numeric:tabular-nums; }
        .dir-d .hero .hn span { font-size:14px; font-weight:500; opacity:.62; margin-left:6px; letter-spacing:0; }
        .dir-d .hero .hsub { font-size:13.5px; margin:10px 0 0; color:color-mix(in oklab,var(--fairway-900) 78%,transparent); }

        /* flat sections — header is a plain label, NO rule. Consistent rhythm. */
        .dir-d .sec { margin-bottom:36px; }
        .dir-d .sec.tight { margin-bottom:26px; }
        .dir-d .eb-head { font:var(--t-eyebrow); text-transform:uppercase; letter-spacing:.08em; word-spacing:-.14em;
                 color:var(--ink-500); margin:0 0 16px; }

        .dir-d .row { display:flex; align-items:baseline; justify-content:space-between; gap:14px; padding:9px 0; }
        .dir-d .row + .row { border-top:1px solid var(--line); }
        .dir-d .row .l { font-size:14.5px; color:var(--ink-700); white-space:nowrap; }
        .dir-d .row .v { font-family:var(--font-mono); font-weight:500; font-size:14.5px; font-variant-numeric:tabular-nums; }
        .dir-d .pos { color:var(--fairway-600); } .dir-d .neg { color:var(--negative); }

        /* WHERE STROKES ARE LOST — subordinate to the hero number */
        .dir-d .bleed-num { font-family:var(--font-mono); font-weight:700; font-size:40px; line-height:.95;
                 letter-spacing:-.03em; color:var(--negative); font-variant-numeric:tabular-nums; }
        .dir-d .bleed-cap { font-size:13px; color:var(--ink-500); margin:6px 0 14px; }
        .dir-d .cat { display:flex; align-items:baseline; justify-content:space-between; gap:14px; padding:10px 0; border-top:1px solid var(--line); }
        .dir-d .cat .cl { font-size:15px; color:var(--ink-700); white-space:nowrap; }
        .dir-d .cat .cv { font-family:var(--font-mono); font-weight:600; font-size:16px; font-variant-numeric:tabular-nums; }
        .dir-d .cat.total { border-top-width:2px; border-top-color:var(--ink-900); margin-top:2px; }
        .dir-d .cat.total .cl { font-weight:600; color:var(--ink-900); }
        .dir-d .cat.total .cv { font-weight:700; }

        /* scoring shape */
        .dir-d .ss-head { display:flex; align-items:baseline; gap:9px; margin-bottom:14px; }
        .dir-d .ss-net { font-family:var(--font-mono); font-weight:700; font-size:32px; color:var(--fairway-600); letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
        .dir-d .ss-cap { font-size:13px; color:var(--ink-500); }
        .dir-d .ss-bar { display:flex; height:10px; border-radius:var(--r-pill); overflow:hidden; margin-bottom:14px; }
        .dir-d .ss-grid { display:flex; flex-direction:column; gap:1px; }
        .dir-d .ss-it { display:flex; align-items:center; justify-content:space-between; font-size:14px; padding:7px 0; }
        .dir-d .ss-it + .ss-it { border-top:1px solid var(--line); }
        .dir-d .ss-it .l { display:flex; align-items:center; gap:9px; color:var(--ink-700); }
        .dir-d .dot { width:8px; height:8px; border-radius:50%; flex:none; }
        .dir-d .ss-v { font-family:var(--font-mono); font-variant-numeric:tabular-nums; white-space:nowrap; }
        .dir-d .ss-v .t { font-size:11.5px; color:var(--ink-300); margin-left:8px; }
        .dir-d .ss-v .g { font-size:11.5px; margin-left:8px; font-weight:600; }

        /* leak list */
        .dir-d .leak { padding:12px 0; }
        .dir-d .leak + .leak { border-top:1px solid var(--line); }
        .dir-d .leak-row { display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
        .dir-d .leak-l { display:flex; align-items:baseline; gap:10px; min-width:0; }
        .dir-d .leak-rank { font-family:var(--font-mono); font-size:13px; color:var(--ink-300); }
        .dir-d .leak-t { font-size:15.5px; font-weight:600; letter-spacing:-.01em; white-space:nowrap; }
        .dir-d .leak-sg { font-family:var(--font-mono); font-weight:700; font-size:15.5px; color:var(--negative); font-variant-numeric:tabular-nums; white-space:nowrap; }
        .dir-d .leak-sg em { font-style:normal; font-size:10.5px; font-weight:500; color:var(--ink-300); margin-left:3px; }
        .dir-d .leak-sub { font-size:12.5px; color:var(--ink-500); margin-top:3px; padding-left:23px; }
        /* early reads — compact footnote of muted chips, not full rows */
        .dir-d .er-cap { font-size:12.5px; color:var(--ink-500); margin:18px 0 10px; padding-top:16px; border-top:1px solid var(--line); }
        .dir-d .er-chips { display:flex; flex-wrap:wrap; gap:8px; }
        .dir-d .er-chip { display:inline-flex; align-items:baseline; gap:6px; font-family:var(--font-mono);
                 font-size:12.5px; color:var(--ink-700); background:var(--paper-sunk);
                 border-radius:var(--r-pill); padding:5px 11px; font-variant-numeric:tabular-nums; }
        .dir-d .er-chip b { font-weight:600; color:var(--ink-900); }
        .dir-d .er-chip .cv { color:var(--negative); font-weight:600; }

        /* two-up reference (C) — tightened key/value ledger */
        .dir-d .duo { display:grid; grid-template-columns:1fr 1fr; gap:0 30px; }
        .dir-d .duo .row { padding:7.5px 0; }
        .dir-d .duo .l { font-size:12.5px; color:var(--ink-500); }
        .dir-d .duo .v { font-size:13px; font-weight:600; color:var(--ink-900); }

        /* table (C) */
        .dir-d table.rounds { width:100%; border-collapse:collapse; font-family:var(--font-mono); font-size:13px; font-variant-numeric:tabular-nums; }
        .dir-d table.rounds th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-300); font-weight:600; padding:0 8px 8px 0; }
        .dir-d table.rounds th:last-child, .dir-d table.rounds td:last-child { text-align:right; padding-right:0; }
        .dir-d table.rounds td { padding:7px 8px 7px 0; color:var(--ink-700); border-top:1px solid var(--line); }
      `}</style>

      <div className="top">
        <h1>Dashboard</h1>
        <a className="nr" href="#">New Round →</a>
      </div>

      {/* HERO — A's bigger stacked treatment */}
      <div className="hero">
        <p className="eb">Biggest leak</p>
        <div className="ht">{D.hero.title}</div>
        <div className="hn">{D.hero.sg}<span>/ round</span></div>
        <p className="hsub">{D.hero.sub}</p>
      </div>

      {/* SCORING SHAPE */}
      <div className="sec">
        <p className="eb-head">Scoring shape</p>
        <div className="ss-head"><span className="ss-net">{D.scoringNet}</span><span className="ss-cap">birdies − doubles per hole</span></div>
        <div className="ss-bar">{D.bands.map((b) => <div key={b.key} style={{ width: b.rate + "%", background: D.bandColor[b.key] }} />)}</div>
        <div className="ss-grid">
          {D.bands.map((b) => (
            <div className="ss-it" key={b.key}>
              <span className="l"><span className="dot" style={{ background: D.bandColor[b.key] }} />{b.label}</span>
              <span className="ss-v">{b.rate}%<span className="t">/ {b.target}%</span>
                {b.delta && <span className="g" style={{ color: b.good ? "var(--fairway-600)" : b.good === false ? "var(--negative)" : "var(--ink-300)" }}>{b.delta}</span>}</span>
            </div>
          ))}
        </div>
      </div>

      {/* WHERE STROKES ARE LOST — A's number, now subordinate */}
      <div className="sec">
        <p className="eb-head">Where strokes are lost</p>
        <div className="bleed-num">{D.strokesLostTotal}</div>
        <div className="bleed-cap">per round vs scratch</div>
        {D.strokesLost.map((c) => (
          <div className="cat" key={c.label}>
            <span className="cl">{c.label}</span>
            <span className={"cv " + (c.neg ? "neg" : "pos")}>{c.v}/rd</span>
          </div>
        ))}
      </div>

      {/* WHAT TO WORK ON */}
      <div className="sec">
        <p className="eb-head">What to work on</p>
        {D.leaks.map((l) => (
          <div className="leak" key={l.rank}>
            <div className="leak-row"><span className="leak-l"><span className="leak-rank">{l.rank}.</span><span className="leak-t">{l.title}</span></span><span className="leak-sg">{l.sg}<em>/rd</em></span></div>
            <div className="leak-sub">{l.sub ? l.sub + " · " : ""}{l.shots} shots</div>
          </div>
        ))}
        <p className="er-cap">Early reads — not enough data to prescribe yet</p>
        <div className="er-chips">
          {D.earlyReads.map((l) => (
            <span className="er-chip" key={l.title}><b>{l.title}</b><span className="cv">{l.sg}</span></span>
          ))}
        </div>
      </div>

      {/* SNAPSHOT + STAT LINE two-up (C) */}
      <div className="sec">
        <div className="duo">
          <div>
            <p className="eb-head">Snapshot</p>
            {D.snapshot.map((r) => <div className="row" key={r.label}><span className="l">{r.label}</span><span className="v">{r.value}</span></div>)}
          </div>
          <div>
            <p className="eb-head">Stat line</p>
            {D.statLine.map((r) => <div className="row" key={r.label}><span className="l">{r.label}</span><span className="v">{r.value}</span></div>)}
          </div>
        </div>
      </div>

      {/* RECENT ROUNDS (C) */}
      <div className="sec">
        <p className="eb-head">Recent rounds</p>
        <table className="rounds">
          <thead><tr><th>Date</th><th>Holes</th><th>Strokes</th><th>vs Par</th></tr></thead>
          <tbody>{D.recentRounds.map((r) => <tr key={r.date}><td>{r.date}</td><td>{r.holes}</td><td>{r.strokes}</td><td>{r.vsPar}</td></tr>)}</tbody>
        </table>
      </div>

      {/* COURSE RECORDS (C) */}
      <div className="sec" style={{ marginBottom: 0 }}>
        <p className="eb-head">Course records</p>
        {D.records.map((r) => <div className="row" key={r.label}><span className="l">{r.label}</span><span className="v">{r.value}</span></div>)}
      </div>
    </div>
  );
}
window.Dashboard = Dashboard;
