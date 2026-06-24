"""
Instrument Master Service
Handles downloading and caching of Angel One's scrip master data
"""
import os
import json
import httpx
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime, timedelta

from config import settings
from data.nifty50 import NIFTY50

# Cache directory and file
CACHE_DIR = Path(__file__).parent.parent / ".cache"
CACHE_FILE = CACHE_DIR / "scripmaster.json"

# In-memory cache
_in_memory_map: Optional[Dict[str, Dict]] = None
_in_memory_loaded_at: Optional[datetime] = None


def ensure_cache_dir():
    """Create cache directory if it doesn't exist"""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


async def download_scrip_master() -> list:
    """
    Download the scrip master file from Angel One.
    
    Returns:
        List of instrument dictionaries
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(settings.ANGEL_SCRIP_MASTER_URL)
        return response.json()


def read_cache_from_disk() -> Optional[list]:
    """
    Read cached scrip master from disk if it exists and is not expired.
    
    Returns:
        List of instruments or None if cache is invalid/expired
    """
    if not CACHE_FILE.exists():
        return None
    
    # Check if cache is expired
    file_mtime = datetime.fromtimestamp(CACHE_FILE.stat().st_mtime)
    ttl = timedelta(milliseconds=settings.INSTRUMENT_MASTER_TTL_MS)
    
    if datetime.now() - file_mtime > ttl:
        return None
    
    try:
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return None


def write_cache_to_disk(instruments: list):
    """
    Write instruments to disk cache.
    
    Args:
        instruments: List of instrument dictionaries
    """
    ensure_cache_dir()
    with open(CACHE_FILE, 'w') as f:
        json.dump(instruments, f)


def index_nifty50(instruments: list) -> Dict[str, Dict]:
    """
    Build a map of Nifty 50 symbols to their tokens.
    Only indexes NSE equity instruments that are in the Nifty 50 list.
    
    Args:
        instruments: Full list of instruments from scrip master
        
    Returns:
        Dictionary mapping symbol to {token, tradingSymbol}
    """
    # Create a map of trading symbols (with -EQ suffix) to base symbols
    wanted = {f"{stock['symbol']}-EQ": stock['symbol'] for stock in NIFTY50}
    result = {}
    
    for row in instruments:
        if row.get("exch_seg") != "NSE":
            continue
        
        trading_symbol = row.get("symbol")
        base_symbol = wanted.get(trading_symbol)
        
        if base_symbol:
            result[base_symbol] = {
                "token": row.get("token"),
                "tradingSymbol": trading_symbol
            }
    
    return result


async def get_nifty50_token_map(force_refresh: bool = False) -> Dict[str, Dict]:
    """
    Get a map of Nifty 50 symbols to their tokens.
    Uses in-memory cache, then disk cache, then downloads if needed.
    
    Args:
        force_refresh: If True, bypass caches and download fresh data
        
    Returns:
        Dictionary mapping symbol to {token, tradingSymbol}
    """
    global _in_memory_map, _in_memory_loaded_at
    
    # Check in-memory cache
    if not force_refresh and _in_memory_map and _in_memory_loaded_at:
        ttl = timedelta(milliseconds=settings.INSTRUMENT_MASTER_TTL_MS)
        if datetime.now() - _in_memory_loaded_at < ttl:
            return _in_memory_map
    
    # Try disk cache
    instruments = None if force_refresh else read_cache_from_disk()
    
    # Download if no valid cache
    if not instruments:
        instruments = await download_scrip_master()
        write_cache_to_disk(instruments)
    
    # Build index
    _in_memory_map = index_nifty50(instruments)
    _in_memory_loaded_at = datetime.now()
    
    # Check for missing symbols
    missing = [stock["symbol"] for stock in NIFTY50 if stock["symbol"] not in _in_memory_map]
    if missing:
        print(f"[instrumentMaster] could not resolve tokens for: {', '.join(missing)}")
    
    return _in_memory_map


# Create singleton instance
class InstrumentMasterService:
    """Service for managing instrument master data"""
    
    @staticmethod
    async def get_token_map(force_refresh: bool = False) -> Dict[str, Dict]:
        """Get Nifty 50 token map"""
        return await get_nifty50_token_map(force_refresh)


instrument_master_service = InstrumentMasterService()

# Made with Bob
