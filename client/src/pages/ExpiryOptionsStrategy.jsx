/**
 * ExpiryOptionsStrategy.jsx — Expiry-day 4-leg options strategy
 *
 * L1  SELL PUT  ~₹20   SL = 100% (price doubles → 2×)
 * L2  SELL CALL ~₹20   SL = 100%
 * L3  BUY  CALL ~₹5    TGT = 200% (3×),  SL = ₹0.05
 * L4  BUY  PUT  ~₹5    TGT = 200% (3×),  SL = ₹0.05
 *
 * Entry flow:
 *   1. NSE option-chain-v3  → pick 4 real strikes (one call at entry only)
 *   2. Angel One scrip master → resolve NFO token for each strike
 *   3. Every tick thereafter → Angel One Quote API (live) or simulation (paper)
 *
 * Entry: 10:30 AM   |   Force-exit: 14:55 PM
 * Paper mode: real NSE strikes, simulated prices
 * Live  mode: real NSE strikes, real Angel One LTPs every 3 s
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

const pnlStr = (n) => {
  if (n == null) return '—';
  const abs = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n >= 0 ? '+' : '−'}₹${abs}`;
};

const pnlColor = (n) => {
  if (n > 0) return 'var(--gain)';
  if (n < 0) return 'var(--loss)';
  return 'var(--text-dim)';
};

/* ── status maps ─────────────────────────────────────────────────────────── */
const S = {
  IDLE:      { label: 'Idle',       bg: '#232a38', fg: '#8b93a7' },
  SCHEDULED: { label: 'Scheduled',  bg: '#2d2208', fg: '#f0b429' },
  RUNNING:   { label: 'Running',    bg: '#0d1f40', fg: '#4c7cff' },
  EXITED:    { label: 'Exited',     bg: '#1a1d24', fg: '#6b7280' },
};

const LS = {
  OPEN:    { label: 'Open',    bg: 'rgba(76,124,255,0.15)',  fg: '#4c7cff' },
  SL_HIT:  { label: 'SL Hit',  bg: 'rgba(255,92,92,0.15)',   fg: '#ff5c5c' },
  TGT_HIT: { label: 'TGT Hit', bg: 'rgba(46,204,143,0.15)',  fg: '#2ecc8f' },
  EXITED:  { label: 'Exited',  bg: 'rgba(107,114,128,0.15)', fg: '#6b7280' },
};

/* ── tiny badge ──────────────────────────────────────────────────────────── */
function Badge({ label, bg, fg, style = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: bg, color: fg, letterSpacing: '0.04em',
      border: `1px solid ${fg}30`,
      ...style,
    }}>
      {label}
    </span>
  );
}

/* ── info bar ────────────────────────────────────────────────────────────── */
function InfoBar({ info }) {
  if (!info) return null;
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 20px',
    }}>
      {[
        ['Date',             info.date],
        ['Day',              info.dayOfWeek],
        ['Expiry Day',       info.isExpiryDay ? 'YES ✓' : 'NO',
                             info.isExpiryDay ? 'var(--gain)' : 'var(--text-dim)'],
        info.upcomingExpiry && ['Next Expiry', info.upcomingExpiry, 'var(--accent)'],
        info.expiryInstruments?.length && ['Expiring Today', info.expiryInstruments.join(' · ')],
      ].filter(Boolean).map(([label, val, color]) => (
        <div key={label} style={{
          display: 'flex', flexDirection: 'column', gap: 3,
          padding: '6px 14px', borderRadius: 8,
          background: 'var(--surface)', border: '1px solid var(--border)',
          minWidth: 80,
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: color || 'var(--text)', fontFamily: label === 'Next Expiry' ? 'var(--font-mono)' : 'inherit' }}>{val}</span>
        </div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto', lineHeight: 1.6, textAlign: 'right' }}>
        <div>NIFTY — every Tuesday (weekly expiry)</div>
        <div>BANKNIFTY · FINNIFTY · MIDCPNIFTY — last Tuesday of month</div>
      </div>
    </div>
  );
}

/* ── mode toggle ─────────────────────────────────────────────────────────── */
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
              title={id
                ? 'Paper — real NSE strikes, simulated prices, no Angel One session needed'
                : 'Live — real NSE strikes, real Angel One LTPs (requires login)'}
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

/* ── blueprint table ─────────────────────────────────────────────────────── */
function Blueprint() {
  const rows = [
    { id: 'L1', action: 'SELL', type: 'PUT',  target: '~₹20', sl: '100%',  tgt: null },
    { id: 'L2', action: 'SELL', type: 'CALL', target: '~₹20', sl: '100%',  tgt: null },
    { id: 'L3', action: 'BUY',  type: 'CALL', target: '~₹5',  sl: '100%',  tgt: '200%' },
    { id: 'L4', action: 'BUY',  type: 'PUT',  target: '~₹5',  sl: '100%',  tgt: '200%' },
  ];

  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', gap: 32, padding: '12px 20px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg)',
        fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap',
      }}>
        {[
          ['Entry Time', '10:30 AM'],
          ['Force Exit', '14:55 PM'],
          ['Lots / Leg', '10'],
          ['Price Source', 'NSE chain (entry once) → Angel One NFO Quote API (every tick)'],
        ].map(([k, v]) => (
          <span key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-dim)' }}>{k}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{v}</span>
          </span>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            {['Leg', 'Action', 'Type', 'Target Price', 'Stop Loss', 'Target'].map(h => (
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
          {rows.map((row, i) => {
            const isSell = row.action === 'SELL';
            return (
              <tr key={row.id} style={{
                background: isSell ? 'rgba(255,92,92,0.04)' : 'rgba(46,204,143,0.04)',
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <td style={{ padding: '11px 16px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{row.id}</td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 5,
                    fontSize: 11, fontWeight: 700,
                    background: isSell ? 'rgba(255,92,92,0.15)' : 'rgba(46,204,143,0.15)',
                    color: isSell ? '#ff5c5c' : '#2ecc8f',
                    border: `1px solid ${isSell ? 'rgba(255,92,92,0.3)' : 'rgba(46,204,143,0.3)'}`,
                  }}>{row.action}</span>
                </td>
                <td style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--text)' }}>{row.type}</td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{row.target}</td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    fontSize: 11, fontWeight: 700, color: '#ff5c5c',
                    background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.3)',
                  }}>SL {row.sl}</span>
                </td>
                <td style={{ padding: '11px 16px' }}>
                  {row.tgt
                    ? <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        fontSize: 11, fontWeight: 700, color: '#2ecc8f',
                        background: 'rgba(46,204,143,0.1)', border: '1px solid rgba(46,204,143,0.3)',
                      }}>TGT {row.tgt}</span>
                    : <span style={{ color: 'var(--text-faint)' }}>—</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── P&L summary ─────────────────────────────────────────────────────────── */
function PnlSummary({ strategy }) {
  const { totalRealized = 0, totalUnrealized = 0, totalPnl = 0, openLegs = 0, legs = [] } = strategy;
  const closed = legs.filter(l => l.status !== 'OPEN').length;

  const cards = [
    { label: 'Realized P&L',   val: totalRealized,   fmt: pnlStr, highlight: false },
    { label: 'Unrealized P&L', val: totalUnrealized, fmt: pnlStr, highlight: false },
    { label: 'Total P&L',      val: totalPnl,        fmt: pnlStr, highlight: true },
    { label: 'Open Legs',      val: `${openLegs} / ${legs.length}`, fmt: v => v, highlight: false },
    { label: 'Closed Legs',    val: `${closed}`, fmt: v => v, highlight: false },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
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
          <span style={{
            fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)',
            color: typeof val === 'number' ? pnlColor(val) : 'var(--text)',
          }}>
            {fmt(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── positions table ─────────────────────────────────────────────────────── */
function PositionsTable({ legs, paper }) {
  if (!legs?.length) return null;

  const headers = [
    'Leg', 'Action', 'Type', 'NSE Symbol', 'Angel Token', 'Strike',
    'Entry', 'LTP', 'Stop Loss', 'Target', 'Qty', 'P&L', 'Status',
  ];

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
      {/* price source banner */}
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
          animation: 'eopulse 1.5s ease-in-out infinite',
        }} />
        {paper
          ? 'PAPER MODE — real Angel One LTPs (NFO) used for price tracking · no real orders placed'
          : 'LIVE MODE — real Angel One LTPs (NFO) · prices update every 3 s'}
        <span style={{ marginLeft: 'auto', fontWeight: 400, color: 'var(--text-dim)', fontSize: 10 }}>
          Prices: Angel One Quote API · Exchange: NFO · Fallback: last known LTP (if fetch fails)
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            {headers.map(h => (
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
            const isSell = leg.action === 'SELL';
            const lm     = LS[leg.status] || LS.OPEN;
            const pnl    = leg.status === 'OPEN' ? leg.unrealizedPnl : leg.realizedPnl;
            const rowBg  = isSell ? 'rgba(255,92,92,0.03)' : 'rgba(46,204,143,0.03)';
            const hasToken = !!leg.angelToken;

            return (
              <tr key={leg.legId} style={{
                background: rowBg,
                borderBottom: i < legs.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {/* Leg ID */}
                <td style={{ padding: '11px 12px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                  {leg.legId}
                </td>
                {/* Action */}
                <td style={{ padding: '11px 12px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 9px', borderRadius: 5,
                    fontSize: 11, fontWeight: 700,
                    background: isSell ? 'rgba(255,92,92,0.15)' : 'rgba(46,204,143,0.15)',
                    color: isSell ? '#ff5c5c' : '#2ecc8f',
                    border: `1px solid ${isSell ? 'rgba(255,92,92,0.3)' : 'rgba(46,204,143,0.3)'}`,
                  }}>{leg.action}</span>
                </td>
                {/* Option type */}
                <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--text)' }}>
                  {leg.optionType}
                </td>
                {/* NSE trading symbol */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {leg.tradingSymbol}
                </td>
                {/* Angel One token */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {hasToken ? (
                    <span style={{ color: '#2ecc8f' }} title={`Angel One NFO token: ${leg.angelToken}\nSymbol: ${leg.angelSymbol}`}>
                      {leg.angelToken}
                    </span>
                  ) : (
                    <span style={{ color: '#ff5c5c' }} title="Token not found in scrip master">⚠ —</span>
                  )}
                </td>
                {/* Strike */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>
                  {leg.strike?.toLocaleString('en-IN')}
                </td>
                {/* Entry price */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                  {inr(leg.entryPrice)}
                </td>
                {/* LTP (current price) */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>
                  {inr(leg.currentPrice)}
                </td>
                {/* Stop Loss */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ff5c5c' }}>
                  {inr(leg.slPrice)}
                </td>
                {/* Target */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#2ecc8f' }}>
                  {leg.tgtPrice != null ? inr(leg.tgtPrice) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                </td>
                {/* Qty */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {leg.lots}L × {leg.lotSize} = {leg.quantity}
                </td>
                {/* P&L */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: pnlColor(pnl), whiteSpace: 'nowrap' }}>
                  {pnlStr(pnl)}
                </td>
                {/* Status */}
                <td style={{ padding: '11px 12px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                    fontSize: 11, fontWeight: 700,
                    background: lm.bg, color: lm.fg,
                    border: `1px solid ${lm.fg}40`,
                    whiteSpace: 'nowrap',
                  }}>{lm.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── activity log ────────────────────────────────────────────────────────── */
const EV_COLORS = {
  scheduled:   '#f0b429',
  entry:       '#4c7cff',
  open:        '#4c7cff',
  sl_hit:      '#ff5c5c',
  tgt_hit:     '#2ecc8f',
  exited:      '#6b7280',
  force_exit:  '#f59e0b',
  manual_exit: '#a78bfa',
  warn:        '#f59e0b',
  error:       '#ff5c5c',
};

function ActivityLog({ log }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log?.length]);

  if (!log?.length) return null;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{
        padding: '9px 16px', background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: 'var(--text-dim)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gain)', display: 'inline-block' }} />
        Activity Log
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto', background: 'var(--bg)' }}>
        {log.map((e, i) => {
          const evKey  = e.event?.toLowerCase();
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
    </div>
  );
}

/* ── section heading ─────────────────────────────────────────────────────── */
function SectionHeading({ children }) {
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

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   InstrumentPanel
   ═══════════════════════════════════════════════════════════════════════════ */
function InstrumentPanel({ instrument }) {
  const [strategy, setStrategy] = useState(null);
  const [paper, setPaper]       = useState(true);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const tickRef = useRef(null);

  const runningPaper =
    strategy?.status === 'RUNNING' || strategy?.status === 'SCHEDULED'
      ? strategy.paperMode
      : paper;

  /* load state */
  const loadState = useCallback(async () => {
    try {
      const d = await api(`/expiry/state/${instrument}`);
      setStrategy(d.strategy);
    } catch (e) { setError(e.message); }
  }, [instrument]);

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
        const d = await api(`/expiry/tick/${instrument}`, { method: 'POST' });
        setStrategy(d.strategy);
        if (d.strategy?.status === 'EXITED') stopTick();
      } catch (_) {}
    }, 3000);
  }, [instrument, stopTick]);

  useEffect(() => {
    if (strategy?.status === 'RUNNING' || strategy?.status === 'SCHEDULED') startTick();
    return stopTick;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy?.status]);

  /* API calls */
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

  const handleSchedule  = async () => { const st = await call(`/expiry/schedule/${instrument}`,  { paper }); if (st?.status === 'SCHEDULED') startTick(); };
  const handleStartNow  = async () => { const st = await call(`/expiry/start-now/${instrument}`, { paper }); if (st?.status === 'RUNNING')   startTick(); };
  const handleExit      = async () => { stopTick(); await call(`/expiry/exit/${instrument}`); };
  const handleReset     = async () => { stopTick(); await call(`/expiry/reset/${instrument}`); setPaper(true); };

  const st       = strategy;
  const sm       = S[st?.status] || S.IDLE;
  const isActive = st?.status === 'RUNNING' || st?.status === 'SCHEDULED';

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', gap: 20,
    }}>

      {/* ── panel header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
            {instrument}
          </span>
          <Badge label={sm.label} bg={sm.bg} fg={sm.fg} />
          {(st?.paperMode ?? paper) && (
            <Badge label="PAPER" bg="rgba(109,40,217,0.15)" fg="#a78bfa" />
          )}
          {isActive && !(st?.paperMode ?? paper) && (
            <Badge label="LIVE" bg="rgba(217,119,6,0.15)" fg="#f59e0b" />
          )}
          {isActive && (
            <span title="Prices updating every 3 s" style={{
              width: 8, height: 8, borderRadius: '50%',
              background: (st?.paperMode ?? paper) ? '#a78bfa' : '#f59e0b',
              display: 'inline-block', animation: 'eopulse 1.5s ease-in-out infinite',
            }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--text-dim)' }}>
          {st?.expiryStr  && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Expiry: {st.expiryStr}</span>}
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

      {/* ── controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <ModeToggle paper={isActive ? runningPaper : paper} onChange={setPaper} disabled={isActive} />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 8 }}>
          {(!st || st.status === 'IDLE') && (
            <>
              <button onClick={handleSchedule} disabled={busy} style={btnStyle('outline', busy)}>
                ⏰ Auto-Entry at 10:30 AM
              </button>
              <button onClick={handleStartNow} disabled={busy} style={btnStyle('green', busy)}>
                ▶ Start Now
              </button>
            </>
          )}
          {st?.status === 'SCHEDULED' && (
            <>
              <div style={waitingBadge}>⏳ Waiting for 10:30 AM…</div>
              <button onClick={handleStartNow} disabled={busy} style={btnStyle('green', busy)}>
                ▶ Start Now Instead
              </button>
            </>
          )}
          {st?.status === 'RUNNING' && (
            <button onClick={handleExit} disabled={busy} style={btnStyle('red', busy)}>
              ⏹ Exit All Positions
            </button>
          )}
          {st?.status === 'EXITED' && (
            <button onClick={handleReset} disabled={busy} style={btnStyle('outline', busy)}>
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.3)',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ff5c5c',
        }}>{error}</div>
      )}

      {/* ── blueprint ── */}
      <div>
        <SectionHeading>Strategy Blueprint</SectionHeading>
        <div style={{ marginTop: 12 }}><Blueprint /></div>
      </div>

      {/* ── P&L cards ── */}
      {st?.legs?.length > 0 && (
        <div>
          <SectionHeading>P&amp;L Summary</SectionHeading>
          <div style={{ marginTop: 12 }}><PnlSummary strategy={st} /></div>
        </div>
      )}

      {/* ── positions ── */}
      {st?.legs?.length > 0 && (
        <div>
          <SectionHeading>Positions</SectionHeading>
          <div style={{ marginTop: 12 }}>
            <PositionsTable legs={st.legs} paper={st.paperMode ?? paper} />
          </div>
        </div>
      )}

      {/* ── log ── */}
      <ActivityLog log={st?.log} />
    </div>
  );
}

/* ── button styles ───────────────────────────────────────────────────────── */
function btnStyle(variant, disabled) {
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

const waitingBadge = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.3)',
  borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#f0b429',
};

/* ═══════════════════════════════════════════════════════════════════════════
   Root export
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ExpiryOptionsStrategy() {
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInst, setSelectedInst] = useState('NIFTY');

  useEffect(() => {
    api('/expiry/info')
      .then(d => { setInfo(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const instruments = info?.expiryInstruments?.length ? info.expiryInstruments : ['NIFTY'];

  if (loading) return <div className="strategy-loading">Loading expiry info…</div>;

  return (
    <>
      {/* pulse keyframe injected once */}
      <style>{`@keyframes eopulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.65)}}`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* page title */}
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>
            Expiry Day Options Strategy
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
            4-leg strangle · SELL ~₹20 strikes · BUY ~₹5 strikes · Auto-entry 10:30 AM · Force-exit 14:55 PM
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
            Strikes selected from NSE option chain (once at entry) · LTPs polled from Angel One NFO Quote API every 3 s · Simulation fallback when not logged in
          </p>
        </div>

        {/* info bar */}
        <InfoBar info={info} />

        {/* instrument tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {instruments.map(inst => {
            const active = selectedInst === inst;
            return (
              <button
                key={inst}
                onClick={() => setSelectedInst(inst)}
                style={{
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 9, padding: '7px 20px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                  background: active ? 'var(--accent)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text-dim)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {inst}
              </button>
            );
          })}
        </div>

        <InstrumentPanel key={selectedInst} instrument={selectedInst} />
      </div>
    </>
  );
}

// Made with Bob
