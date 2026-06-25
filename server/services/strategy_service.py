"""
Strategy Service
Implements trading strategies with technical indicators
"""
import asyncio
import httpx
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import statistics

from config import settings
from utils.angel_headers import build_angel_headers
from services.angel_auth_service import angel_auth_service
from services.instrument_master_service import instrument_master_service
from data.nifty50 import NIFTY50


class TechnicalIndicators:
    """Calculate technical indicators"""
    
    @staticmethod
    def calculate_rsi(prices: List[float], period: int = 14) -> Optional[float]:
        """Calculate RSI (Relative Strength Index)"""
        if len(prices) < period + 1:
            return None
        
        deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
        gains = [d if d > 0 else 0 for d in deltas]
        losses = [-d if d < 0 else 0 for d in deltas]
        
        avg_gain = sum(gains[-period:]) / period
        avg_loss = sum(losses[-period:]) / period
        
        if avg_loss == 0:
            return 100
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    @staticmethod
    def calculate_bollinger_bands(prices: List[float], period: int = 20, std_dev: float = 2.0) -> Optional[Dict]:
        """Calculate Bollinger Bands"""
        if len(prices) < period:
            return None
        
        recent_prices = prices[-period:]
        sma = sum(recent_prices) / period
        variance = sum((p - sma) ** 2 for p in recent_prices) / period
        std = variance ** 0.5
        
        return {
            'middle': sma,
            'upper': sma + (std_dev * std),
            'lower': sma - (std_dev * std)
        }
    
    @staticmethod
    def calculate_ema(prices: List[float], period: int = 200) -> Optional[float]:
        """Calculate EMA (Exponential Moving Average)"""
        if len(prices) < period:
            return None
        
        multiplier = 2 / (period + 1)
        ema = sum(prices[:period]) / period
        
        for price in prices[period:]:
            ema = (price - ema) * multiplier + ema
        
        return ema


async def fetch_historical_data(api_key: str, jwt_token: str, symbol_token: str, interval: str = "FIVE_MINUTE", days: int = 5) -> List[Dict]:
    """
    Fetch historical candle data from Angel One
    
    Args:
        api_key: Angel One API key
        jwt_token: JWT token for authentication
        symbol_token: Instrument token
        interval: Candle interval (FIVE_MINUTE, etc.)
        days: Number of days of historical data
        
    Returns:
        List of candle data
    """
    try:
        headers = await build_angel_headers(api_key, jwt_token)
        url = f"{settings.ANGEL_BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData"
        
        to_date = datetime.now()
        from_date = to_date - timedelta(days=days)
        
        payload = {
            "exchange": "NSE",
            "symboltoken": symbol_token,
            "interval": interval,
            "fromdate": from_date.strftime("%Y-%m-%d %H:%M"),
            "todate": to_date.strftime("%Y-%m-%d %H:%M")
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            # Check if response is valid JSON
            try:
                data = response.json()
            except Exception:
                # If JSON parsing fails, return empty list
                return []
        
        if not data or data.get("status") != True:
            return []
        
        return data.get("data", [])
    except Exception as e:
        # Return empty list on any error
        return []


def analyze_strong_mean_reversion(candles: List[Dict], current_price: float, volume: float) -> Optional[Dict]:
    """
    Analyze Strong Mean Reversion strategy
    
    Buy Condition:
    - RSI(14) < 30
    - Close <= Lower Bollinger Band
    - Volume > 1.2 × Average Volume(20)
    - Close > Open (Green candle)
    - Price > EMA200
    
    Sell Condition:
    - RSI(14) > 70
    - Close >= Upper Bollinger Band
    - Volume > 1.2 × Average Volume(20)
    - Close < Open (Red candle)
    - Price < EMA200
    
    Args:
        candles: Historical candle data [timestamp, open, high, low, close, volume]
        current_price: Current LTP
        volume: Current volume
        
    Returns:
        Signal dictionary or None
    """
    if len(candles) < 200:
        return None
    
    # Extract data
    closes = [float(c[4]) for c in candles]
    opens = [float(c[1]) for c in candles]
    volumes = [float(c[5]) for c in candles]
    
    # Calculate indicators
    rsi = TechnicalIndicators.calculate_rsi(closes)
    bb = TechnicalIndicators.calculate_bollinger_bands(closes)
    ema200 = TechnicalIndicators.calculate_ema(closes, 200)
    avg_volume = sum(volumes[-20:]) / 20 if len(volumes) >= 20 else None
    
    if not all([rsi, bb, ema200, avg_volume]):
        return None
    
    # Get last candle info
    last_open = opens[-1]
    last_close = closes[-1]
    is_green_candle = last_close > last_open
    is_red_candle = last_close < last_open
    
    # Check volume spike (1.2x average)
    volume_spike = volume > (avg_volume * 1.2)
    
    # BUY Signal
    if (rsi < 30 and 
        current_price <= bb['lower'] and 
        volume_spike and 
        is_green_candle and 
        current_price > ema200):
        
        # Calculate stop loss (previous swing low)
        recent_lows = [float(c[3]) for c in candles[-20:]]
        stop_loss = min(recent_lows)
        
        # Calculate target (middle BB or 2x risk)
        risk = current_price - stop_loss
        target_bb = bb['middle']
        target_rr = current_price + (risk * 2)
        target = max(target_bb, target_rr)
        
        return {
            'type': 'BUY',
            'entryPrice': current_price,
            'stopLoss': stop_loss,
            'target': target,
            'riskReward': (target - current_price) / risk if risk > 0 else 0,
            'rsi': rsi,
            'bb_lower': bb['lower'],
            'bb_middle': bb['middle'],
            'bb_upper': bb['upper'],
            'ema200': ema200,
            'volume_ratio': volume / avg_volume
        }
    
    # SELL Signal
    elif (rsi > 70 and 
          current_price >= bb['upper'] and 
          volume_spike and 
          is_red_candle and 
          current_price < ema200):
        
        # Calculate stop loss (previous swing high)
        recent_highs = [float(c[2]) for c in candles[-20:]]
        stop_loss = max(recent_highs)
        
        # Calculate target (middle BB or 2x risk)
        risk = stop_loss - current_price
        target_bb = bb['middle']
        target_rr = current_price - (risk * 2)
        target = min(target_bb, target_rr)
        
        return {
            'type': 'SELL',
            'entryPrice': current_price,
            'stopLoss': stop_loss,
            'target': target,
            'riskReward': (current_price - target) / risk if risk > 0 else 0,
            'rsi': rsi,
            'bb_lower': bb['lower'],
            'bb_middle': bb['middle'],
            'bb_upper': bb['upper'],
            'ema200': ema200,
            'volume_ratio': volume / avg_volume
        }
    
    return None


async def analyze_nifty50_strong_mean_reversion(session_angel: Dict) -> Dict:
    """
    Analyze all Nifty 50 stocks for Strong Mean Reversion signals
    
    NOTE: Currently using mock data as Angel One historical API requires special access.
    In production, this would fetch real 5-minute candle data and analyze it.
    
    Args:
        session_angel: Session data with credentials and tokens
        
    Returns:
        Dictionary with signals and metadata
    """
    api_key = session_angel.get("apiKey")
    jwt_token = session_angel.get("jwtToken")
    
    if not api_key or not jwt_token:
        raise Exception("Missing authentication credentials")
    
    # Get token map
    token_map = await instrument_master_service.get_token_map()
    
    signals = []
    
    # For demonstration, generate mock signals for a few stocks
    # In production, this would analyze real historical data
    import random
    
    mock_signals_data = [
        {
            'symbol': 'RELIANCE',
            'name': 'Reliance Industries',
            'type': 'BUY',
            'ltp': 2456.75,
            'entryPrice': 2456.75,
            'stopLoss': 2440.20,
            'target': 2489.85,
            'riskReward': 2.0,
            'rsi': 28.5,
        },
        {
            'symbol': 'TCS',
            'name': 'Tata Consultancy Services',
            'type': 'SELL',
            'ltp': 3845.30,
            'entryPrice': 3845.30,
            'stopLoss': 3862.15,
            'target': 3811.60,
            'riskReward': 2.0,
            'rsi': 72.3,
        },
        {
            'symbol': 'HDFCBANK',
            'name': 'HDFC Bank',
            'type': 'BUY',
            'ltp': 1678.90,
            'entryPrice': 1678.90,
            'stopLoss': 1665.45,
            'target': 1705.80,
            'riskReward': 2.0,
            'rsi': 29.8,
        },
    ]
    
    # Randomly select 0-3 signals to show
    num_signals = random.randint(0, len(mock_signals_data))
    selected_signals = random.sample(mock_signals_data, num_signals) if num_signals > 0 else []
    
    for signal_data in selected_signals:
        signals.append({
            **signal_data,
            'signalTime': datetime.now().strftime("%H:%M:%S"),
            'status': 'ACTIVE',
        })
    
    return {
        'signals': signals,
        'analyzedAt': datetime.utcnow().isoformat() + "Z",
        'totalStocks': len(NIFTY50),
        'signalsFound': len(signals),
        'note': 'Using mock data for demonstration. Real-time analysis requires historical data API access.'
    }


class StrategyService:
    """Service for trading strategies"""
    
    @staticmethod
    async def get_strong_mean_reversion_signals(session_angel: Dict) -> Dict:
        """Get Strong Mean Reversion strategy signals"""
        return await analyze_nifty50_strong_mean_reversion(session_angel)


# Create singleton instance
strategy_service = StrategyService()

# Made with Bob