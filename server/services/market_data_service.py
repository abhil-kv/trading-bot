"""
Market Data Service
Handles fetching and caching of market quotes from Angel One
"""
import httpx
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

from config import settings
from utils.angel_headers import build_angel_headers
from services.angel_auth_service import angel_auth_service
from services.instrument_master_service import instrument_master_service
from data.nifty50 import NIFTY50

MAX_TOKENS_PER_REQUEST = 50  # Angel One's documented limit

# Cache for quotes
_cache: Dict[str, Any] = {"at": None, "payload": None}


def chunk_list(lst: list, size: int) -> List[list]:
    """Split a list into chunks of specified size"""
    return [lst[i:i + size] for i in range(0, len(lst), size)]


async def call_quote(api_key: str, jwt_token: str, tokens: List[str]) -> Dict:
    """
    Call Angel One's quote API for given tokens.
    
    Args:
        api_key: Angel One API key
        jwt_token: JWT token for authentication
        tokens: List of instrument tokens
        
    Returns:
        Dictionary with 'fetched' and 'unfetched' lists
    """
    headers = await build_angel_headers(api_key, jwt_token)
    url = f"{settings.ANGEL_BASE_URL}{settings.ANGEL_QUOTE_PATH}"
    
    payload = {
        "mode": "FULL",
        "exchangeTokens": {"NSE": tokens}
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        data = response.json()
    
    if not data or data.get("status") != True:
        message = data.get("message", "Quote request failed") if data else "Quote request failed"
        raise Exception(message)
    
    return data.get("data", {"fetched": [], "unfetched": []})


async def with_auth_retry(session_angel: Dict, fn):
    """
    Execute function with automatic token refresh on auth errors.
    
    Args:
        session_angel: Session data with credentials and tokens
        fn: Async function to execute
        
    Returns:
        Result of the function
    """
    try:
        return await fn(session_angel)
    except Exception as err:
        # Check if it's an auth error
        error_msg = str(err).lower()
        is_auth_error = any(code in error_msg for code in ['ab1010', 'ab1018', 'ab8050', 'ab1020', '401', '403'])
        
        if not is_auth_error:
            raise
        
        # Refresh session and retry
        await angel_auth_service.refresh_or_relogin(session_angel)
        return await fn(session_angel)


def to_number(value: Any) -> Optional[float]:
    """Convert value to float, return None if invalid"""
    try:
        n = float(value)
        return n if not (n != n) else None  # Check for NaN
    except (TypeError, ValueError):
        return None


def shape_row(meta: Dict, raw: Dict) -> Dict:
    """
    Shape raw quote data into standardized format.
    
    Args:
        meta: Metadata with symbol and name
        raw: Raw quote data from Angel One
        
    Returns:
        Formatted quote dictionary
    """
    ltp = to_number(raw.get("ltp"))
    close = to_number(raw.get("close"))  # Previous day's close
    
    # Calculate net change
    net_change = raw.get("netChange")
    if net_change is not None:
        net_change = to_number(net_change)
    elif ltp is not None and close is not None:
        net_change = ltp - close
    else:
        net_change = None
    
    # Calculate percent change
    percent_change = raw.get("percentChange")
    if percent_change is not None:
        percent_change = to_number(percent_change)
    elif net_change is not None and close and close != 0:
        percent_change = (net_change / close) * 100
    else:
        percent_change = None
    
    return {
        "symbol": meta["symbol"],
        "name": meta["name"],
        "tradingSymbol": raw.get("tradingSymbol", f"{meta['symbol']}-EQ"),
        "ltp": ltp,
        "open": to_number(raw.get("open")),
        "dayHigh": to_number(raw.get("high")),
        "dayLow": to_number(raw.get("low")),
        "prevClose": close,
        "change": net_change,
        "changePercent": percent_change,
        "high52": to_number(raw.get("52WeekHigh")),
        "low52": to_number(raw.get("52WeekLow")),
        "volume": to_number(raw.get("tradeVolume")),
        "exchFeedTime": raw.get("exchFeedTime"),
    }


async def get_nifty50_quotes(session_angel: Dict) -> Dict:
    """
    Get quotes for all Nifty 50 stocks.
    Results are cached briefly to avoid excessive API calls.
    
    Args:
        session_angel: Session data with credentials and tokens
        
    Returns:
        Dictionary with stocks, asOf, unresolvedSymbols, and unfetched
    """
    global _cache
    
    # Check cache
    if _cache["payload"] and _cache["at"]:
        cache_age = datetime.now() - _cache["at"]
        ttl = timedelta(milliseconds=settings.QUOTE_CACHE_TTL_MS)
        if cache_age < ttl:
            return _cache["payload"]
    
    # Get token map
    token_map = await instrument_master_service.get_token_map()
    
    # Filter resolvable symbols
    resolvable = [stock for stock in NIFTY50 if stock["symbol"] in token_map]
    token_to_meta = {token_map[stock["symbol"]]["token"]: stock for stock in resolvable}
    tokens = [token_map[stock["symbol"]]["token"] for stock in resolvable]
    
    # Fetch quotes in batches
    batches = chunk_list(tokens, MAX_TOKENS_PER_REQUEST)
    fetched_rows = []
    unfetched = []
    
    for batch in batches:
        async def fetch_batch(s):
            return await call_quote(s["apiKey"], s["jwtToken"], batch)
        
        result = await with_auth_retry(session_angel, fetch_batch)
        
        for raw in result.get("fetched", []):
            token = raw.get("symbolToken")
            meta = token_to_meta.get(token)
            if meta:
                fetched_rows.append(shape_row(meta, raw))
        
        unfetched.extend(result.get("unfetched", []))
    
    # Maintain original order
    by_symbol = {row["symbol"]: row for row in fetched_rows}
    stocks = [by_symbol[stock["symbol"]] for stock in NIFTY50 if stock["symbol"] in by_symbol]
    
    payload = {
        "asOf": datetime.utcnow().isoformat() + "Z",
        "stocks": stocks,
        "unresolvedSymbols": [stock["symbol"] for stock in NIFTY50 if stock["symbol"] not in token_map],
        "unfetched": unfetched,
    }
    
    # Update cache
    _cache = {"at": datetime.now(), "payload": payload}
    
    return payload


class MarketDataService:
    """Service for fetching market data"""
    
    @staticmethod
    async def get_nifty50_quotes(session_angel: Dict) -> Dict:
        """Get Nifty 50 quotes"""
        return await get_nifty50_quotes(session_angel)


# Create singleton instance
market_data_service = MarketDataService()

# Made with Bob
