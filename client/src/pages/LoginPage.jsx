import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import './LoginPage.css';

const FIELDS = [
  {
    name: 'clientId',
    label: 'Client ID',
    placeholder: 'e.g. A123456',
    type: 'text',
    hint: 'Your Angel One login / client code.',
  },
  {
    name: 'pin',
    label: 'PIN',
    placeholder: '••••',
    type: 'password',
    hint: 'The trading PIN / password you use to log into Angel One.',
  },
  {
    name: 'totpSecret',
    label: 'TOTP secret',
    placeholder: '32-character key',
    type: 'password',
    hint: 'One-time setup at smartapi.angelbroking.com/enable-totp — copy the secret shown under the QR code (not the 6-digit code itself). The bot generates a fresh code from this on every login.',
  },
  {
    name: 'apiKey',
    label: 'API key',
    placeholder: 'From your SmartAPI app',
    type: 'text',
    hint: 'From smartapi.angelone.in → My Apps.',
  },
  {
    name: 'apiSecret',
    label: 'API secret',
    optional: true,
    placeholder: 'From your SmartAPI app',
    type: 'password',
    hint: 'Not required for live market data — stored for upcoming order-placement features.',
  },
];

function TickerDecoration() {
  // Purely decorative: a static set of bars suggesting a watchlist, with a
  // deterministic up/down pattern so it doesn't look random/jittery.
  const bars = useMemo(
    () => [38, 62, 50, 78, 44, 95, 58, 70, 30, 84, 52, 66, 40, 90, 60, 48, 76, 34, 88, 56],
    []
  );
  return (
    <div className="ticker" aria-hidden="true">
      {bars.map((h, i) => (
        <div key={i} className={`ticker__bar ${i % 3 === 0 ? 'down' : 'up'}`} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ clientId: '', pin: '', totpSecret: '', apiKey: '', apiSecret: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDefaults() {
      try {
        const { data } = await apiClient.get('/auth/defaults');
        if (!active || !data?.defaults) return;
        setForm((current) => ({ ...current, ...data.defaults }));
      } catch {
        // Ignore defaults loading failures and keep manual entry available.
      }
    }

    loadDefaults();

    return () => {
      active = false;
    };
  }, []);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.apiSecret) delete payload.apiSecret;
      await login(payload);
      navigate('/app/home', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <div>
          <span className="login-brand__mark">Trading Bot · 01</span>
          <h1 className="login-brand__title">Your Nifty 50 desk, wired straight into Angel One.</h1>
          <p className="login-brand__sub">
            Connect your SmartAPI credentials once. The bot keeps the session alive and streams live
            prices into the Home grid — gainers, losers, and 52-week range, at a glance.
          </p>
        </div>
        <div>
          <TickerDecoration />
          <p className="login-brand__footnote" style={{ marginTop: 14 }}>
            NSE · NIFTY 50 · LIVE DURING MARKET HOURS
          </p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <h1>Connect Angel One</h1>
          <p className="lede">Sign in with your SmartAPI credentials to start the bot.</p>

          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={handleSubmit}>
            {FIELDS.map((f) => (
              <div className="field" key={f.name}>
                <label htmlFor={f.name}>
                  {f.label}
                  {f.optional && <span className="optional-tag">optional</span>}
                </label>
                <input
                  id={f.name}
                  name={f.name}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.name]}
                  onChange={handleChange}
                  required={!f.optional}
                  autoComplete="off"
                />
                <span className="hint">{f.hint}</span>
              </div>
            ))}

            <button className="submit-btn" type="submit" disabled={submitting}>
              {submitting ? 'Connecting…' : 'Connect & sign in'}
            </button>
          </form>

          <details>
            <summary>Where do I find these?</summary>
            <ol>
              <li>Create a SmartAPI app at smartapi.angelone.in → My Apps to get your API key &amp; secret.</li>
              <li>Visit smartapi.angelbroking.com/enable-totp once to link an authenticator and reveal your TOTP secret.</li>
              <li>Your Client ID and PIN are the same ones you use to log into the Angel One app.</li>
            </ol>
          </details>
        </div>
      </div>
    </div>
  );
}
