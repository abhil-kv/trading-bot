/**
 * NineSeventeenStrategy.jsx — 9:17 Buying Options Strategy
 *
 * Strategy:
 *   At 09:17 (or on "Start Trade") → fetch NIFTY option chain from NSE.
 *   Find CE & PE strike whose LTP is closest to ₹140 → lock as reference price.
 *
 *   Entry per leg (independent):
 *     Wait & Trade: currentLTP >= lockedPrice × 1.115  (rises 11.5%)
 *     SL  = lockedPrice × 0.20  (20% of locked price — absolute floor)
 *     TGT = lockedPrice × 2.00  (doubles from locked)
 *
 *   Conditions before entry:
 *     • India VIX between 10 and 50
 *     • NOT Monday
 *
 *   Force exit: 15:28 PM (before 15:29 cutoff)
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:4000/api'
).replace(/\/api$/, '');

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}/api/options${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || json.message || `HTTP ${res.status}`);
  return json;
}

/* ── formatters ──────────────────────────────────────────────────────────── */
const inr = (n, dec = 2) =>
  n == null
    ? '—'
    : `₹${Number(n).toLocaleString('en-IN', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      })}`;

const pct = (n) => (n == null ? '—' : `${Number(n).toFixed(1)}%`);

const pnlStr = (n) => {
  if (n == null) return '—';
  const abs = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n >= 0 ? '+' : '−'}₹${abs}`;
};

const pnlColor = (n) => {
  if (n > 0)  return '#2ecc8f';
  if (n < 0)  return '#ff5c5c';
  return 'var(--text-dim)';
};

/* ── status maps ─────────────────────────────────────────────────────────── */
const S = {
  IDLE:    { label: 'Idle',     bg: '#232a38', fg: '#8b93a7' },
  LOCKED:  { label: 'Locked',   bg: '#2d2208', fg: '#f0b429' },
  RUNNING: { label: 'Running',  bg: '#0d1f40', fg: '#4c7cff' },
  EXITED:  { label: 'Exited',   bg: '#1a1d24', fg: '#6b7280' },
};

const LS = {
  WATCHING: { label: 'Watching', bg: 'rgba(240,180,41,0.12)',  fg: '#f0b429' },
  OPEN:     { label: 'Open',     bg: 'rgba(76,124,255,0.15)',  fg: '#4c7cff' },
  SL_HIT:   { label: 'SL Hit',   bg: 'rgba(255,92,92,0.15)',   fg: '#ff5c5c' },
  TGT_HIT:  { label: 'TGT Hit',  bg: 'rgba(46,204,143,0.15)',  fg: '#2ecc8f' },
  EXITED:   { label: 'Exited',   bg: 'rgba(107,114,128,0.15)', fg: '#6b7280' },
};

/* ── badge ────────────────────────────────────────────────────────────────── */
function Badge({ label, bg, fg, style = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: bg, color: fg, letterSpacing: '0.04em',
      border: `1px solid ${fg}30`, ...style,
    }}>
      {label}
    </span>
  );
}

/* ── section heading ─────────────────────────────────────────────────────── */
function SH({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--text-dim)',
      paddingBottom: 8, borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px', background: 'var(--surface)', border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
          color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 0 2px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
}

/* ── Blueprint ───────────────────────────────────────────────────────────── */
function Blueprint() {
  const legs = [
    { id: 'L1', type: 'CALL', target: '~₹140', wt: '+11.5%', sl: '−20% of locked', tgt: '+100%' },
    { id: 'L2', type: 'PUT',  target: '~₹140', wt: '+11.5%', sl: '−20% of locked', tgt: '+100%' },
  ];

  const meta = [
    ['Scan / Entry Time',  '09:17 AM (or "Start Trade")'],
    ['Force Exit',         '15:28 PM'],
    ['Lots / Leg',         '1'],
    ['Action',             'BUY both legs independently'],
    ['VIX Gate',           '10 – 50'],
    ['Day Filter',         'No trades on Monday'],
  ];

  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* meta row */}
      <div style={{
        display: 'flex', gap: 24, padding: '12px 20px', flexWrap: 'wrap',
        borderBottom: '1px solid var(--border)', background: 'var(--bg)',
        fontSize: 12, color: 'var(--text-dim)',
      }}>
        {meta.map(([k, v]) => (
          <span key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{k}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{v}</span>
          </span>
        ))}
      </div>

      {/* legs table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            {['Leg', 'Action', 'Type', 'Scan Price', 'W&T Trigger', 'Stop Loss', 'Target'].map(h => (
              <th key={h} style={{
                padding: '9px 16px', textAlign: 'left', fontWeight: 600,
                color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase',
                letterSpacing: '0.06em', borderBottom: '1px solid var(--border)',
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {legs.map((row, i) => (
            <tr key={row.id} style={{
              background: 'rgba(46,204,143,0.03)',
              borderBottom: i < legs.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <td style={{ padding: '11px 16px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{row.id}</td>
              <td style={{ padding: '11px 16px' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 5,
                  fontSize: 11, fontWeight: 700,
                  background: 'rgba(46,204,143,0.15)', color: '#2ecc8f',
                  border: '1px solid rgba(46,204,143,0.3)',
                }}>BUY</span>
              </td>
              <td style={{ padding: '11px 16px', fontWeight: 700, color: row.type === 'CALL' ? '#4c7cff' : '#f59e0b' }}>
                {row.type}
              </td>
              <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>{row.target}</td>
              <td style={{ padding: '11px 16px' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                  fontSize: 11, fontWeight: 700, color: '#f0b429',
                  background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.3)',
                }}>W&T {row.wt}</span>
              </td>
              <td style={{ padding: '11px 16px' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                  fontSize: 11, fontWeight: 700, color: '#ff5c5c',
                  background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.3)',
                }}>SL {row.sl}</span>
              </td>
              <td style={{ padding: '11px 16px' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                  fontSize: 11, fontWeight: 700, color: '#2ecc8f',
                  background: 'rgba(46,204,143,0.1)', border: '1px solid rgba(46,204,143,0.3)',
                }}>TGT {row.tgt}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── VIX badge ───────────────────────────────────────────────────────────── */
function VixBadge({ vix }) {
  if (vix == null) {
    return (
      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        VIX —
      </span>
    );
  }
  const ok = vix >= 10 && vix <= 50;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: ok ? 'rgba(46,204,143,0.1)' : 'rgba(255,92,92,0.1)',
      color: ok ? '#2ecc8f' : '#ff5c5c',
      border: `1px solid ${ok ? 'rgba(46,204,143,0.3)' : 'rgba(255,92,92,0.3)'}`,
      fontFamily: 'var(--font-mono)',
    }}>
      VIX {vix.toFixed(2)}
      <span style={{ fontWeight: 400 }}>{ok ? '✓ in range' : '✗ out of range'}</span>
    </span>
  );
}

/* ── PnL summary ─────────────────────────────────────────────────────────── */
function PnlSummary({ strategy }) {
  const { totalRealized = 0, totalUnrealized = 0, totalPnl = 0, openLegs = 0, watchingLegs = 0, legs = [] } = strategy;
  const closed = legs.filter(l => !['OPEN', 'WATCHING'].includes(l.status)).length;

  const cards = [
    { label: 'Realized P&L',   val: totalRealized,   fmt: pnlStr, highlight: false },
    { label: 'Unrealized P&L', val: totalUnrealized, fmt: pnlStr, highlight: false },
    { label: 'Total P&L',      val: totalPnl,        fmt: pnlStr, highlight: true },
    { label: 'Watching',       val: `${watchingLegs}`, fmt: v => v, highlight: false },
    { label: 'Open / Closed',  val: `${openLegs} / ${closed}`, fmt: v => v, highlight: false },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {cards.map(({ label, val, fmt, highlight }) => (
        <div key={label} style={{
          background: 'var(--surface-2)',
          border: `1px solid ${highlight ? 'var(--accent-dim)' : 'var(--border)'}`,
          borderRadius: 10, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 6,
          boxShadow: highlight ? '0 0 0 1px var(--accent-dim)' : 'none',
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {label}
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: typeof val === 'number' ? pnlColor(val) : 'var(--text)' }}>
            {fmt(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Positions table ─────────────────────────────────────────────────────── */
function PositionsTable({ legs, paper }) {
  if (!legs?.length) return null;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
      {/* mode banner */}
      <div style={{
        padding: '7px 16px',
        background: paper ? 'rgba(109,40,217,0.07)' : 'rgba(217,119,6,0.07)',
        borderBottom: '1px solid var(--border)',
        fontSize: 11, fontWeight: 600,
        color: paper ? '#a78bfa' : '#f59e0b',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: paper ? '#a78bfa' : '#f59e0b',
          display: 'inline-block',
          animation: 'nspulse 1.5s ease-in-out infinite',
        }} />
        {paper
          ? 'PAPER MODE — simulated prices (no real orders)'
          : 'LIVE MODE — real Angel One LTPs (NFO) every 3 s'}
        <span style={{ marginLeft: 'auto', fontWeight: 400, color: 'var(--text-dim)', fontSize: 10 }}>
          Entry: W&T +11.5% of locked | SL: −20% of locked | TGT: +100% of locked
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            {['Leg', 'Type', 'NSE Symbol', 'Locked Price', 'W&T Trigger', 'Entry LTP', 'Current LTP', 'SL', 'Target', 'Qty', 'P&L', 'Status'].map(h => (
              <th key={h} style={{
                padding: '10px 12px', textAlign: 'left', fontWeight: 600,
                color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase',
                letterSpacing: '0.05em', borderBottom: '2px solid var(--border)',
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => {
            const lm      = LS[leg.status] || LS.WATCHING;
            const pnl     = leg.status === 'OPEN' ? leg.unrealizedPnl : leg.realizedPnl;
            const isWatch = leg.status === 'WATCHING';
            const isOpen  = leg.status === 'OPEN';
            const isCall  = leg.optionType === 'CE';

            // W&T progress: how far currentPrice has moved from lockedPrice toward wtTrigger
            // Show as: % of (currentPrice / lockedPrice - 1) × 100  — i.e. actual % gain from locked
            const wtGainPct = leg.lockedPrice
              ? ((leg.currentPrice - leg.lockedPrice) / leg.lockedPrice) * 100
              : 0;
            // Bar fill: progress from 0% to 11.5% (the trigger threshold)
            const wtBarPct = Math.min(100, Math.max(0, (wtGainPct / 11.5) * 100));

            // Target progress bar bounds: entry price → tgt price
            // Current dot position as % along [entryPrice, tgtPrice]
            const tgtRange = (leg.tgtPrice != null && leg.entryPrice != null)
              ? leg.tgtPrice - leg.entryPrice
              : null;
            const tgtDotPct = (isOpen && tgtRange && tgtRange > 0)
              ? Math.min(100, Math.max(0, ((leg.currentPrice - leg.entryPrice) / tgtRange) * 100))
              : null;

            return (
              <tr key={leg.legId} style={{
                background: 'rgba(46,204,143,0.02)',
                borderBottom: i < legs.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {/* Leg */}
                <td style={{ padding: '11px 12px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                  {leg.legId}
                </td>
                {/* Type */}
                <td style={{ padding: '11px 12px', fontWeight: 700, color: isCall ? '#4c7cff' : '#f59e0b' }}>
                  {leg.optionType}
                </td>
                {/* NSE Symbol */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {leg.tradingSymbol}
                </td>
                {/* Locked Price */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f0b429' }}>
                  {inr(leg.lockedPrice)}
                </td>
                {/* W&T Trigger — progress bar shows actual % gain from lockedPrice */}
                <td style={{ padding: '11px 12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f0b429', fontSize: 12 }}>
                      {inr(leg.wtTrigger)}
                    </span>
                    {/* Progress bar: tracks currentLTP vs lockedPrice (0 → +11.5%) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ position: 'relative', height: 6, width: 90, background: 'var(--border)', borderRadius: 3, overflow: 'visible', flexShrink: 0 }}>
                        {/* filled portion */}
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${wtBarPct}%`,
                          background: wtGainPct >= 11.5 ? '#2ecc8f' : wtGainPct > 0 ? '#f0b429' : 'var(--border)',
                          borderRadius: 3,
                          transition: 'width 0.4s',
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: wtGainPct >= 11.5 ? '#2ecc8f' : 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {wtGainPct >= 0 ? '+' : ''}{wtGainPct.toFixed(2)}%
                      </span>
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                      trigger at +11.5%
                    </span>
                  </div>
                </td>
                {/* Entry LTP */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', color: leg.entryPrice ? '#2ecc8f' : 'var(--text-faint)' }}>
                  {leg.entryPrice != null ? inr(leg.entryPrice) : <span style={{ fontSize: 11 }}>—</span>}
                </td>
                {/* Current LTP */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>
                  {inr(leg.currentPrice)}
                </td>
                {/* SL */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ff5c5c', fontSize: 12 }}>
                  {inr(leg.slPrice)}
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--text-faint)' }}>−20% of locked</span>
                </td>
                {/* Target — progress bar with entry marker + current-price dot */}
                <td style={{ padding: '11px 12px', minWidth: 160 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* price label */}
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#2ecc8f', fontSize: 12 }}>
                      {inr(leg.tgtPrice)}
                    </span>
                    {/* progress bar — only rendered when a leg is OPEN */}
                    {isOpen && tgtDotPct !== null ? (
                      <div style={{ position: 'relative', height: 8, width: '100%', minWidth: 120, maxWidth: 160, background: 'rgba(255,92,92,0.15)', borderRadius: 4 }}>
                        {/* green fill up to current price */}
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${tgtDotPct}%`,
                          background: 'rgba(46,204,143,0.4)',
                          borderRadius: 4,
                          transition: 'width 0.4s',
                        }} />
                        {/* vertical line: entry price (left edge = 0%) */}
                        <div style={{
                          position: 'absolute', left: '0%', top: -2, bottom: -2,
                          width: 2, background: '#4c7cff', borderRadius: 1,
                        }} title={`Entry: ${inr(leg.entryPrice)}`} />
                        {/* dot: current price */}
                        <div style={{
                          position: 'absolute',
                          left: `calc(${tgtDotPct}% - 5px)`,
                          top: '50%', transform: 'translateY(-50%)',
                          width: 10, height: 10, borderRadius: '50%',
                          background: tgtDotPct >= 100 ? '#2ecc8f' : '#fff',
                          border: `2px solid ${tgtDotPct >= 100 ? '#2ecc8f' : '#4c7cff'}`,
                          boxShadow: '0 0 3px rgba(0,0,0,0.4)',
                          transition: 'left 0.4s',
                          zIndex: 2,
                        }} title={`Current: ${inr(leg.currentPrice)}`} />
                      </div>
                    ) : (
                      <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>+100% of locked</span>
                    )}
                    {isOpen && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                        <span title="Entry price">E:{inr(leg.entryPrice, 0)}</span>
                        <span title="Target price">T:{inr(leg.tgtPrice, 0)}</span>
                      </div>
                    )}
                  </div>
                </td>
                {/* Qty */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {leg.lots}L × {leg.lotSize} = {leg.quantity}
                </td>
                {/* P&L */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: pnlColor(pnl), whiteSpace: 'nowrap' }}>
                  {isWatch ? <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>—</span> : pnlStr(pnl)}
                </td>
                {/* Status */}
                <td style={{ padding: '11px 12px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: lm.bg, color: lm.fg,
                    border: `1px solid ${lm.fg}40`, whiteSpace: 'nowrap',
                  }}>
                    {isWatch && (
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f0b429', display: 'inline-block', animation: 'nspulse 1.5s ease-in-out infinite' }} />
                    )}
                    {lm.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Activity log ────────────────────────────────────────────────────────── */
const EV_COLORS = {
  locked:      '#f0b429',
  watch:       '#f0b429',
  entry:       '#4c7cff',
  sl_hit:      '#ff5c5c',
  tgt_hit:     '#2ecc8f',
  exited:      '#6b7280',
  force_exit:  '#f59e0b',
  manual_exit: '#a78bfa',
  all_closed:  '#6b7280',
  blocked:     '#f59e0b',
  warn:        '#f59e0b',
  error:       '#ff5c5c',
};

function ActivityLog({ log }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log?.length]);

  if (!log?.length) return null;

  return (
    <div style={{ maxHeight: 240, overflowY: 'auto', background: 'var(--bg)' }}>
      {log.map((e, i) => {
        const evKey   = e.event?.toLowerCase();
        const evColor = EV_COLORS[evKey] || 'var(--text-dim)';
        return (
          <div key={i} style={{
            display: 'flex', gap: 12, padding: '6px 16px',
            borderBottom: i < log.length - 1 ? '1px solid var(--border)' : 'none',
            fontSize: 12, fontFamily: 'var(--font-mono)', alignItems: 'flex-start',
          }}>
            <span style={{ color: 'var(--text-faint)', minWidth: 55, flexShrink: 0 }}>{e.time}</span>
            <span style={{ color: evColor, fontWeight: 700, minWidth: 100, flexShrink: 0 }}>[{e.event}]</span>
            <span style={{ color: 'var(--text)', flex: 1 }}>{e.message}</span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

/* ── button styles ────────────────────────────────────────────────────────── */
function btn(variant, disabled) {
  const base = {
    border: 'none', borderRadius: 9, padding: '9px 20px',
    fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s', whiteSpace: 'nowrap',
    opacity: disabled ? 0.55 : 1, fontFamily: 'var(--font-sans)',
  };
  if (variant === 'green')   return { ...base, background: '#16a34a', color: '#fff' };
  if (variant === 'red')     return { ...base, background: '#dc2626', color: '#fff' };
  if (variant === 'outline') return { ...base, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' };
  return base;
}

/* ── ModeToggle ──────────────────────────────────────────────────────────── */
function ModeToggle({ paper, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Mode
      </span>
      <div style={{
        display: 'inline-flex', background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 3, gap: 2,
      }}>
        {[
          { id: true,  label: 'Paper', activeBg: '#6d28d9', activeFg: '#fff' },
          { id: false, label: 'Live',  activeBg: '#d97706', activeFg: '#fff' },
        ].map(({ id, label, activeBg, activeFg }) => {
          const active = paper === id;
          return (
            <button
              key={label}
              onClick={() => onChange(id)}
              disabled={disabled}
              style={{
                border: 'none', borderRadius: 7, padding: '5px 18px',
                fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                background: active ? activeBg : 'transparent',
                color: active ? activeFg : 'var(--text-dim)',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main panel
   ═══════════════════════════════════════════════════════════════════════════ */
function StrategyPanel() {
  const [strategy, setStrategy] = useState(null);
  const [paper, setPaper]       = useState(true);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const tickRef = useRef(null);

  const isActive = strategy?.status === 'LOCKED' || strategy?.status === 'RUNNING';

  /* load state */
  const loadState = useCallback(async () => {
    try {
      const d = await api('/917/state');
      setStrategy(d.strategy);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  /* tick loop */
  const stopTick = useCallback(() => {
    clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const startTick = useCallback(() => {
    if (tickRef.current) return;
    tickRef.current = setInterval(async () => {
      try {
        const d = await api('/917/tick', { method: 'POST' });
        setStrategy(d.strategy);
        if (d.strategy?.status === 'EXITED') stopTick();
      } catch (_) {}
    }, 3000);
  }, [stopTick]);

  useEffect(() => {
    if (isActive) startTick();
    return stopTick;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy?.status]);

  /* API helper */
  const call = async (path, body) => {
    setBusy(true); setError('');
    try {
      const d = await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      const st = d.strategy ?? d;
      if (st?.status) setStrategy(st);
      return st;
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleStart = async () => {
    const st = await call('/917/start', { paper });
    if (st?.status === 'LOCKED' || st?.status === 'RUNNING') startTick();
  };
  const handleExit  = async () => { stopTick(); await call('/917/exit'); };
  const handleReset = async () => { stopTick(); await call('/917/reset'); setPaper(true); };

  const st  = strategy;
  const sm  = S[st?.status] || S.IDLE;
  const vix = st?.indiaVix ?? null;
  const runningPaper = isActive ? st.paperMode : paper;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      {/* ── panel header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>NIFTY</span>
          <Badge label={sm.label} bg={sm.bg} fg={sm.fg} />
          {(st?.paperMode ?? paper) && (
            <Badge label="PAPER" bg="rgba(109,40,217,0.15)" fg="#a78bfa" />
          )}
          {isActive && !(st?.paperMode ?? paper) && (
            <Badge label="LIVE" bg="rgba(217,119,6,0.15)" fg="#f59e0b" />
          )}
          {isActive && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: runningPaper ? '#a78bfa' : '#f59e0b',
              display: 'inline-block', animation: 'nspulse 1.5s ease-in-out infinite',
            }} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--text-dim)' }}>
          <VixBadge vix={vix} />
          {st?.expiryStr  && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Expiry: {st.expiryStr}</span>}
          {st?.scanTime   && <span>🔒 Locked {st.scanTime}</span>}
          {st?.entryTime  && <span>⏱ Entry {st.entryTime}</span>}
          {st?.exitTime   && <span>⏏ Exit {st.exitTime}</span>}
          {st?.legs?.length > 0 && (
            <span style={{ fontSize: 15, fontWeight: 800, color: pnlColor(st.totalPnl), fontFamily: 'var(--font-mono)' }}>
              {pnlStr(st.totalPnl)}
            </span>
          )}
        </div>
      </div>

      <Divider />

      {/* ── mode + controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <ModeToggle paper={isActive ? runningPaper : paper} onChange={setPaper} disabled={isActive} />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 8 }}>
          {(!st || st.status === 'IDLE') && (
            <button onClick={handleStart} disabled={busy} style={btn('green', busy)}>
              ▶ Start Trade
            </button>
          )}
          {(st?.status === 'LOCKED' || st?.status === 'RUNNING') && (
            <button onClick={handleExit} disabled={busy} style={btn('red', busy)}>
              ⏹ Exit All Positions
            </button>
          )}
          {st?.status === 'EXITED' && (
            <button onClick={handleReset} disabled={busy} style={btn('outline', busy)}>
              ↺ Reset
            </button>
          )}
        </div>

        {/* Day warning */}
        {(() => {
          const day = new Date().getDay();  // 0=Sun, 1=Mon
          return day === 1 ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.25)',
              borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#ff5c5c',
            }}>
              ⚠ Monday — entries blocked
            </span>
          ) : null;
        })()}
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.3)',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ff5c5c',
        }}>{error}</div>
      )}

      {/* Status banners (LOCKED / WATCHING) */}
      {st?.status === 'LOCKED' && st?.legs?.length > 0 && (
        <div style={{
          background: 'rgba(240,180,41,0.07)', border: '1px solid rgba(240,180,41,0.25)',
          borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 14, color: '#f0b429', fontWeight: 700 }}>🔒 Prices Locked</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Watching for +11.5% breakout on CE and PE — entry fires independently per leg when triggered.
          </span>
        </div>
      )}

      {/* ── blueprint ── */}
      <Accordion title="Strategy Blueprint">
        <Blueprint />
      </Accordion>

      {/* ── P&L ── */}
      {st?.legs?.length > 0 && (
        <div>
          <SH>P&amp;L Summary</SH>
          <div style={{ marginTop: 12 }}><PnlSummary strategy={st} /></div>
        </div>
      )}

      {/* ── positions ── */}
      {st?.legs?.length > 0 && (
        <div>
          <SH>Positions</SH>
          <div style={{ marginTop: 12 }}>
            <PositionsTable legs={st.legs} paper={st.paperMode ?? paper} />
          </div>
        </div>
      )}

      {/* ── log ── */}
      {st?.log?.length > 0 && (
        <Accordion title="Activity Log">
          <ActivityLog log={st?.log} />
        </Accordion>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Root export
   ═══════════════════════════════════════════════════════════════════════════ */
export default function NineSeventeenStrategy() {
  return (
    <>
      <style>{`@keyframes nspulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.65)}}`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* page title */}
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>
            9:17 Buying Strategy
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
            NIFTY · BUY CE &amp; PE ~₹140 at 09:17 · Wait &amp; Trade +11.5% · SL 20% · TGT +100% · Exit 15:28 PM
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
            Conditions: India VIX 10–50 · No Monday trading · Legs enter independently on W&amp;T trigger
          </p>
        </div>

        <StrategyPanel />
      </div>
    </>
  );
}

// Made with Bob
