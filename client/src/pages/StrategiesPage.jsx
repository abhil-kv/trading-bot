import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StockGrid from '../components/StockGrid.jsx';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import apiClient from '../api/client.js';
import ExpiryOptionsStrategy from './ExpiryOptionsStrategy.jsx';
import NineSeventeenStrategy from './NineSeventeenStrategy.jsx';
import './StrategiesPage.css';

const STRATEGIES = {
  stocks: [
    { id: 'orb-15min', name: 'ORB 15 Min' },
    { id: 'strong-mean-reversion', name: 'Strong Mean Reversion' },
    { id: 'swing', name: 'Swing' },
  ],
  options: [
    { id: 'expiry-day',    name: 'Expiry Day Strategy' },
    { id: '9-17-buying',   name: '9:17 Buying Strategy' },
  ],
};

function StrongMeanReversionStrategy() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState('nifty500');

  useEffect(() => {
    fetchSignals();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, [selectedIndex]);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:4000/api/strategies/strong-mean-reversion?index=${selectedIndex}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch signals');
      }
      
      const data = await response.json();
      setSignals(data.signals || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching signals:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getIndexLabel = () => {
    switch(selectedIndex) {
      case 'nifty50': return 'Nifty 50';
      case 'nifty100': return 'Nifty 100';
      case 'nifty500': return 'Nifty 500';
      default: return 'Nifty 50';
    }
  };

  if (loading && signals.length === 0) {
    return <div className="strategy-loading">Analyzing {getIndexLabel()} stocks...</div>;
  }

  if (error) {
    return <div className="strategy-error">Error: {error}</div>;
  }

  return (
    <div className="strategy-table-container">
      <div className="strategy-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3>Strong Mean Reversion Strategy</h3>
          <div className="index-selector">
            <label htmlFor="index-select" style={{ marginRight: '8px' }}>Index:</label>
            <select
              id="index-select"
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(e.target.value)}
              className="strategy-dropdown"
            >
              <option value="nifty50">Nifty 50</option>
              <option value="nifty100">Nifty 100</option>
              <option value="nifty500">Nifty 500</option>
            </select>
          </div>
        </div>
        <p className="strategy-description">5-minute timeframe • RSI + Bollinger Bands + Volume</p>
      </div>
      
      <div className="strategy-table-wrapper">
        <table className="strategy-table">
          <thead>
            <tr>
              <th>Stock</th>
              <th>Signal</th>
              <th>Time</th>
              <th>Current Price</th>
              <th>RSI</th>
              <th>Bollinger Bands</th>
              <th>Entry Price</th>
              <th>Target</th>
              <th>Stop Loss</th>
              <th>Risk:Reward</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {signals.length === 0 ? (
              <tr>
                <td colSpan="11" className="no-signals">
                  No signals detected. Monitoring {getIndexLabel()} stocks...
                </td>
              </tr>
            ) : (
              signals.map((signal, index) => {
                const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=NSE:${signal.symbol}`;
                const bbLower = signal.bb_lower?.toFixed(2) || '-';
                const bbMiddle = signal.bb_middle?.toFixed(2) || '-';
                const bbUpper = signal.bb_upper?.toFixed(2) || '-';
                
                return (
                  <tr key={index} className={`signal-row ${signal.type}`}>
                    <td className="stock-cell">
                      <a
                        href={tradingViewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="stock-link"
                      >
                        <div className="stock-name">{signal.symbol}</div>
                        <div className="stock-subtitle">{signal.name}</div>
                      </a>
                    </td>
                    <td>
                      <button
                        className={`signal-btn ${signal.type}`}
                        disabled
                      >
                        {signal.type === 'BUY' ? '🟢 BUY' : '🔴 SELL'}
                      </button>
                    </td>
                    <td className="time-cell">{signal.signalTime}</td>
                    <td className="price-cell">₹{signal.ltp?.toFixed(2)}</td>
                    <td className="rsi-cell">{signal.rsi?.toFixed(1) || '-'}</td>
                    <td className="bb-cell">{bbLower} | {bbMiddle} | {bbUpper}</td>
                    <td className="price-cell">₹{signal.entryPrice?.toFixed(2)}</td>
                    <td className="target-cell">₹{signal.target?.toFixed(2)}</td>
                    <td className="sl-cell">₹{signal.stopLoss?.toFixed(2)}</td>
                    <td className="rr-cell">1:{signal.riskReward?.toFixed(1)}</td>
                    <td className="status-cell">
                      {signal.status === 'TARGET_HIT' && <span className="status-icon success">✓</span>}
                      {signal.status === 'SL_HIT' && <span className="status-icon failure">✗</span>}
                      {signal.status === 'ACTIVE' && <span className="status-icon active">●</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SwingStrategy() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Sorting state
  const [sortField, setSortField] = useState('volume');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    fetchStocks();
    // Poll for updates every 60 seconds
    const interval = setInterval(fetchStocks, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStocks = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const url = forceRefresh 
        ? 'http://localhost:4000/api/strategies/swing?force_refresh=true'
        : 'http://localhost:4000/api/strategies/swing';
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch swing stocks');
      }
      
      const data = await response.json();
      setStocks(data.stocks || []);
      setCacheInfo({
        cacheTime: data.cacheTime,
        usingCache: data.usingCache
      });
      setError(null);
      setCurrentPage(1); // Reset to first page on new data
    } catch (err) {
      console.error('Error fetching swing stocks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page on sort
  };

  const handleRefresh = () => {
    fetchStocks(true);
  };

  // Sort stocks
  const sortedStocks = [...stocks].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    // Handle numeric fields
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // Handle string fields
    aVal = String(aVal || '').toLowerCase();
    bVal = String(bVal || '').toLowerCase();
    
    if (sortDirection === 'asc') {
      return aVal.localeCompare(bVal);
    } else {
      return bVal.localeCompare(aVal);
    }
  });

  // Paginate stocks
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStocks = sortedStocks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedStocks.length / itemsPerPage);

  const getSortIcon = (field) => {
    if (sortField !== field) return '⇅';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (loading && stocks.length === 0) {
    return <div className="strategy-loading">Fetching stocks from ChartInk...</div>;
  }

  if (error) {
    return <div className="strategy-error">Error: {error}</div>;
  }

  return (
    <div className="strategy-table-container">
      <div className="strategy-header">
        <h3>Swing Strategy</h3>
        <p className="strategy-description">
          Stocks near 52-week high • Daily close {'>'} ₹200
          {cacheInfo?.usingCache && cacheInfo?.cacheTime && (
            <span className="cache-info"> • Using cached data from {new Date(cacheInfo.cacheTime).toLocaleString()}</span>
          )}
        </p>
        <button onClick={handleRefresh} className="refresh-btn" disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh from ChartInk'}
        </button>
      </div>
      
      <div className="strategy-table-wrapper">
        <table className="strategy-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('symbol')} className="sortable">
                Stock {getSortIcon('symbol')}
              </th>
              <th onClick={() => handleSort('ltp')} className="sortable">
                Current Price {getSortIcon('ltp')}
              </th>
              <th onClick={() => handleSort('high_52w')} className="sortable">
                52W High {getSortIcon('high_52w')}
              </th>
              <th onClick={() => handleSort('low_52w')} className="sortable">
                52W Low {getSortIcon('low_52w')}
              </th>
              <th onClick={() => handleSort('volume')} className="sortable">
                Volume {getSortIcon('volume')}
              </th>
              <th onClick={() => handleSort('change')} className="sortable">
                Change {getSortIcon('change')}
              </th>
              <th onClick={() => handleSort('changePercent')} className="sortable">
                Change % {getSortIcon('changePercent')}
              </th>
            </tr>
          </thead>
          <tbody>
            {currentStocks.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-signals">
                  No stocks found matching criteria.
                </td>
              </tr>
            ) : (
              currentStocks.map((stock, index) => {
                const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`;
                const changeClass = stock.change >= 0 ? 'positive' : 'negative';
                
                return (
                  <tr key={index} className="signal-row">
                    <td className="stock-cell">
                      <a
                        href={tradingViewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="stock-link"
                      >
                        <div className="stock-name">{stock.symbol}</div>
                        <div className="stock-subtitle">{stock.name}</div>
                      </a>
                    </td>
                    <td className="price-cell">₹{stock.ltp?.toFixed(2)}</td>
                    <td className="price-cell">₹{stock.high_52w?.toFixed(2)}</td>
                    <td className="price-cell">₹{stock.low_52w?.toFixed(2)}</td>
                    <td className="volume-cell">{stock.volume?.toLocaleString()}</td>
                    <td className={`change-cell ${changeClass}`}>
                      {stock.change >= 0 ? '+' : ''}₹{stock.change?.toFixed(2)}
                    </td>
                    <td className={`change-cell ${changeClass}`}>
                      {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            ← Previous
          </button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages} ({sortedStocks.length} stocks)
          </span>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function ORB15MinStrategy() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState([]);
  const [asOf, setAsOf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [indexType, setIndexType] = useState('50'); // '50', '100', or '500'
  
  // WebSocket connection
  const { isConnected, lastMessage } = useWebSocket();

  // Initial fetch on mount (fallback if WebSocket is not connected)
  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = indexType === '50' ? '/market/nifty50' :
                       indexType === '100' ? '/market/nifty100' :
                       '/market/nifty500';
      const { data } = await apiClient.get(endpoint);
      setStocks(data.stocks || []);
      setAsOf(data.asOf);
      const w = [];
      if (data.unresolvedSymbols?.length) w.push(`Could not resolve tokens for: ${data.unresolvedSymbols.join(', ')}`);
      if (data.unfetched?.length) w.push(`${data.unfetched.length} symbol(s) returned no data from Angel One.`);
      setWarnings(w);
      setError('');
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError(err.response?.data?.message || 'Could not load market data.');
    } finally {
      setLoading(false);
    }
  }, [navigate, indexType]);

  // Initial fetch on mount and when index type changes
  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'market_update') {
      const data = lastMessage.data;
      setStocks(data.stocks || []);
      setAsOf(data.asOf);
      const w = [];
      if (data.unresolvedSymbols?.length) w.push(`Could not resolve tokens for: ${data.unresolvedSymbols.join(', ')}`);
      if (data.unfetched?.length) w.push(`${data.unfetched.length} symbol(s) returned no data from Angel One.`);
      setWarnings(w);
      setError('');
      setLoading(false);
    } else if (lastMessage.type === 'error') {
      setError(lastMessage.message || 'WebSocket error occurred');
    }
  }, [lastMessage]);

  const indexName = indexType === '50' ? 'NIFTY 50' :
                    indexType === '100' ? 'NIFTY 100' :
                    'NIFTY 500';

  return (
    <div className="strategy-table-container">
      <div className="strategy-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3>Opening Range Breakout (ORB) - 15 Minute</h3>
          <ConnectionStatus isConnected={isConnected} />
        </div>
        <p className="strategy-description">
          First 15-minute range (9:15-9:30 AM) • Breakout signals • Live market data from {indexName}
        </p>
      </div>

      {error && <div className="strategy-error">{error}</div>}
      {!error && warnings.map((w) => (
        <div className="strategy-warning" key={w}>{w}</div>
      ))}

      {loading && stocks.length === 0 ? (
        <div className="strategy-loading">Fetching live quotes for ORB analysis...</div>
      ) : (
        <StockGrid stocks={stocks} indexType={indexType} onIndexTypeChange={setIndexType} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Option Chain Modal
// ─────────────────────────────────────────────────────────────────────────────

const OC_INDICES = ['NIFTY', 'BANKNIFTY'];

function fmt(v, decimals = 2) {
  if (v == null || v === 0) return '—';
  return Number(v).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtOI(v) {
  if (!v) return '—';
  if (v >= 1e7) return (v / 1e7).toFixed(2) + ' Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(2) + ' L';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + ' K';
  return String(v);
}

function OptionChainModal({ onClose }) {
  const [symbol, setSymbol] = useState('NIFTY');
  const [expiryDates, setExpiryDates] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [chain, setChain] = useState(null);
  const [underlying, setUnderlying] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const atm = useRef(null);

  const fetchChain = useCallback(async (sym, exp) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ symbol: sym });
      if (exp) params.set('expiry', exp);
      const res = await fetch(`http://localhost:4000/api/options/chain?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to fetch option chain');
      setChain(data.rows || []);
      setUnderlying(data.underlyingValue);
      setExpiryDates(data.expiryDates || []);
      if (!exp && data.expiry) setSelectedExpiry(data.expiry);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and when symbol/expiry changes
  useEffect(() => {
    fetchChain(symbol, selectedExpiry || '');
  }, [symbol, selectedExpiry]);

  // Scroll ATM row into view after render
  useEffect(() => {
    if (atm.current) {
      atm.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [chain]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const atmStrike = underlying
    ? Math.round(underlying / 50) * 50
    : null;

  return (
    <div className="oc-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="oc-modal">
        {/* Header */}
        <div className="oc-modal-header">
          <div className="oc-modal-title-row">
            <span className="oc-modal-title">Option Chain</span>
            {underlying != null && (
              <span className="oc-underlying">
                {symbol} Spot: <strong>₹{fmt(underlying)}</strong>
              </span>
            )}
          </div>
          <div className="oc-controls">
            {/* Index selector */}
            <div className="oc-ctrl-group">
              <label className="oc-ctrl-label">Index</label>
              <div className="oc-index-btns">
                {OC_INDICES.map(idx => (
                  <button
                    key={idx}
                    className={`oc-index-btn ${symbol === idx ? 'active' : ''}`}
                    onClick={() => { setSymbol(idx); setSelectedExpiry(''); setChain(null); }}
                  >
                    {idx}
                  </button>
                ))}
              </div>
            </div>
            {/* Expiry selector */}
            {expiryDates.length > 0 && (
              <div className="oc-ctrl-group">
                <label className="oc-ctrl-label">Expiry</label>
                <select
                  className="oc-expiry-select"
                  value={selectedExpiry}
                  onChange={(e) => setSelectedExpiry(e.target.value)}
                >
                  {expiryDates.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Refresh */}
            <button
              className="oc-refresh-btn"
              onClick={() => fetchChain(symbol, selectedExpiry)}
              disabled={loading}
              title="Refresh"
            >
              ↻ Refresh
            </button>
          </div>
          <button className="oc-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Body */}
        <div className="oc-modal-body">
          {error && <div className="oc-error">{error}</div>}
          {loading && <div className="oc-loading">Loading option chain from NSE…</div>}

          {!loading && !error && chain && (
            <div className="oc-table-wrap">
              {/* Legend */}
              <div className="oc-legend">
                <span className="oc-legend-itm">■ In the Money (ITM)</span>
                <span className="oc-legend-otm">■ Out of the Money (OTM)</span>
                <span className="oc-legend-atm">■ At the Money (ATM)</span>
              </div>
              <table className="oc-table">
                <thead>
                  <tr>
                    {/* CALL side */}
                    <th className="oc-th-call oc-col-iv">IV</th>
                    <th className="oc-th-call oc-col-oi">OI</th>
                    <th className="oc-th-call oc-col-ltp">LTP</th>
                    {/* Strike */}
                    <th className="oc-th-strike">STRIKE</th>
                    {/* PUT side */}
                    <th className="oc-th-put oc-col-ltp">LTP</th>
                    <th className="oc-th-put oc-col-oi">OI</th>
                    <th className="oc-th-put oc-col-iv">IV</th>
                  </tr>
                </thead>
                <tbody>
                  {chain.map((row) => {
                    const isAtm = atmStrike != null && row.strike === atmStrike;
                    const rowRef = isAtm ? atm : null;
                    const ceItm = row.CE?.itm;
                    const peItm = row.PE?.itm;

                    let ceClass = 'oc-otm';
                    if (isAtm) ceClass = 'oc-atm';
                    else if (ceItm) ceClass = 'oc-itm';

                    let peClass = 'oc-otm';
                    if (isAtm) peClass = 'oc-atm';
                    else if (peItm) peClass = 'oc-itm';

                    return (
                      <tr key={row.strike} ref={rowRef} className={isAtm ? 'oc-tr-atm' : ''}>
                        {/* CALL */}
                        <td className={`oc-td-call ${ceClass}`}>{fmt(row.CE?.iv, 1)}</td>
                        <td className={`oc-td-call ${ceClass}`}>{fmtOI(row.CE?.oi)}</td>
                        <td className={`oc-td-call ${ceClass} oc-ltp`}>{fmt(row.CE?.ltp)}</td>
                        {/* STRIKE */}
                        <td className={`oc-td-strike ${isAtm ? 'oc-atm-strike' : ''}`}>
                          {row.strike.toLocaleString('en-IN')}
                          {isAtm && <span className="oc-atm-tag">ATM</span>}
                        </td>
                        {/* PUT */}
                        <td className={`oc-td-put ${peClass} oc-ltp`}>{fmt(row.PE?.ltp)}</td>
                        <td className={`oc-td-put ${peClass}`}>{fmtOI(row.PE?.oi)}</td>
                        <td className={`oc-td-put ${peClass}`}>{fmt(row.PE?.iv, 1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main StrategiesPage
// ─────────────────────────────────────────────────────────────────────────────

export default function StrategiesPage() {
  const [activeTab, setActiveTab] = useState('stocks');
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [showOptionChain, setShowOptionChain] = useState(false);

  const availableStrategies = STRATEGIES[activeTab] || [];

  useEffect(() => {
    // Auto-select first strategy when tab changes
    if (availableStrategies.length > 0) {
      setSelectedStrategy(availableStrategies[0].id);
    } else {
      setSelectedStrategy('');
    }
    setShowOptionChain(false);
  }, [activeTab]);

  return (
    <div className="strategies-page">
      <div className="strategies-header-row">
        <div className="strategies-toggle">
          <button
            className={`strategies-toggle__btn ${activeTab === 'stocks' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('stocks')}
          >
            Stocks
          </button>
          <button
            className={`strategies-toggle__btn ${activeTab === 'options' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('options')}
          >
            Options
          </button>
        </div>

        {availableStrategies.length > 0 && (
          <div className="strategy-selector">
            <label htmlFor="strategy-select">Strategy:</label>
            <select
              id="strategy-select"
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="strategy-dropdown"
            >
              {availableStrategies.map(strategy => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>

            {/* Option Chain button — visible only on the Options tab */}
            {activeTab === 'options' && (
              <button
                className="oc-open-btn"
                onClick={() => setShowOptionChain(true)}
                title="View live NSE option chain"
              >
                📊 Option Chain
              </button>
            )}
          </div>
        )}
      </div>

      <div className="strategies-content">
        {activeTab === 'stocks' ? (
          <div className="strategies-section">
            {selectedStrategy === 'orb-15min' ? (
              <ORB15MinStrategy />
            ) : selectedStrategy === 'strong-mean-reversion' ? (
              <StrongMeanReversionStrategy />
            ) : selectedStrategy === 'swing' ? (
              <SwingStrategy />
            ) : (
              <p className="strategies-placeholder">Select a strategy to begin analysis.</p>
            )}
          </div>
        ) : (
          <div className="strategies-section">
            {selectedStrategy === 'expiry-day' ? (
              <ExpiryOptionsStrategy />
            ) : selectedStrategy === '9-17-buying' ? (
              <NineSeventeenStrategy />
            ) : (
              <p className="strategies-placeholder">Select an options strategy to begin.</p>
            )}
          </div>
        )}
      </div>

      {showOptionChain && (
        <OptionChainModal onClose={() => setShowOptionChain(false)} />
      )}
    </div>
  );
}

// Made with Bob
