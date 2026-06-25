"""
Real-time Strategy Service
Analyzes live market data using separate threads for each strategy
"""
import asyncio
import threading
from typing import Dict, List, Optional
from datetime import datetime, time as dt_time
from collections import defaultdict, deque
import statistics

from services.market_data_service import market_data_service
from data.nifty50 import NIFTY50
from data.nifty100 import NIFTY100
from data.nifty500 import NIFTY500


class CandleBuilder:
    """Builds 5-minute candles from real-time tick data"""
    
    def __init__(self, interval_minutes: int = 5):
        self.interval_minutes = interval_minutes
        self.candles: Dict[str, List[Dict]] = defaultdict(list)  # symbol -> list of candles
        self.current_candle: Dict[str, Dict] = {}  # symbol -> current building candle
        self.last_candle_time: Dict[str, datetime] = {}  # symbol -> last candle timestamp
        
    def add_tick(self, symbol: str, price: float, volume: float, timestamp: datetime = None):
        """Add a tick and build candles"""
        if timestamp is None:
            timestamp = datetime.now()
        
        # Round timestamp to interval
        minute = (timestamp.minute // self.interval_minutes) * self.interval_minutes
        candle_time = timestamp.replace(minute=minute, second=0, microsecond=0)
        
        # Check if we need to start a new candle
        if symbol not in self.last_candle_time or candle_time > self.last_candle_time[symbol]:
            # Close previous candle if exists
            if symbol in self.current_candle:
                self.candles[symbol].append(self.current_candle[symbol])
                # Keep only last 300 candles (25 hours of 5-min data)
                if len(self.candles[symbol]) > 300:
                    self.candles[symbol] = self.candles[symbol][-300:]
            
            # Start new candle
            self.current_candle[symbol] = {
                'timestamp': candle_time,
                'open': price,
                'high': price,
                'low': price,
                'close': price,
                'volume': volume
            }
            self.last_candle_time[symbol] = candle_time
        else:
            # Update current candle
            candle = self.current_candle[symbol]
            candle['high'] = max(candle['high'], price)
            candle['low'] = min(candle['low'], price)
            candle['close'] = price
            candle['volume'] += volume
    
    def get_candles(self, symbol: str, count: int = 200) -> List[Dict]:
        """Get last N candles for a symbol"""
        all_candles = self.candles.get(symbol, [])
        # Include current candle if it exists
        if symbol in self.current_candle:
            all_candles = all_candles + [self.current_candle[symbol]]
        return all_candles[-count:] if len(all_candles) > count else all_candles


class TechnicalIndicators:
    """Calculate technical indicators from candle data"""
    
    @staticmethod
    def calculate_rsi(candles: List[Dict], period: int = 14) -> Optional[float]:
        """Calculate RSI from candles"""
        if len(candles) < period + 1:
            return None
        
        closes = [c['close'] for c in candles]
        deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
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
    def calculate_bollinger_bands(candles: List[Dict], period: int = 20, std_dev: float = 2.0) -> Optional[Dict]:
        """Calculate Bollinger Bands from candles"""
        if len(candles) < period:
            return None
        
        closes = [c['close'] for c in candles[-period:]]
        sma = sum(closes) / period
        variance = sum((p - sma) ** 2 for p in closes) / period
        std = variance ** 0.5
        
        return {
            'middle': sma,
            'upper': sma + (std_dev * std),
            'lower': sma - (std_dev * std)
        }
    
    @staticmethod
    def calculate_ema(candles: List[Dict], period: int = 200) -> Optional[float]:
        """Calculate EMA from candles"""
        if len(candles) < period:
            return None
        
        closes = [c['close'] for c in candles]
        multiplier = 2 / (period + 1)
        ema = sum(closes[:period]) / period
        
        for close in closes[period:]:
            ema = (close - ema) * multiplier + ema
        
        return ema
    
    @staticmethod
    def calculate_avg_volume(candles: List[Dict], period: int = 20) -> Optional[float]:
        """Calculate average volume"""
        if len(candles) < period:
            return None
        
        volumes = [c['volume'] for c in candles[-period:]]
        return sum(volumes) / period


class StrongMeanReversionStrategy:
    """
    Strong Mean Reversion Strategy
    Runs in a separate thread and analyzes real-time data
    """
    
    def __init__(self):
        self.candle_builder = CandleBuilder(interval_minutes=5)
        self.signals: List[Dict] = []
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.lock = threading.Lock()
        self.last_analysis_time = {}
        
    def start(self):
        """Start the strategy thread"""
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()
            print("Strong Mean Reversion Strategy started")
    
    def stop(self):
        """Stop the strategy thread"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        print("Strong Mean Reversion Strategy stopped")
    
    def _run_loop(self):
        """Main strategy loop (runs in separate thread)"""
        while self.running:
            try:
                # Sleep for a bit to avoid excessive CPU usage
                threading.Event().wait(1)
            except Exception as e:
                print(f"Error in strategy loop: {e}")
    
    def update_market_data(self, stocks: List[Dict]):
        """
        Update strategy with latest market data
        Called from main thread when new data arrives
        """
        try:
            current_time = datetime.now()
            
            # Only analyze during market hours (9:15 AM to 3:30 PM IST)
            market_open = dt_time(9, 15)
            market_close = dt_time(15, 30)
            current_time_only = current_time.time()
            
            if not (market_open <= current_time_only <= market_close):
                return
            
            for stock in stocks:
                symbol = stock.get('symbol')
                ltp = stock.get('ltp')
                volume = stock.get('volume', 0)
                
                if not symbol or ltp is None:
                    continue
                
                # Add tick to candle builder
                self.candle_builder.add_tick(symbol, ltp, volume, current_time)
                
                # Analyze every 30 seconds per stock to avoid excessive computation
                last_analysis = self.last_analysis_time.get(symbol, datetime.min)
                if (current_time - last_analysis).total_seconds() < 30:
                    continue
                
                self.last_analysis_time[symbol] = current_time
                
                # Get candles and analyze
                candles = self.candle_builder.get_candles(symbol, 250)
                if len(candles) >= 200:
                    signal = self._analyze_stock(symbol, stock, candles)
                    if signal:
                        self._add_signal(signal)
        
        except Exception as e:
            print(f"Error updating market data: {e}")
    
    def _analyze_stock(self, symbol: str, stock: Dict, candles: List[Dict]) -> Optional[Dict]:
        """Analyze a stock for signals"""
        try:
            # Calculate indicators
            rsi = TechnicalIndicators.calculate_rsi(candles)
            bb = TechnicalIndicators.calculate_bollinger_bands(candles)
            ema200 = TechnicalIndicators.calculate_ema(candles, 200)
            avg_volume = TechnicalIndicators.calculate_avg_volume(candles)
            
            if not all([rsi, bb, ema200, avg_volume]):
                return None
            
            current_price = stock['ltp']
            current_volume = candles[-1]['volume'] if candles else 0
            
            # Get last candle info
            last_candle = candles[-1]
            is_green_candle = last_candle['close'] > last_candle['open']
            is_red_candle = last_candle['close'] < last_candle['open']
            
            # Check volume spike (1.2x average of recent 20 candles)
            volume_spike = current_volume > (avg_volume * 1.2)
            
            # BUY Signal
            if (rsi < 30 and 
                current_price <= bb['lower'] and 
                volume_spike and 
                is_green_candle and 
                current_price > ema200):
                
                # Calculate stop loss (previous swing low)
                recent_lows = [c['low'] for c in candles[-20:]]
                stop_loss = min(recent_lows)
                
                # Calculate target
                risk = current_price - stop_loss
                target = max(bb['middle'], current_price + (risk * 2))
                
                return {
                    'symbol': symbol,
                    'name': stock.get('name', symbol),
                    'type': 'BUY',
                    'ltp': current_price,
                    'entryPrice': current_price,
                    'stopLoss': stop_loss,
                    'target': target,
                    'riskReward': (target - current_price) / risk if risk > 0 else 0,
                    'signalTime': datetime.now().strftime("%H:%M:%S"),
                    'status': 'ACTIVE',
                    'rsi': rsi,
                    'bb_lower': bb['lower'],
                    'bb_middle': bb['middle'],
                    'bb_upper': bb['upper'],
                }
            
            # SELL Signal
            elif (rsi > 70 and 
                  current_price >= bb['upper'] and 
                  volume_spike and 
                  is_red_candle and 
                  current_price < ema200):
                
                # Calculate stop loss (previous swing high)
                recent_highs = [c['high'] for c in candles[-20:]]
                stop_loss = max(recent_highs)
                
                # Calculate target
                risk = stop_loss - current_price
                target = min(bb['middle'], current_price - (risk * 2))
                
                return {
                    'symbol': symbol,
                    'name': stock.get('name', symbol),
                    'type': 'SELL',
                    'ltp': current_price,
                    'entryPrice': current_price,
                    'stopLoss': stop_loss,
                    'target': target,
                    'riskReward': (current_price - target) / risk if risk > 0 else 0,
                    'signalTime': datetime.now().strftime("%H:%M:%S"),
                    'status': 'ACTIVE',
                    'rsi': rsi,
                    'bb_lower': bb['lower'],
                    'bb_middle': bb['middle'],
                    'bb_upper': bb['upper'],
                }
            
            return None
        
        except Exception as e:
            print(f"Error analyzing {symbol}: {e}")
            return None
    
    def _add_signal(self, signal: Dict):
        """Add a new signal (thread-safe)"""
        with self.lock:
            # Check if signal already exists for this symbol
            existing = [s for s in self.signals if s['symbol'] == signal['symbol']]
            if not existing:
                self.signals.append(signal)
                print(f"New {signal['type']} signal for {signal['symbol']} at {signal['entryPrice']}")
    
    def get_signals(self) -> List[Dict]:
        """Get current signals (thread-safe)"""
        with self.lock:
            return self.signals.copy()
    
    def clear_signals(self):
        """Clear all signals"""
        with self.lock:
            self.signals.clear()


# Global strategy instance
_strategy_instance: Optional[StrongMeanReversionStrategy] = None


def get_strategy_instance() -> StrongMeanReversionStrategy:
    """Get or create the global strategy instance"""
    global _strategy_instance
    if _strategy_instance is None:
        _strategy_instance = StrongMeanReversionStrategy()
        _strategy_instance.start()
    return _strategy_instance


def get_stock_list_by_index(index: str) -> List[Dict]:
    """Get stock list based on index name"""
    index_map = {
        'nifty50': NIFTY50,
        'nifty100': NIFTY100,
        'nifty500': NIFTY500
    }
    return index_map.get(index.lower(), NIFTY50)


async def get_realtime_signals(session_angel: Dict, index: str = "nifty500") -> Dict:
    """
    Get real-time strategy signals
    This fetches current market data and updates the strategy
    
    Args:
        session_angel: Session data with credentials
        index: Index to analyze (nifty50, nifty100, nifty500)
    """
    try:
        # Get stock list for the selected index
        stock_list = get_stock_list_by_index(index)
        
        # Get current market data based on index
        if index.lower() == 'nifty100':
            market_data = await market_data_service.get_nifty100_quotes(session_angel)
        elif index.lower() == 'nifty500':
            market_data = await market_data_service.get_nifty500_quotes(session_angel)
        else:
            market_data = await market_data_service.get_nifty50_quotes(session_angel)
        
        stocks = market_data.get('stocks', [])
        
        # Get strategy instance and update with latest data
        strategy = get_strategy_instance()
        strategy.update_market_data(stocks)
        
        # Get current signals
        signals = strategy.get_signals()
        
        return {
            'signals': signals,
            'analyzedAt': datetime.utcnow().isoformat() + "Z",
            'totalStocks': len(stock_list),
            'signalsFound': len(signals),
            'mode': 'real-time',
            'index': index,
            'note': f'Analyzing live market data with 5-minute candles for {index.upper()}'
        }
    
    except Exception as e:
        print(f"Error getting realtime signals: {e}")
        stock_list = get_stock_list_by_index(index)
        return {
            'signals': [],
            'analyzedAt': datetime.utcnow().isoformat() + "Z",
            'totalStocks': len(stock_list),
            'signalsFound': 0,
            'index': index,
            'error': str(e)
        }


class RealtimeStrategyService:
    """Service for real-time trading strategies"""
    
    @staticmethod
    async def get_strong_mean_reversion_signals(session_angel: Dict, index: str = "nifty500") -> Dict:
        """Get Strong Mean Reversion strategy signals from real-time data"""
        return await get_realtime_signals(session_angel, index)


# Create singleton instance
realtime_strategy_service = RealtimeStrategyService()

# Made with Bob