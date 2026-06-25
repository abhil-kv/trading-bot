import { useState, useEffect } from 'react';
import './StrategiesPage.css';

const STRATEGIES = {
  stocks: [
    { id: 'strong-mean-reversion', name: 'Strong Mean Reversion' },
    { id: 'swing', name: 'Swing' },
  ],
  options: []
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

export default function StrategiesPage() {
  const [activeTab, setActiveTab] = useState('stocks');
  const [selectedStrategy, setSelectedStrategy] = useState('');

  const availableStrategies = STRATEGIES[activeTab] || [];

  useEffect(() => {
    // Auto-select first strategy when tab changes
    if (availableStrategies.length > 0) {
      setSelectedStrategy(availableStrategies[0].id);
    } else {
      setSelectedStrategy('');
    }
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
          </div>
        )}
      </div>

      <div className="strategies-content">
        {activeTab === 'stocks' ? (
          <div className="strategies-section">
            {selectedStrategy === 'strong-mean-reversion' ? (
              <StrongMeanReversionStrategy />
            ) : selectedStrategy === 'swing' ? (
              <SwingStrategy />
            ) : (
              <p className="strategies-placeholder">Select a strategy to begin analysis.</p>
            )}
          </div>
        ) : (
          <div className="strategies-section">
            <h2>Options Strategies</h2>
            <p className="strategies-placeholder">Options trading strategies will be available soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Made with Bob
