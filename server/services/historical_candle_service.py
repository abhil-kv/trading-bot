"""
Historical Candle Service
Fetches historical candle data from Angel One API
"""
import httpx
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from config import settings
from utils.angel_headers import build_angel_headers


async def fetch_historical_candles(
    symbol_token: str,
    exchange: str,
    interval: str,
    from_date: str,
    to_date: str,
    api_key: str,
    jwt_token: str
) -> Optional[List[Dict]]:
    """
    Fetch historical candle data from Angel One
    
    Args:
        symbol_token: Token of the instrument
        exchange: Exchange (NSE, BSE, etc.)
        interval: Candle interval (ONE_MINUTE, THREE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, etc.)
        from_date: Start date in format 'YYYY-MM-DD HH:MM'
        to_date: End date in format 'YYYY-MM-DD HH:MM'
        api_key: Angel One API key
        jwt_token: JWT token
        
    Returns:
        List of candle dictionaries with open, high, low, close, volume
    """
    try:
        headers = await build_angel_headers(api_key, jwt_token)
        url = f"{settings.ANGEL_BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData"
        
        payload = {
            "exchange": exchange,
            "symboltoken": symbol_token,
            "interval": interval,
            "fromdate": from_date,
            "todate": to_date
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code != 200:
                print(f"Historical candle API returned status {response.status_code}")
                return None
            
            data = response.json()
            
            if not data or data.get("status") != True:
                print(f"Historical candle API error: {data.get('message', 'Unknown error')}")
                return None
            
            candles_data = data.get("data", [])
            
            # Format candles
            candles = []
            for candle in candles_data:
                if len(candle) >= 5:
                    candles.append({
                        'timestamp': candle[0],
                        'open': float(candle[1]),
                        'high': float(candle[2]),
                        'low': float(candle[3]),
                        'close': float(candle[4]),
                        'volume': int(candle[5]) if len(candle) > 5 else 0
                    })
            
            return candles
            
    except Exception as e:
        print(f"Error fetching historical candles: {e}")
        return None


async def get_first_15min_candle(
    symbol_token: str,
    exchange: str,
    api_key: str,
    jwt_token: str,
    target_date: datetime = None
) -> Optional[Dict]:
    """
    Get the first 15-minute candle (9:15-9:30 AM) for a symbol
    
    Args:
        symbol_token: Token of the instrument
        exchange: Exchange (NSE, BSE, etc.)
        api_key: Angel One API key
        jwt_token: JWT token
        target_date: Date to fetch (defaults to today)
        
    Returns:
        Dictionary with high and low of first 15-min candle
    """
    if target_date is None:
        target_date = datetime.now()
    
    # Format dates for API
    # From 9:15 AM to 9:30 AM
    from_date = target_date.replace(hour=9, minute=15, second=0, microsecond=0)
    to_date = target_date.replace(hour=9, minute=30, second=0, microsecond=0)
    
    from_date_str = from_date.strftime("%Y-%m-%d %H:%M")
    to_date_str = to_date.strftime("%Y-%m-%d %H:%M")
    
    candles = await fetch_historical_candles(
        symbol_token=symbol_token,
        exchange=exchange,
        interval="FIFTEEN_MINUTE",
        from_date=from_date_str,
        to_date=to_date_str,
        api_key=api_key,
        jwt_token=jwt_token
    )
    
    if candles and len(candles) > 0:
        # Return the first candle (should be 9:15-9:30 AM)
        first_candle = candles[0]
        return {
            'high': first_candle['high'],
            'low': first_candle['low'],
            'open': first_candle['open'],
            'close': first_candle['close'],
            'timestamp': first_candle['timestamp']
        }
    
    return None


class HistoricalCandleService:
    """Service for fetching historical candle data"""
    
    @staticmethod
    async def get_first_15min_candle(
        symbol_token: str,
        exchange: str,
        api_key: str,
        jwt_token: str
    ) -> Optional[Dict]:
        """Get first 15-minute candle of the day"""
        return await get_first_15min_candle(symbol_token, exchange, api_key, jwt_token)


# Create singleton instance
historical_candle_service = HistoricalCandleService()

# Made with Bob