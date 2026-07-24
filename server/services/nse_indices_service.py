"""
NSE Indices Service

Fetches live index quotes (NIFTY 50, BANK NIFTY, FINNIFTY, SENSEX) from
the NSE India public market-data API — no authentication required.

Endpoint used:
  GET https://www.nseindia.com/api/allIndices
  Returns a list of objects, each with: "index", "last", "change", "percentChange"

The session cookie is borrowed from the shared _NseSession already managed by
nse_option_chain_service, so we don't open a second httpx client.
"""
from __future__ import annotations

import time
from typing import Dict, List, Optional

from services.nse_option_chain_service import _nse_session   # re-use warmed session

# Indices we care about — keyed by the exact "index" field NSE returns
_WANTED: Dict[str, str] = {
    "NIFTY 50":                 "NIFTY",
    "NIFTY BANK":               "BANKNIFTY",
    "NIFTY FINANCIAL SERVICES": "FINNIFTY",
    "NIFTY MIDCAP SELECT":      "MIDCPNIFTY",
    "S&P BSE SENSEX":           "SENSEX",
    "INDIA VIX":                "INDIAVIX",
}

# Simple 5-second in-memory cache so the sidebar tick polling doesn't hammer NSE
_cache_ts: float = 0.0
_cache_data: Optional[List[Dict]] = None
_CACHE_TTL = 5  # seconds


async def get_indices() -> List[Dict]:
    """
    Return live quotes for the tracked indices.

    Each item:
      { symbol, name, value, change, changePercent }

    Raises on network / parse errors — callers should handle gracefully.
    """
    global _cache_ts, _cache_data

    if _cache_data is not None and (time.monotonic() - _cache_ts) < _CACHE_TTL:
        return _cache_data

    raw = await _nse_session.get("/api/allIndices")

    result: List[Dict] = []
    for item in raw.get("data", []):
        nse_name = item.get("index", "")
        symbol = _WANTED.get(nse_name)
        if symbol is None:
            continue

        def _f(val) -> Optional[float]:
            try:
                return float(val)
            except (TypeError, ValueError):
                return None

        result.append({
            "symbol":        symbol,
            "name":          nse_name,
            "value":         _f(item.get("last")),
            "change":        _f(item.get("change")),
            "changePercent": _f(item.get("percentChange")),
        })

    # Preserve a stable display order
    order = list(_WANTED.values())
    result.sort(key=lambda r: order.index(r["symbol"]) if r["symbol"] in order else 99)

    _cache_ts = time.monotonic()
    _cache_data = result
    return result
