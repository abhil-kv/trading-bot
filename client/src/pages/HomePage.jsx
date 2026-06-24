import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client.js';
import StockGrid from '../components/StockGrid.jsx';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import './HomePage.css';

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function HomePage() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState([]);
  const [asOf, setAsOf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  
  // WebSocket connection
  const { isConnected, lastMessage } = useWebSocket();

  // Initial fetch on mount (fallback if WebSocket is not connected)
  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/market/nifty50');
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
  }, [navigate]);

  // Initial fetch on mount
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

  const gainers = stocks.filter((s) => (s.change ?? 0) >= 0).length;
  const losers = stocks.length - gainers;

  return (
    <div className="home-page">
      <div className="home-page__header">
        <div>
          <h1>NIFTY 50</h1>
          <p className="home-page__sub">Live snapshot from Angel One SmartAPI</p>
        </div>
        <div className="home-page__meta">
          <div className="home-page__summary">
            <span className="text-gain mono">{gainers} up</span>
            <span className="text-loss mono">{losers} down</span>
          </div>
          <div className="home-page__refresh">
            <span className="mono">Updated {formatTime(asOf)}</span>
            <ConnectionStatus isConnected={isConnected} />
          </div>
        </div>
      </div>

      {error && <div className="home-page__error">{error}</div>}
      {!error && warnings.map((w) => (
        <div className="home-page__warning" key={w}>{w}</div>
      ))}

      {loading && stocks.length === 0 ? (
        <div className="home-page__loading">Fetching live quotes…</div>
      ) : (
        <StockGrid stocks={stocks} />
      )}
    </div>
  );
}
