"""
Angel One Option Quote Service

Responsibilities:
  1. Resolve NSE option trading symbols → Angel One NFO tokens
     by looking them up in the scrip master file (already cached on disk).
  2. Fetch live LTPs for a list of tokens via Angel One's quote API (NFO exchange).

This service is used ONLY for price monitoring after the 4 legs have been
identified from the NSE option chain.  The NSE chain is called ONCE at entry
to pick strikes; every subsequent price tick comes from Angel One.

Symbol translation:
  NSE chain returns trading symbols like  NIFTY28JUL2026PE23400
  Angel One scrip master uses              NIFTY28JUL26PE23400   (2-digit year)

  Conversion: strip the 4-digit year → insert 2-digit year.
  Format: f"{underlying}{DD}{MON}{YY}{type}{strike}"
    e.g.  NIFTY + 28 + JUL + 26 + PE + 23400  → NIFTY28JUL26PE23400

Angel One quote API:
  POST /rest/secure/angelbroking/market/v1/quote/
  Body: {"mode": "LTP", "exchangeTokens": {"NFO": ["63912", "63915", ...]}}
  Returns: {"data": {"fetched": [{"symbolToken": "63912", "ltp": 20.5}, ...], ...}}
"""
from __future__ import annotations

import json
import time
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx

from config import settings
from utils.angel_headers import build_angel_headers

# ──────────────────────────────────────────────────────────────────────────────
# Scrip master index (NFO instruments only)
# ──────────────────────────────────────────────────────────────────────────────

_CACHE_FILE = Path(__file__).parent.parent / ".cache" / "scripmaster.json"

# In-memory index: angel_symbol → {token, lotSize}
_nfo_index: Optional[Dict[str, Dict]] = None
_nfo_index_lock = threading.Lock()


def _load_nfo_index() -> Dict[str, Dict]:
    """
    Build an in-memory symbol→token map for all NFO OPTIDX instruments.
    Reads from the scrip master disk cache (written by instrument_master_service).
    Re-builds whenever the cache file is newer than our in-memory copy.
    """
    global _nfo_index
    with _nfo_index_lock:
        if _nfo_index is not None:
            return _nfo_index

        if not _CACHE_FILE.exists():
            return {}

        try:
            with open(_CACHE_FILE) as f:
                instruments = json.load(f)
        except Exception:
            return {}

        idx: Dict[str, Dict] = {}
        for row in instruments:
            if row.get("exch_seg") != "NFO":
                continue
            if row.get("instrumenttype") not in ("OPTIDX", "OPTSTK"):
                continue
            sym = row.get("symbol", "")
            if not sym:
                continue
            idx[sym] = {
                "token":   str(row.get("token", "")),
                "lotSize": int(row.get("lotsize", 1)),
            }

        _nfo_index = idx
        return _nfo_index


def _reload_nfo_index():
    """Force reload the NFO index (call after scrip master refresh)."""
    global _nfo_index
    with _nfo_index_lock:
        _nfo_index = None
    _load_nfo_index()


# ──────────────────────────────────────────────────────────────────────────────
# Symbol translation: NSE chain symbol → Angel One symbol
# ──────────────────────────────────────────────────────────────────────────────

def nse_to_angel_symbol(nse_trading_symbol: str, expiry_nse: str) -> str:
    """
    Convert an NSE option trading symbol to the Angel One scrip-master symbol.

    NSE format   : NIFTY28JUL2026PE23400  (4-digit year, type BEFORE strike)
    Angel format : NIFTY28JUL2623400PE    (2-digit year, type AFTER  strike)

    e.g.  NIFTY + 28JUL2026 + PE + 23400   →   NIFTY + 28JUL26 + 23400 + PE

    Args:
        nse_trading_symbol: e.g. "NIFTY28JUL2026PE23400"
        expiry_nse:         e.g. "28-Jul-2026"

    Returns:
        Angel One symbol string, e.g. "NIFTY28JUL2623400PE"
    """
    import re
    try:
        exp_date   = datetime.strptime(expiry_nse, "%d-%b-%Y")
        angel_date = exp_date.strftime("%d%b%y").upper()    # "28JUL26"
        nse_date   = exp_date.strftime("%d%b%Y").upper()    # "28JUL2026"

        # NSE symbol structure: {underlying}{nse_date}{type}{strike}
        # e.g.  NIFTY  28JUL2026  PE  23400
        # Strip the nse_date to get "{underlying}" prefix and "{type}{strike}" suffix
        if nse_date not in nse_trading_symbol:
            return nse_trading_symbol   # unexpected format — return as-is

        prefix, rest = nse_trading_symbol.split(nse_date, 1)
        # rest is now "PE23400" — extract type (CE/PE) and strike number
        m = re.match(r'^(CE|PE)(\d+)$', rest)
        if not m:
            return nse_trading_symbol

        opt_type = m.group(1)    # "PE"
        strike   = m.group(2)    # "23400"

        # Angel One format: {underlying}{angel_date}{strike}{type}
        return f"{prefix}{angel_date}{strike}{opt_type}"

    except Exception:
        return nse_trading_symbol


def resolve_tokens(legs: List[Dict]) -> List[Dict]:
    """
    Look up the Angel One NFO token for each leg using the scrip master.

    Adds/updates each leg dict in-place with:
        "angelSymbol"  — Angel One scrip master symbol
        "angelToken"   — NFO token string (empty string if not found)

    Returns the same list for chaining.
    """
    idx = _load_nfo_index()

    for leg in legs:
        nse_sym  = leg.get("tradingSymbol", "")
        expiry   = leg.get("expiry", "")
        angel_sym = nse_to_angel_symbol(nse_sym, expiry)
        info      = idx.get(angel_sym, {})
        leg["angelSymbol"] = angel_sym
        leg["angelToken"]  = info.get("token", "")
        if not leg["angelToken"]:
            print(f"[angel_option_service] token not found for {angel_sym} (nse: {nse_sym})")

    return legs


# ──────────────────────────────────────────────────────────────────────────────
# Live quote fetch via Angel One
# ──────────────────────────────────────────────────────────────────────────────

async def fetch_option_ltps(
    angel: Dict,
    legs: List[Dict],
) -> Dict[str, float]:
    """
    Fetch live LTPs for the given legs from Angel One's quote API.

    Args:
        angel:  Session dict with keys apiKey, jwtToken
        legs:   List of leg dicts (must have "angelToken" set by resolve_tokens)

    Returns:
        Dict mapping angelToken → ltp (float).
        Legs whose token is empty or unfetched are absent from the result.
    """
    tokens = [l["angelToken"] for l in legs if l.get("angelToken")]
    if not tokens:
        return {}

    headers = await build_angel_headers(angel["apiKey"], angel["jwtToken"])
    url = f"{settings.ANGEL_BASE_URL}{settings.ANGEL_QUOTE_PATH}"

    payload = {
        "mode": "LTP",
        "exchangeTokens": {"NFO": tokens},
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        data = resp.json()

    if not data or data.get("status") is not True:
        msg = (data or {}).get("message", "Quote API error")
        raise RuntimeError(f"Angel One quote failed: {msg}")

    result: Dict[str, float] = {}
    for row in data.get("data", {}).get("fetched", []):
        token = str(row.get("symbolToken", ""))
        ltp   = float(row.get("ltp", 0) or 0)
        if token:
            result[token] = ltp

    return result


# Made with Bob
