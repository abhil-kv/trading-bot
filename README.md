# Trading Bot — Step 1: Nifty 50 Home Grid

A first slice of a trading bot built on **Express** (API) + **React** (UI), wired to
**Angel One's SmartAPI**. This step covers:

- A login page that connects your Angel One SmartAPI credentials.
- A **Home** tab (left nav) showing all 50 Nifty 50 constituents in a live grid:
  title, today's gain/loss, % change, and 52-week high/low, with a visual
  range bar showing where the current price sits inside its 52-week band.

It's intentionally scoped to *read-only market data* so you can verify the
Angel One connection works before building order placement / strategies on
top of it.

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

## Project layout

```
trading-bot/
├── server/      Express API — talks to Angel One, never exposes tokens to the browser
└── client/      React (Vite) UI — login page + dashboard with left nav
```

## Running it

### 1. Backend

```bash
cd server
cp .env.example .env     # edit if you want a different port/origin
npm install
npm run dev               # http://localhost:4000
```

### 2. Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

Open `http://localhost:5173`, fill in the login form, and you should land on
the Home tab with the Nifty 50 grid. The grid auto-refreshes every 15
seconds; it also supports filtering by symbol/name and sorting any numeric
column by clicking its header.

> Market data only moves during NSE trading hours (9:15–15:30 IST). Outside
> that window you'll correctly see the last close, flat change.

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
  Express session, in server memory, for the lifetime of that browser
  session. They're not written to disk or a database. Restarting the server
  logs you out.
- Sessions use Express's in-memory store, fine for one user / one process.
  For multiple users or a long-running deployment, swap in a real session
  store (Redis, etc.) and consider encrypting credentials at rest.
- Always run this behind HTTPS in anything beyond local development, and set
  `COOKIE_SECURE=true` in `server/.env` once you do.
- Treat the API key/secret and TOTP secret like passwords — anyone with them
  can log in as you.

## What's next (left nav already has stubs for these)

The sidebar already lists **Orders**, **Positions**, **Strategies**, and
**Settings** as "coming soon" — natural next steps once you're ready to move
from read-only data to actually placing and managing trades:

- WebSocket live ticks (Angel One's `SmartWebSocketV2`) instead of polling.
- Order placement endpoints + an Orders tab.
- A simple strategy engine (rules → signals → orders) feeding off this same
  quote pipeline.
