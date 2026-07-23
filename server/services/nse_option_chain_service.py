"""
NSE Option Chain Service

Fetches live option chain data from NSE India public APIs.

Endpoints used:
  1. Contract info  — https://www.nseindia.com/api/option-chain-contract-info?symbol=<SYMBOL>
     Returns expiryDates[] and strikePrice[]. Used to determine the next
     upcoming Thursday expiry that is NOT a public holiday.

  2. Option chain   — https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=<SYMBOL>&expiry=<DD-Mon-YYYY>
     Returns full option chain (CE + PE) for the given expiry.

Expiry logic:
  - The next upcoming Thursday on or after today is used as the target expiry.
  - If today IS Thursday we use today's expiry date (same-day expiry trading).
  - A date is valid only if it appears in the expiryDates list returned by NSE
    (that list already excludes holidays).
  - If the nearest Thursday is a holiday (not in the list), we step forward to
    find the next date present in the list.

NSE requires browser-like request headers and a session cookie obtained by
first hitting the homepage. A single requests.Session (with a pre-warmed
cookie) is reused across calls, refreshed when it expires.

All public (no auth) — no Angel One token needed.
"""

from __future__ import annotations

import asyncio
import time
import threading
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

import httpx

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

NSE_BASE        = "https://www.nseindia.com"
CONTRACT_INFO   = "/api/option-chain-contract-info"
OPTION_CHAIN_V3 = "/api/option-chain-v3"

# Browser-like headers NSE requires to not reject the request.
# NOTE: Do NOT include "br" in Accept-Encoding — httpx does not decompress
#       Brotli by default, and NSE will return a raw Brotli stream that
#       causes a UnicodeDecodeError (0x97 = Brotli magic byte).
#       Requesting only gzip/deflate ensures we always get decodable bytes.
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",   # NO "br" — httpx can't decompress Brotli
    "Referer":         "https://www.nseindia.com/option-chain",
    "Connection":      "keep-alive",
    "DNT":             "1",
    "sec-fetch-site":  "same-origin",
    "sec-fetch-mode":  "cors",
    "sec-fetch-dest":  "empty",
}

# Cache the session cookie for up to 25 minutes (NSE sessions expire ~30 min)
_COOKIE_TTL_SECONDS = 25 * 60

# In-memory cache for the option chain to avoid hammering NSE
# Key: (symbol, expiry_str)  Value: (fetched_at_ts, chain_data)
_chain_cache: Dict[Tuple[str, str], Tuple[float, List[Dict]]] = {}
_chain_cache_ttl = 30  # seconds — refresh chain every 30 s during live trading

# Contract-info cache  Key: symbol  Value: (fetched_at_ts, expiry_dates_list)
_contract_cache: Dict[str, Tuple[float, List[str]]] = {}
_contract_cache_ttl = 5 * 60  # 5 minutes

_lock = threading.Lock()


# ──────────────────────────────────────────────────────────────────────────────
# NSE HTTP session manager
# ──────────────────────────────────────────────────────────────────────────────

class _NseSession:
    """
    Manages a persistent httpx.AsyncClient with a warmed-up NSE session cookie.
    NSE's AJAX APIs only respond with valid JSON when a prior visit to the
    homepage has set the 'nsit' and 'nseappid' cookies.
    """

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._warmed_at: float = 0.0
        self._lock = asyncio.Lock()

    async def _warm(self):
        """
        Create a fresh httpx client and warm it by visiting the NSE option-chain
        page. This sets the mandatory 'nsit' session cookie without which the
        JSON API endpoints return HTML / empty responses.

        NOTE: The NSE homepage (/) returns 403; /option-chain returns 200 and
        sets the required cookies. Always use /option-chain to warm the session.
        """
        if self._client:
            try:
                await self._client.aclose()
            except Exception:
                pass

        self._client = httpx.AsyncClient(
            base_url=NSE_BASE,
            headers=_BROWSER_HEADERS,
            timeout=20.0,
            follow_redirects=True,
        )
        # /option-chain sets the nsit cookie; NSE homepage (/) returns 403
        try:
            await self._client.get("/option-chain")
        except Exception:
            pass
        self._warmed_at = time.monotonic()

    @staticmethod
    def _decode_response(resp: httpx.Response) -> dict:
        """
        Safely decode an NSE response to JSON.

        httpx automatically decompresses gzip/deflate when those are in
        Accept-Encoding. However if — despite our header — NSE sends a
        Brotli-encoded body (Content-Encoding: br), fall back to reading
        raw bytes and decoding with latin-1 (which is lossless for arbitrary
        bytes) before JSON-parsing.
        """
        content_encoding = resp.headers.get("content-encoding", "").lower()

        if "br" in content_encoding:
            # Try brotli library if installed; otherwise attempt raw decode
            raw = resp.content
            try:
                import brotli  # type: ignore
                text = brotli.decompress(raw).decode("utf-8")
            except ImportError:
                # brotli not installed — try latin-1 (preserves all byte values)
                text = raw.decode("latin-1")
            import json
            return json.loads(text)

        # Standard path: httpx has already decompressed gzip/deflate
        try:
            return resp.json()
        except Exception:
            # Last-resort: decode raw bytes as latin-1 then parse JSON
            import json
            return json.loads(resp.content.decode("latin-1"))

    async def get(self, path: str, params: dict = None) -> dict:
        """
        Make a GET request to NSE, re-warming the session cookie if needed.
        Returns parsed JSON. Retries once on auth failure.
        """
        async with self._lock:
            elapsed = time.monotonic() - self._warmed_at
            if self._client is None or elapsed > _COOKIE_TTL_SECONDS:
                await self._warm()

        async def _do_get() -> dict:
            resp = await self._client.get(path, params=params)
            resp.raise_for_status()
            return self._decode_response(resp)

        try:
            return await _do_get()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in (401, 403):
                # Session expired — re-warm and retry once
                async with self._lock:
                    await self._warm()
                return await _do_get()
            raise
        except (UnicodeDecodeError, ValueError) as exc:
            # Encoding or JSON parse error — re-warm and retry once
            async with self._lock:
                await self._warm()
            return await _do_get()


_nse_session = _NseSession()


# ──────────────────────────────────────────────────────────────────────────────
# Expiry date helpers
# ──────────────────────────────────────────────────────────────────────────────

def _parse_nse_date(s: str) -> date:
    """Parse 'DD-Mon-YYYY' → date. e.g. '28-Jul-2026' → date(2026, 7, 28)"""
    return datetime.strptime(s, "%d-%b-%Y").date()


def _format_nse_date(d: date) -> str:
    """Format date → 'DD-Mon-YYYY'. e.g. date(2026, 7, 28) → '28-Jul-2026'"""
    return d.strftime("%-d-%b-%Y")   # %-d = no zero-pad on Linux/Mac


def _next_thursday_on_or_after(d: date) -> date:
    """Return the first Thursday >= d."""
    days_ahead = (3 - d.weekday()) % 7   # Thursday = weekday 3
    return d + timedelta(days=days_ahead)


# NSE NIFTY/BANKNIFTY weekly expiry day — Tuesday = weekday 1
# (The user referred to "Thursday" but NSE data confirms expiries fall on Tuesdays)
EXPIRY_WEEKDAY = 1   # Tuesday


def find_upcoming_expiry(expiry_dates: List[str], today: date = None) -> Optional[str]:
    """
    From the NSE expiryDates list, find the nearest upcoming expiry that:
      • is on or after today, AND
      • falls on the standard NSE weekly expiry weekday (Tuesday).

    If today IS Tuesday and today appears in the list → use today (same-day expiry).
    Otherwise step forward through the sorted list to find the next Tuesday entry.

    The NSE expiryDates list:
      - is already sorted ascending.
      - already excludes public holidays (NSE moves expiry to the prior trading
        day when a Tuesday is a holiday, so whatever date appears IS tradeable).

    Therefore: just return the first entry whose date >= today and whose weekday
    matches EXPIRY_WEEKDAY, trusting NSE to have adjusted for holidays.
    """
    today = today or date.today()
    parsed = [(s, _parse_nse_date(s)) for s in expiry_dates]
    parsed.sort(key=lambda x: x[1])

    # Primary: first entry on the correct expiry weekday on or after today
    for raw_str, exp_date in parsed:
        if exp_date < today:
            continue
        if exp_date.weekday() == EXPIRY_WEEKDAY:
            return raw_str

    # Fallback: NSE moved an expiry to a non-Tuesday due to holiday;
    # return the very next available expiry date regardless of weekday.
    for raw_str, exp_date in parsed:
        if exp_date >= today:
            return raw_str

    return None


# ──────────────────────────────────────────────────────────────────────────────
# Contract info (expiry dates)
# ──────────────────────────────────────────────────────────────────────────────

async def fetch_contract_info(symbol: str) -> List[str]:
    """
    Fetch expiryDates for a symbol from NSE.
    Returns list of date strings in 'DD-Mon-YYYY' format.
    Caches result for 5 minutes.
    """
    with _lock:
        cached = _contract_cache.get(symbol)
        if cached and time.monotonic() - cached[0] < _contract_cache_ttl:
            return cached[1]

    data = await _nse_session.get(CONTRACT_INFO, params={"symbol": symbol})
    expiry_dates: List[str] = data.get("expiryDates", [])

    with _lock:
        _contract_cache[symbol] = (time.monotonic(), expiry_dates)

    return expiry_dates


# ──────────────────────────────────────────────────────────────────────────────
# Option chain fetch + normalise
# ──────────────────────────────────────────────────────────────────────────────

def _normalise_chain(raw_data: dict, symbol: str, expiry_str: str) -> List[Dict]:
    """
    Parse NSE option-chain-v3 response into the flat list format expected by
    build_legs():
      [{strike, type, ltp, bidPrice, askPrice, oi, volume, iv,
        symbolToken (empty for NSE), tradingSymbol, underlying, lotSize}, ...]

    NSE option-chain-v3 response structure:
      {
        "records": {
          "data": [{"strikePrice": 23800, "CE": {...}, "PE": {...}}, ...],
          "underlyingValue": 23833.45,
          ...
        },
        "filtered": {...}
      }

    The strike is in each record at the top level (not inside CE/PE).
    underlyingValue is inside records, not filtered.
    """
    from services.expiry_options_service import LOT_SIZES

    lot = LOT_SIZES.get(symbol, 25)

    # records.data holds the option rows; records.underlyingValue has spot price
    records_block   = raw_data.get("records", {})
    data_rows       = records_block.get("data", [])
    underlying_val  = float(records_block.get("underlyingValue", 0) or 0)

    # Pre-build the date portion of the trading symbol once
    try:
        exp_date = _parse_nse_date(expiry_str)
        sym_date = exp_date.strftime("%d%b%Y").upper()   # e.g. "28JUL2026"
    except Exception:
        sym_date = expiry_str.replace("-", "").upper()

    chain: List[Dict] = []

    for record in data_rows:
        strike = float(record.get("strikePrice", 0))
        if strike <= 0:
            continue

        for opt_type in ("CE", "PE"):
            leg_data = record.get(opt_type)
            if not leg_data:
                continue

            ltp    = float(leg_data.get("lastPrice",          0) or 0)
            bid    = float(leg_data.get("bidprice",           0) or 0)
            ask    = float(leg_data.get("askPrice",           0) or 0)
            oi     = float(leg_data.get("openInterest",       0) or 0)
            volume = float(leg_data.get("totalTradedVolume",  0) or 0)
            iv     = float(leg_data.get("impliedVolatility",  0) or 0)

            # e.g. NIFTY28JUL2026CE23800
            trading_symbol = f"{symbol}{sym_date}{opt_type}{int(strike)}"

            chain.append({
                "strike":        strike,
                "type":          opt_type,
                "ltp":           ltp,
                "bidPrice":      bid,
                "askPrice":      ask,
                "oi":            oi,
                "volume":        volume,
                "iv":            iv,
                "symbolToken":   trading_symbol,   # used as tick-sim key
                "tradingSymbol": trading_symbol,
                "underlying":    underlying_val,
                "lotSize":       lot,
                "expiry":        expiry_str,
            })

    return chain


async def fetch_option_chain(symbol: str, expiry_str: str) -> List[Dict]:
    """
    Fetch the full option chain from NSE for a given symbol + expiry.
    Result is cached for _chain_cache_ttl seconds.

    Args:
        symbol:     'NIFTY', 'BANKNIFTY', etc.
        expiry_str: 'DD-Mon-YYYY' as returned by NSE, e.g. '28-Jul-2026'

    Returns:
        Normalised flat list of option rows.
    """
    cache_key = (symbol, expiry_str)
    with _lock:
        cached = _chain_cache.get(cache_key)
        if cached and time.monotonic() - cached[0] < _chain_cache_ttl:
            return cached[1]

    data = await _nse_session.get(
        OPTION_CHAIN_V3,
        params={"type": "Indices", "symbol": symbol, "expiry": expiry_str},
    )

    chain = _normalise_chain(data, symbol, expiry_str)

    with _lock:
        _chain_cache[cache_key] = (time.monotonic(), chain)

    return chain


# ──────────────────────────────────────────────────────────────────────────────
# High-level helper used by ExpiryOptionsService
# ──────────────────────────────────────────────────────────────────────────────

async def get_chain_for_instrument(symbol: str) -> Tuple[List[Dict], str]:
    """
    Determine the next upcoming Thursday expiry for symbol and fetch its chain.

    Returns:
        (chain, expiry_str)  where expiry_str is 'DD-Mon-YYYY'

    Raises:
        RuntimeError if no upcoming expiry can be determined or chain is empty.
    """
    expiry_dates = await fetch_contract_info(symbol)
    if not expiry_dates:
        raise RuntimeError(f"No expiry dates returned by NSE for {symbol}")

    expiry_str = find_upcoming_expiry(expiry_dates)
    if not expiry_str:
        raise RuntimeError(
            f"Could not determine upcoming Thursday expiry for {symbol}. "
            f"Available dates: {expiry_dates[:5]}"
        )

    chain = await fetch_option_chain(symbol, expiry_str)
    if not chain:
        raise RuntimeError(
            f"NSE returned empty option chain for {symbol} expiry {expiry_str}"
        )

    return chain, expiry_str


async def get_expiry_dates_for_symbol(symbol: str) -> Tuple[List[str], Optional[str]]:
    """
    Return (all_expiry_dates, upcoming_expiry_str) for a symbol.
    Used by expiry_info endpoint to show dates in the UI.
    """
    expiry_dates = await fetch_contract_info(symbol)
    upcoming     = find_upcoming_expiry(expiry_dates)
    return expiry_dates, upcoming


# Made with Bob
