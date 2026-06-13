// momentum.jsx — Momentum dashboard section: 3 layout directions + early state.
// All data is mock but constructed to exercise the brief's magnitude × direction
// framework. Components export to window for the canvas host.
const { useState } = React;

/* ── Data model ───────────────────────────────────────────────────────────
   Each SG category trends on its own window: last 5 rounds vs the prior 5.
   `state` = current all-time SG/round (matches "Where strokes are lost").
   `delta` = recent-5 mean − prior-5 mean (the momentum).
   `prior`/`recent` = slice means (for the dumbbell).
   `spark` = last 10 round values (oldest→newest) for the sparkline.            */
const CATS = {
  putting:   { name: 'Putting',     state: -1.32, delta: +0.41, prior: -1.55, recent: -1.14,
               spark: [-1.9,-1.7,-1.8,-1.5,-1.6,-1.4,-1.3,-1.2,-1.0,-0.9], rank: 1, leak: true },
  tee:       { name: 'Off the tee', state: +0.83, delta: +0.30, prior: +0.68, recent: +0.98,
               spark: [0.3,0.45,0.4,0.6,0.55,0.7,0.72,0.85,0.9,1.02], strength: true },
  approach:  { name: 'Approach',    state: -0.52, delta: -0.48, prior: -0.28, recent: -0.76,
               spark: [-0.05,-0.15,-0.1,-0.2,-0.32,-0.4,-0.45,-0.55,-0.62,-0.78], rank: 2, leak: true },
  shortgame: { name: 'Short game',  state: +0.03, delta: -0.22, prior: +0.14, recent: -0.08,
               spark: [0.32,0.25,0.22,0.12,0.1,0.04,-0.02,-0.08,-0.14,-0.2] },
};
const GAINING = [CATS.putting, CATS.tee];
const SLIPPING = [CATS.approach, CATS.shortgame];

const fmt = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);

/* ── Sparkline ─────────────────────────────────────────────────────────── */
function Sparkline({ points, color, w = 76, h = 26, showZero = true }) {
  const pad = 3;
  const min = Math.min(...points, showZero ? 0 : Infinity);
  const max = Math.max(...points, showZero ? 0 : -Infinity);
  const range = (max - min) || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const xy = points.map((p, i) => [pad + i * step, pad + (h - pad * 2) * (1 - (p - min) / range)]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${pad},${h - pad} ${line} ${(w - pad).toFixed(1)},${h - pad}`;
  const zeroY = pad + (h - pad * 2) * (1 - (0 - min) / range);
  const last = xy[xy.length - 1];
  const gid = 'sg' + Math.round(points[0] * 1000) + color.length;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', flex: '0 0 auto' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showZero && <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.35" />}
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

/* ── "Where strokes are lost" — the static-state block (verbatim from dash) ─ */
function WhereStrokesLost() {
  return (
    <div className="card">
      <p className="eyebrow"><a className="wsl-link" href="#">Where strokes are lost →</a></p>
      <div className="divide">
        <div className="row"><span className="muted">Putting</span><span className="val mono neg">−1.32/rd</span></div>
        <div className="row"><span className="muted">Approach</span><span className="val mono neg">−0.52/rd</span></div>
        <div className="row"><span className="muted">Short game</span><span className="val mono pos">+0.03/rd</span></div>
        <div className="row"><span className="muted">Off the tee</span><span className="val mono pos">+0.83/rd</span></div>
        <div className="row"><span style={{ fontWeight: 500 }}>Total per round vs scratch</span><span className="val mono neg" style={{ fontWeight: 600 }}>−0.99</span></div>
      </div>
    </div>
  );
}

const Caret = ({ dir }) => (
  <span className={dir === 'up' ? 'pos' : 'neg'} style={{ fontSize: 11, lineHeight: 1 }}>{dir === 'up' ? '▲' : '▼'}</span>
);
const Tag = ({ tone, children }) => (
  <span className={'mtag mtag-' + tone}>{children}</span>
);

/* ── Direction A — Paired ledger (clean, no sparkline) ─────────────────────
   The restrained default. Two labelled groups in the existing row/divide
   idiom. Magnitude×direction encoded by tint: the big-leak-worsening item
   (Approach) gets the strongest red wash; the big-leak-improving item
   (Putting) gets a green "it's working" wash.                               */
function MomentumA() {
  return (
    <div className="card">
      <div className="m-head">
        <p className="eyebrow">Momentum</p>
        <span className="m-win">vs prior 5 rounds</span>
      </div>
      <div className="m-group-label"><Caret dir="up" />Gaining</div>
      <div className="divide">
        <div className="m-row tint-good">
          <span className="m-l"><span className="m-name">Putting</span><Tag tone="good">#1 leak · working</Tag></span>
          <span className="m-r"><span className="mono pos m-d">{fmt(CATS.putting.delta)}</span><span className="m-u">/rd · last 5</span></span>
        </div>
        <div className="m-row">
          <span className="m-l"><span className="m-name">Off the tee</span><Tag tone="lime">weapon</Tag></span>
          <span className="m-r"><span className="mono pos m-d">{fmt(CATS.tee.delta)}</span><span className="m-u">/rd · last 5</span></span>
        </div>
      </div>
      <div className="m-group-label slip"><Caret dir="down" />Slipping</div>
      <div className="divide">
        <div className="m-row tint-bad">
          <span className="m-l"><span className="m-name">Approach</span><Tag tone="bad">#2 leak · accelerating</Tag></span>
          <span className="m-r"><span className="mono neg m-d">{fmt(CATS.approach.delta)}</span><span className="m-u">/rd · last 5</span></span>
        </div>
        <div className="m-row">
          <span className="m-l"><span className="m-name">Short game</span><Tag tone="warn">new slip</Tag></span>
          <span className="m-r"><span className="mono neg m-d">{fmt(CATS.shortgame.delta)}</span><span className="m-u">/rd · last 5</span></span>
        </div>
      </div>
      <p className="m-foot">Only categories past the 10-round floor that moved meaningfully. Momentum lives only here.</p>
    </div>
  );
}

/* ── Direction B — Buckets with compact sparklines ─────────────────────── */
function SparkRow({ cat, dir }) {
  const color = dir === 'up' ? 'var(--positive)' : 'var(--destructive)';
  const tag = cat.leak ? (dir === 'up' ? { tone: 'good', t: '#' + cat.rank + ' leak · working' } : { tone: 'bad', t: '#' + cat.rank + ' leak · accelerating' })
    : cat.strength ? { tone: 'lime', t: 'weapon' } : { tone: 'warn', t: 'new slip' };
  return (
    <div className="sb-row">
      <div className="sb-top">
        <span className="m-name">{cat.name}</span>
        <Tag tone={tag.tone}>{tag.t}</Tag>
      </div>
      <div className="sb-bot">
        <span style={{ color }}><Sparkline points={cat.spark} color={color} /></span>
        <span className="sb-delta">
          <span className={'mono m-d ' + (dir === 'up' ? 'pos' : 'neg')}>{fmt(cat.delta)}</span>
          <span className="m-u">/rd · last 5 rounds</span>
        </span>
      </div>
    </div>
  );
}
function MomentumB() {
  return (
    <div className="card">
      <div className="m-head">
        <p className="eyebrow">Momentum</p>
        <span className="m-win">vs prior 5 rounds</span>
      </div>
      <div className="sb-bucket">
        <div className="m-group-label"><Caret dir="up" />Gaining</div>
        <SparkRow cat={CATS.putting} dir="up" />
        <SparkRow cat={CATS.tee} dir="up" />
      </div>
      <div className="sb-bucket">
        <div className="m-group-label slip"><Caret dir="down" />Slipping</div>
        <SparkRow cat={CATS.approach} dir="down" />
        <SparkRow cat={CATS.shortgame} dir="down" />
      </div>
      <p className="m-foot">Sparkline = your last 10 rounds in that category. Dotted line is scratch.</p>
    </div>
  );
}

/* ── Direction C — Movement map (dumbbell along the SG axis) ─────────────── */
function MovementRow({ cat }) {
  const lo = -2.0, hi = 1.5, span = hi - lo;
  const pct = (v) => ((v - lo) / span) * 100;
  const up = cat.delta >= 0;
  const color = up ? 'var(--positive)' : 'var(--destructive)';
  const a = pct(cat.prior), b = pct(cat.recent);
  const left = Math.min(a, b), width = Math.abs(b - a);
  return (
    <div className="mv-row">
      <span className="mv-name">{cat.name}</span>
      <div className="mv-track">
        <span className="mv-zero" style={{ left: pct(0) + '%' }}></span>
        <span className="mv-seg" style={{ left: left + '%', width: width + '%', background: color }}></span>
        <span className="mv-prior" style={{ left: a + '%' }}></span>
        <span className="mv-now" style={{ left: b + '%', background: color }}></span>
      </div>
      <span className={'mono mv-d ' + (up ? 'pos' : 'neg')}>{fmt(cat.delta)}</span>
    </div>
  );
}
function MomentumC() {
  return (
    <div className="card">
      <div className="m-head">
        <p className="eyebrow">Momentum · what moved</p>
        <span className="m-win">last 5 vs prior 5</span>
      </div>
      <div className="mv-axis"><span>losing</span><span className="mv-axis-0">scratch</span><span>gaining</span></div>
      <div className="mv-list">
        <MovementRow cat={CATS.putting} />
        <MovementRow cat={CATS.approach} />
        <MovementRow cat={CATS.tee} />
        <MovementRow cat={CATS.shortgame} />
      </div>
      <div className="mv-legend">
        <span><span className="lg-dot prior"></span>5 rounds ago</span>
        <span><span className="lg-dot now"></span>now</span>
      </div>
      <div className="mv-headline">
        <span className="neg">▼</span> Biggest swing: <strong>Approach −0.48/rd</strong> — your #2 leak is accelerating.
      </div>
    </div>
  );
}

/* ── Early state — below the 2N floor, momentum is honestly absent ──────── */
function MomentumEarly() {
  return (
    <div className="card">
      <div className="m-head">
        <p className="eyebrow">Momentum</p>
        <span className="m-win">vs prior 5 rounds</span>
      </div>
      <div className="m-empty">
        <p className="m-empty-h">Not enough rounds yet</p>
        <p className="m-empty-b">Momentum compares your last 5 rounds with the 5 before — it needs about <strong>10 rounds</strong> per category. You have <strong>4</strong>.</p>
        <div className="m-empty-bar"><span style={{ width: '40%' }}></span></div>
        <p className="m-empty-c"><span className="mono">4 / 10 rounds</span> · we’ll never guess a trend from too little data.</p>
      </div>
    </div>
  );
}

Object.assign(window, { Sparkline, WhereStrokesLost, MomentumA, MomentumB, MomentumC, MomentumEarly });
