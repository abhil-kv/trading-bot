"""
Swing Strategy Service
Fetches stocks from ChartInk API and analyzes them
Runs in a separate thread for continuous monitoring
Implements file-based caching with daily refresh
"""
import asyncio
import threading
import httpx
import json
import os
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pathlib import Path

from utils.angel_headers import build_angel_headers
from services.instrument_master_service import instrument_master_service
from config import settings


# Cache file path
CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
CACHE_FILE = CACHE_DIR / "swing_stocks_cache.json"


class SwingStrategy:
    """
    Swing Strategy
    Fetches stocks from ChartInk API
    Filters by daily close > 200
    Runs in a separate thread
    Implements daily caching
    """
    
    def __init__(self):
        self.stocks: List[Dict] = []
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.lock = threading.Lock()
        self.last_fetch_time: Optional[datetime] = None
        self.chartink_api_url = "https://chartink.com/stocks-new/scan-stocks?scan_link=scanlink:57cf638e35ce78ccc92882d1e2ae51e0"
        
        # Ensure cache directory exists
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
    def start(self):
        """Start the strategy thread"""
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()
            print("Swing Strategy started")
    
    def stop(self):
        """Stop the strategy thread"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        print("Swing Strategy stopped")
    
    def _run_loop(self):
        """Main strategy loop (runs in separate thread)"""
        while self.running:
            try:
                # Sleep for 5 minutes between checks
                threading.Event().wait(300)
            except Exception as e:
                print(f"Error in swing strategy loop: {e}")
    
    def _load_cache(self) -> Optional[Dict]:
        """Load cached data from file"""
        try:
            if CACHE_FILE.exists():
                with open(CACHE_FILE, 'r') as f:
                    cache_data = json.load(f)
                    
                # Check if cache is still valid (less than 1 day old)
                cached_time = datetime.fromisoformat(cache_data.get('fetch_time', ''))
                if datetime.now() - cached_time < timedelta(days=1):
                    print(f"Using cached data from {cached_time.strftime('%Y-%m-%d %H:%M:%S')}")
                    return cache_data
                else:
                    print(f"Cache expired (fetched at {cached_time.strftime('%Y-%m-%d %H:%M:%S')})")
                    return None
        except Exception as e:
            print(f"Error loading cache: {e}")
            return None
    
    def _save_cache(self, nse_codes: List[str]):
        """Save NSE codes to cache file with timestamp"""
        try:
            cache_data = {
                'fetch_time': datetime.now().isoformat(),
                'nse_codes': nse_codes,
                'count': len(nse_codes)
            }
            with open(CACHE_FILE, 'w') as f:
                json.dump(cache_data, f, indent=2)
            print(f"Cached {len(nse_codes)} stocks at {cache_data['fetch_time']}")
        except Exception as e:
            print(f"Error saving cache: {e}")
    
    async def fetch_chartink_stocks(self, force_refresh: bool = False) -> List[str]:
        """
        Fetch stocks from ChartInk API
        Returns list of NSE stock codes
        Uses cache if available and not expired
        """
        # Try to load from cache first
        if not force_refresh:
            cache_data = self._load_cache()
            if cache_data:
                return cache_data.get('nse_codes', [])
        
        # Fetch fresh data from ChartInk
        try:
            print("Fetching fresh data from ChartInk API...")
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://chartink.com/',
                'Origin': 'https://chartink.com',
            }
            
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(self.chartink_api_url, headers=headers)
                
                if response.status_code != 200:
                    print(f"ChartInk returned status code: {response.status_code}")
                    return []
                
                # Try to parse JSON response
                try:
                    data = response.json()
                    
                    # Extract NSE codes from the response
                    # ChartInk API returns data in 'data' field with stock information
                    nse_codes = []
                    
                    if isinstance(data, dict) and 'data' in data:
                        stocks_data = data['data']
                        for stock in stocks_data:
                            # Extract NSE code (usually in 'nsecode' or 'stock' field)
                            nse_code = stock.get('nsecode') or stock.get('stock') or stock.get('name')
                            if nse_code:
                                # Clean up the NSE code (remove -EQ suffix if present)
                                nse_code = nse_code.replace('-EQ', '').strip()
                                if nse_code and nse_code not in nse_codes:
                                    nse_codes.append(nse_code)
                    
                    print(f"Found {len(nse_codes)} stocks from ChartInk API")
                    
                    # Save to cache
                    if nse_codes:
                        self._save_cache(nse_codes)
                    
                    return nse_codes
                    
                except json.JSONDecodeError:
                    print("Failed to parse JSON response from ChartInk")
                    return []
                
        except Exception as e:
            print(f"Error fetching from ChartInk: {e}")
            return []
    
    async def fetch_stock_data(self, symbol: str, api_key: str, jwt_token: str) -> Optional[Dict]:
        """
        Fetch stock data from Angel One API
        Returns stock details including 52-week high/low, current price, volume
        """
        try:
            # Get token for symbol
            token_map = await instrument_master_service.get_token_map()
            token_info = token_map.get(symbol)
            
            if not token_info:
                return None
            
            symbol_token = token_info['token']
            
            # Fetch quote data
            headers = await build_angel_headers(api_key, jwt_token)
            url = f"{settings.ANGEL_BASE_URL}/rest/secure/angelbroking/market/v1/quote/"
            
            payload = {
                "mode": "FULL",
                "exchangeTokens": {
                    "NSE": [symbol_token]
                }
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                
                if response.status_code != 200:
                    return None
                
                data = response.json()
                
                if not data or data.get("status") != True:
                    return None
                
                fetched_data = data.get("data", {}).get("fetched", [])
                if not fetched_data:
                    return None
                
                stock_data = fetched_data[0]
                
                # Extract relevant data
                ltp = float(stock_data.get("ltp", 0))
                close = float(stock_data.get("close", 0))
                high_52w = float(stock_data.get("52weekhigh", 0))
                low_52w = float(stock_data.get("52weeklow", 0))
                volume = int(stock_data.get("volume", 0))
                
                # Filter: daily close > 200
                if close <= 200:
                    return None
                
                return {
                    'symbol': symbol,
                    'name': token_info.get('name', symbol),
                    'ltp': ltp,
                    'close': close,
                    'high_52w': high_52w,
                    'low_52w': low_52w,
                    'volume': volume,
                    'change': float(stock_data.get("change", 0)),
                    'changePercent': float(stock_data.get("changepercent", 0)),
                }
                
        except Exception as e:
            # Silently skip stocks that fail
            return None
    
    async def analyze_stocks(self, session_angel: Dict, force_refresh: bool = False) -> List[Dict]:
        """
        Main analysis function
        Fetches stocks from ChartInk (or cache) and gets their data from Angel One
        """
        api_key = session_angel.get("apiKey")
        jwt_token = session_angel.get("jwtToken")
        
        if not api_key or not jwt_token:
            raise Exception("Missing authentication credentials")
        
        # Fetch stock symbols from ChartInk or cache
        nse_codes = await self.fetch_chartink_stocks(force_refresh)
        
        if not nse_codes:
            print("No NSE codes found, using fallback stocks")
            # Fallback to some popular stocks
            nse_codes = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 
                        'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
                        'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'TITAN']
        
        # Fetch data for each stock from Angel One
        stocks = []
        for nse_code in nse_codes[:100]:  # Limit to 100 stocks to avoid rate limiting
            stock_data = await self.fetch_stock_data(nse_code, api_key, jwt_token)
            if stock_data:
                stocks.append(stock_data)
            
            # Small delay to avoid rate limiting
            await asyncio.sleep(0.05)
        
        # Sort by volume (descending)
        stocks.sort(key=lambda x: x['volume'], reverse=True)
        
        return stocks
    
    def get_stocks(self) -> List[Dict]:
        """Get current stocks (thread-safe)"""
        with self.lock:
            return self.stocks.copy()
    
    def set_stocks(self, stocks: List[Dict]):
        """Set stocks (thread-safe)"""
        with self.lock:
            self.stocks = stocks
            self.last_fetch_time = datetime.now()


# Global strategy instance
_swing_strategy_instance: Optional[SwingStrategy] = None


def get_swing_strategy_instance() -> SwingStrategy:
    """Get or create the global swing strategy instance"""
    global _swing_strategy_instance
    if _swing_strategy_instance is None:
        _swing_strategy_instance = SwingStrategy()
        _swing_strategy_instance.start()
    return _swing_strategy_instance


async def get_swing_stocks(session_angel: Dict, force_refresh: bool = False) -> Dict:
    """
    Get swing strategy stocks
    Fetches from ChartInk (or cache) and filters by criteria
    """
    try:
        strategy = get_swing_strategy_instance()
        
        # Fetch data (will use cache if available and valid)
        stocks = await strategy.analyze_stocks(session_angel, force_refresh)
        strategy.set_stocks(stocks)
        
        # Get cache info
        cache_data = strategy._load_cache()
        cache_time = None
        if cache_data:
            cache_time = cache_data.get('fetch_time')
        
        return {
            'stocks': stocks,
            'analyzedAt': datetime.utcnow().isoformat() + "Z",
            'totalStocks': len(stocks),
            'source': 'ChartInk API - Stocks near 52-week high',
            'filter': 'Daily close > ₹200',
            'cacheTime': cache_time,
            'usingCache': not force_refresh and cache_data is not None
        }
    
    except Exception as e:
        print(f"Error getting swing stocks: {e}")
        return {
            'stocks': [],
            'analyzedAt': datetime.utcnow().isoformat() + "Z",
            'totalStocks': 0,
            'error': str(e)
        }


class SwingStrategyService:
    """Service for swing trading strategy"""
    
    @staticmethod
    async def get_swing_stocks(session_angel: Dict, force_refresh: bool = False) -> Dict:
        """Get swing strategy stocks"""
        return await get_swing_stocks(session_angel, force_refresh)


# Create singleton instance
swing_strategy_service = SwingStrategyService()

# Made with Bob