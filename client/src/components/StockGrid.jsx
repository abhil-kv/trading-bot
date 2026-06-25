import { useMemo, useState, useEffect } from 'react';
import './StockGrid.css';

// Function to generate TradingView URL for NSE stocks
function getTradingViewUrl(symbol) {
  // Remove -EQ suffix if present and format for TradingView
  const cleanSymbol = symbol.replace('-EQ', '');
  return `https://www.tradingview.com/chart/?symbol=NSE%3A${cleanSymbol}`;
}

const COLUMNS = [
  { key: 'title', label: 'Stock', sortKey: 'name' },
  { key: 'ltp', label: 'LTP', sortKey: 'ltp', align: 'right' },
  { key: 'change', label: 'Gain / Loss', sortKey: 'change', align: 'right' },
  { key: 'changePercent', label: 'Chg %', sortKey: 'changePercent', align: 'right' },
  { key: 'orb_range', label: '15M Range', sortKey: 'orb_high', align: 'center' },
  { key: 'orb_signal', label: 'Breakout', align: 'center' },
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

function ORBRangeDisplay({ orbHigh, orbLow }) {
  if (!orbHigh || !orbLow) {
    return <span className="mono text-faint">—</span>;
  }
  
  return (
    <div className="orb-range-display">
      <div className="orb-range-value">{formatNumber(orbHigh)}</div>
      <div className="orb-range-separator">/</div>
      <div className="orb-range-value">{formatNumber(orbLow)}</div>
    </div>
  );
}

function ORBSignalButton({ signal, breakoutTime, breakoutPrice }) {
  if (!signal) {
    return <span className="mono text-faint">—</span>;
  }
  
  const isBuy = signal === 'BUY';
  return (
    <div className="orb-signal-container">
      <button
        className={`orb-signal-btn ${isBuy ? 'orb-signal-btn--buy' : 'orb-signal-btn--sell'}`}
        title={`Breakout at ${breakoutPrice?.toFixed(2)}`}
        disabled
      >
        {isBuy ? '🟢 BUY' : '🔴 SELL'}
      </button>
      {breakoutTime && (
        <div className="orb-breakout-time">{breakoutTime}</div>
      )}
    </div>
  );
}

export default function StockGrid({ stocks, indexType, onIndexTypeChange }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'changePercent', dir: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  
  // Set items per page based on index type
  const itemsPerPage = indexType === '50' ? 50 : indexType === '100' ? 100 : 500;

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
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, sort, indexType, itemsPerPage]);
  
  // Paginate sorted results
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStocks = sorted.slice(startIndex, endIndex);
  
  function handleSort(sortKey) {
    if (!sortKey) return;
    setSort((s) => (s.key === sortKey ? { key: sortKey, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: sortKey, dir: 'desc' }));
  }
  
  function handleIndexChange(e) {
    onIndexTypeChange(e.target.value);
  }
  
  return (
    <div className="stock-grid">
      <div className="stock-grid__toolbar">
        <div className="stock-grid__toolbar-left">
          <input
            className="stock-grid__search"
            placeholder="Filter by symbol or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="stock-grid__dropdown"
            value={indexType}
            onChange={handleIndexChange}
          >
            <option value="50">Nifty 50</option>
            <option value="100">Nifty 100</option>
            <option value="500">Nifty 500</option>
          </select>
        </div>
        <div className="stock-grid__toolbar-right">
          <span className="stock-grid__count">{sorted.length} of {stocks.length} stocks</span>
        </div>
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
            {paginatedStocks.map((s, i) => (
              <tr key={s.symbol} className={s.change >= 0 ? 'row-gain' : 'row-loss'}>
                <td className="rank-col mono">{startIndex + i + 1}</td>
                <td>
                  <a
                    href={getTradingViewUrl(s.symbol)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="stock-title-link"
                  >
                    <div className="stock-title">
                      <span className="stock-title__symbol">{s.symbol}</span>
                      <span className="stock-title__name">{s.name}</span>
                    </div>
                  </a>
                </td>
                <td className="align-right mono">{formatNumber(s.ltp)}</td>
                <td className="align-right">
                  <ChangeBadge change={s.change} changePercent={null} />
                </td>
                <td className="align-right mono">
                  {s.changePercent === null ? '—' : `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`}
                </td>
                <td className="align-center">
                  <ORBRangeDisplay orbHigh={s.orb_high} orbLow={s.orb_low} />
                </td>
                <td className="align-center">
                  <ORBSignalButton
                    signal={s.orb_signal}
                    breakoutTime={s.orb_breakout_time}
                    breakoutPrice={s.orb_breakout_price}
                  />
                </td>
                <td>
                  <RangeBar low={s.low52} high={s.high52} ltp={s.ltp} />
                </td>
                <td className="align-right mono text-faint">{formatNumber(s.low52)}</td>
                <td className="align-right mono text-faint">{formatNumber(s.high52)}</td>
              </tr>
            ))}
            {paginatedStocks.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-state">
                  {sorted.length === 0 ? `No stocks match "${query}".` : 'No stocks on this page.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="stock-grid__pagination">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
}
