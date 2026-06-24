# Trading Bot — Full-Featured Trading Platform

A comprehensive trading bot built with **Python/FastAPI** (API) + **React** (UI), integrated with **Angel One's SmartAPI** and **Marketaux News API**.

## ✨ Features

- 🔐 **Authentication** - Secure login with Angel One SmartAPI credentials
- 📊 **Live Market Data** - Real-time Nifty 50 stock quotes via WebSocket
- 📰 **Market News** - Financial news from Marketaux API with advanced filters
- 📈 **Index Cards** - NIFTY 50, BANK NIFTY, FIN NIFTY, SENSEX indicators
- 🎯 **Strategies Tab** - Toggle between Stocks and Options strategies
- 🔄 **Auto-Refresh** - WebSocket updates every 3 seconds
- 🎨 **Modern UI** - Collapsible sidebar with connection status indicator
- 🔗 **TradingView Integration** - Click stocks to open charts
- 📚 **Auto API Docs** - Interactive Swagger UI at `/docs`

## How Angel One login actually works (read this before using the form)

The original ask was for a login form with **Client ID, API key, Secret key**.
Angel One's SmartAPI login needs a bit more than that, so the form asks for:

| Field | What it is | Where to get it |
|---|---|---|
| **Client ID** | Your Angel One login / client code | Same one you use in the Angel One app |
| **PIN** | Your trading PIN/password | Same one you use in the Angel One app |
| **TOTP secret** | A 32-character key | Visit `smartapi.angelbroking.com/enable-totp` **once**, scan the QR into an authenticator app, and copy the secret shown alongside it (not the 6-digit code) |
| **API key** | Identifies your SmartAPI app | `smartapi.angelone.in` → My Apps |
| **API secret** *(optional)* | Used for token-refresh/order signing | Same SmartAPI app page — not used yet by this step, but the field is there for when order placement is added |

Why the TOTP secret and not just a 6-digit code: a bot can't wait for you to
type in a fresh OTP every time its session expires. By storing the secret
(server-side, in memory only — see **Security notes** below) the backend can
generate a valid 6-digit code on demand, the same way an authenticator app
does.

## 🏗️ Project Structure

```
trading-bot/
├── server/             Python/FastAPI API
│   ├── app.py         Main application
│   ├── config.py      Configuration
│   ├── routes/        API routes
│   ├── services/      Business logic
│   ├── middleware/    Authentication
│   ├── utils/         Utilities
│   └── data/          Nifty 50 data
├── client/            React (Vite) UI
├── start-server.sh    Server startup script
├── start-client.sh    Client startup script
└── start-all.sh       Start both in separate terminals
```

## 🚀 Quick Start

### Automatic Setup (Recommended)

```bash
# Start both server and client in separate terminals
./start-all.sh
```

This will:
1. Check for Python 3.12/3.11
2. Create virtual environment
3. Install dependencies
4. Start Python server on port 4000
5. Start React client on port 5173

### Manual Setup

#### Python Server

```bash
cd server
python3.12 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Edit with your credentials
python app.py             # http://localhost:4000
```

Or use the startup script:
```bash
./start-server.sh
```

#### React Client

```bash
cd client
npm install
cp .env.example .env
npm run dev               # http://localhost:5173
```

Or use the startup script:
```bash
./start-client.sh
```

## 🌐 Access the Application

Open `http://localhost:5173` in your browser, login with your Angel One credentials, and explore:

- **Home** - Live Nifty 50 stock grid with real-time updates
- **News** - Market news with advanced filters (country, language, date)
- **Strategies** - Toggle between Stocks and Options strategies
- **Orders** - Coming soon
- **Positions** - Coming soon
- **Settings** - Coming soon

> 💡 Market data only updates during NSE trading hours (9:15–15:30 IST)

### API Documentation

Visit `http://localhost:4000/docs` for interactive Swagger UI documentation!

## How the data flows

1. **Login** (`POST /api/auth/login`) — the server generates a live TOTP from
   your secret and calls Angel One's `loginByPassword` endpoint. On success it
   stores the resulting `jwtToken`/`refreshToken`/`feedToken` in a server-side
   session (cookie-based, `httpOnly`), never in the browser's JS.
2. **Instrument resolution** — on first use, the server downloads Angel One's
   instrument master (a large JSON file of every tradable symbol), caches it
   to disk for 24h, and resolves the 50 Nifty symbols to their Angel One
   tokens.
3. **Quotes** (`GET /api/market/nifty50`) — the server calls Angel One's
   Market Data Quote API in `FULL` mode (batched, ≤50 symbols per call, which
   covers all of Nifty 50 in one request) and reshapes the response into:
   `symbol, name, ltp, change, changePercent, dayHigh, dayLow, high52, low52`.
   If Angel One reports the session token has expired, the server transparently
   refreshes it (falling back to a full re-login with your stored PIN/TOTP
   secret if the refresh token has also expired) and retries once, so the
   frontend never has to deal with re-authentication.

## Security notes (please read before deploying anywhere shared)

This is a personal, local-first tool. A few choices were made for simplicity
that you should harden before exposing it beyond `localhost`:

- Credentials (PIN, TOTP secret, API key/secret) are kept **only** in the
  server session, in server memory, for the lifetime of that browser
  session. They're not written to disk or a database. Restarting the server
  logs you out.
- Sessions use FastAPI's in-memory store, fine for one user / one process.
  For multiple users or a long-running deployment, swap in a real session
  store (Redis, etc.) and consider encrypting credentials at rest.
- Always run this behind HTTPS in anything beyond local development, and set
  `COOKIE_SECURE=true` in `server/.env` once you do.
- Treat the API key/secret and TOTP secret like passwords — anyone with them
  can log in as you.

## 📚 Documentation

- **Server README**: See `server/README.md` for detailed Python setup
- **Installation Guide**: See `server/INSTALL.md` for troubleshooting
- **API Docs**: Visit `http://localhost:4000/docs` when server is running

## 🛠️ Technology Stack

### Backend
- **FastAPI** - Modern async web framework
- **Uvicorn** - ASGI server
- **httpx** - Async HTTP client
- **pyotp** - TOTP generation
- **Pydantic v2** - Data validation

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **React Router** - Navigation

### APIs
- **Angel One SmartAPI** - Market data and trading
- **Marketaux API** - Financial news

## 🔐 Security Notes

- Credentials stored server-side only (never in browser)
- Session-based authentication with httpOnly cookies
- CORS configured for local development
- For production: Enable HTTPS and set `COOKIE_SECURE=true`

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 4000
lsof -ti:4000 | xargs kill -9
```

### Python Version Issues
```bash
# Install Python 3.12 (recommended)
brew install python@3.12

# Or use Python 3.11
brew install python@3.11
```

### Python Module Errors
```bash
# Ensure virtual environment is activated
source server/venv/bin/activate
pip install -r server/requirements.txt
```

### WebSocket Connection Issues
- Verify server is running on port 4000
- Check CORS settings in server config
- Ensure session cookie is being sent

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

This is a personal trading bot project. Feel free to fork and customize for your needs.

## ⚠️ Disclaimer

This software is for educational purposes only. Trading involves risk. Always test thoroughly before using with real money.
