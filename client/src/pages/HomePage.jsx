import { Link } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page">
      <div className="home-page__header">
        <div>
          <h1>Trading Bot Dashboard</h1>
          <p className="home-page__sub">Automated trading strategies powered by Angel One SmartAPI</p>
        </div>
      </div>

      <div className="home-page__content">
        <div className="strategy-cards">
          <Link to="/strategies" className="strategy-card">
            <div className="strategy-card__icon">📊</div>
            <h3>ORB 15 Min</h3>
            <p>Opening Range Breakout strategy tracking first 15-minute range (9:15-9:30 AM) with live breakout signals</p>
            <span className="strategy-card__link">View Strategy →</span>
          </Link>

          <Link to="/strategies" className="strategy-card">
            <div className="strategy-card__icon">📈</div>
            <h3>Strong Mean Reversion</h3>
            <p>5-minute timeframe strategy using RSI, Bollinger Bands, and volume analysis for mean reversion trades</p>
            <span className="strategy-card__link">View Strategy →</span>
          </Link>

          <Link to="/strategies" className="strategy-card">
            <div className="strategy-card__icon">🚀</div>
            <h3>Swing Trading</h3>
            <p>Multi-day momentum strategy targeting stocks near 52-week highs with strong volume confirmation</p>
            <span className="strategy-card__link">View Strategy →</span>
          </Link>
        </div>

        <div className="home-page__info">
          <h2>Quick Start</h2>
          <ol>
            <li>Navigate to <strong>Strategies</strong> to view available trading strategies</li>
            <li>Select a strategy to see live signals and analysis</li>
            <li>Each strategy includes entry/exit rules, risk management, and performance tracking</li>
            <li>Check <strong>News</strong> for market updates and events</li>
          </ol>
        </div>

        <div className="home-page__features">
          <div className="feature-box">
            <h3>🔴 Live Market Data</h3>
            <p>Real-time quotes from Angel One SmartAPI with WebSocket updates</p>
          </div>
          <div className="feature-box">
            <h3>📊 Technical Analysis</h3>
            <p>Advanced indicators including RSI, Bollinger Bands, EMA, and volume analysis</p>
          </div>
          <div className="feature-box">
            <h3>⚡ Automated Signals</h3>
            <p>Automatic signal generation based on predefined strategy rules</p>
          </div>
          <div className="feature-box">
            <h3>📈 Performance Tracking</h3>
            <p>Track strategy performance with detailed metrics and analytics</p>
          </div>
        </div>
      </div>
    </div>
  );
}
