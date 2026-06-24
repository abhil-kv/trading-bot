import { useMemo, useState } from 'react';
import './StockGrid.css';

const COLUMNS = [
  { key: 'title', label: 'Stock', sortKey: 'name' },
  { key: 'ltp', label: 'LTP', sortKey: 'ltp', align: 'right' },
  { key: 'change', label: 'Gain / Loss', sortKey: 'change', align: 'right' },
  { key: 'changePercent', label: 'Chg %', sortKey: 'changePercent', align: 'right' },
  { key: 'range', label: '52W range', align: 'left' },
  { key: 'low52', label: '52W Low', sortKey: 'low52', align: 'right' },
  { key: 'high52', label: '52W High', sortKey: 'high52', align: 'right' },
];

function formatNumber(n, opts = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2, ...opts });
}

function ChangeBadge({ change, changePercent }) {
  if (change === null || change === undefined) return <span className="mono">—</span>;
  const isGain = change >= 0;
  return (
    <span className={`change-badge ${isGain ? 'is-gain' : 'is-loss'}`}>
      {isGain ? '▲' : '▼'} {formatNumber(Math.abs(change))}
      {changePercent !== null && changePercent !== undefined && (
        <span className="change-badge__pct">({isGain ? '+' : '-'}{Math.abs(changePercent).toFixed(2)}%)</span>
      )}
    </span>
  );
}

function RangeBar({ low, high, ltp }) {
  if (low === null || high === null || ltp === null || high <= low) {
    return <div className="range-bar range-bar--empty">—</div>;
  }
  const pct = Math.min(100, Math.max(0, ((ltp - low) / (high - low)) * 100));
  return (
    <div className="range-bar" title={`${formatNumber(low)} – ${formatNumber(high)}`}>
      <div className="range-bar__track">
        <div className="range-bar__marker" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function StockGrid({ stocks }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'changePercent', dir: 'desc' });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [stocks, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (key === 'name') {
        av = a.name;
        bv = b.name;
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      av = av === null || av === undefined ? -Infinity : av;
      bv = bv === null || bv === undefined ? -Infinity : bv;
      return dir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sort]);

  function handleSort(sortKey) {
    if (!sortKey) return;
    setSort((s) => (s.key === sortKey ? { key: sortKey, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: sortKey, dir: 'desc' }));
  }

  return (
    <div className="stock-grid">
      <div className="stock-grid__toolbar">
        <input
          className="stock-grid__search"
          placeholder="Filter by symbol or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="stock-grid__count">{sorted.length} of {stocks.length} stocks</span>
      </div>

      <div className="stock-grid__table-wrap">
        <table className="stock-grid__table">
          <thead>
            <tr>
              <th className="rank-col" />
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={col.align === 'right' ? 'align-right' : ''}
                  onClick={() => handleSort(col.sortKey)}
                  style={{ cursor: col.sortKey ? 'pointer' : 'default' }}
                >
                  {col.label}
                  {sort.key === col.sortKey && <span className="sort-arrow">{sort.dir === 'asc' ? ' ↑' : ' ↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.symbol} className={s.change >= 0 ? 'row-gain' : 'row-loss'}>
                <td className="rank-col mono">{i + 1}</td>
                <td>
                  <div className="stock-title">
                    <span className="stock-title__symbol">{s.symbol}</span>
                    <span className="stock-title__name">{s.name}</span>
                  </div>
                </td>
                <td className="align-right mono">{formatNumber(s.ltp)}</td>
                <td className="align-right">
                  <ChangeBadge change={s.change} changePercent={null} />
                </td>
                <td className="align-right mono">
                  {s.changePercent === null ? '—' : `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`}
                </td>
                <td>
                  <RangeBar low={s.low52} high={s.high52} ltp={s.ltp} />
                </td>
                <td className="align-right mono text-faint">{formatNumber(s.low52)}</td>
                <td className="align-right mono text-faint">{formatNumber(s.high52)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">
                  No stocks match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
