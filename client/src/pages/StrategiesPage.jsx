import { useState } from 'react';
import './StrategiesPage.css';

export default function StrategiesPage() {
  const [activeTab, setActiveTab] = useState('stocks');

  return (
    <div className="strategies-page">
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

      <div className="strategies-content">
        {activeTab === 'stocks' ? (
          <div className="strategies-section">
            <h2>Stock Strategies</h2>
            <p className="strategies-placeholder">Stock trading strategies will be displayed here.</p>
          </div>
        ) : (
          <div className="strategies-section">
            <h2>Options Strategies</h2>
            <p className="strategies-placeholder">Options trading strategies will be displayed here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Made with Bob
