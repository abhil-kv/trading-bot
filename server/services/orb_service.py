"""
Opening Range Breakout (ORB) Service
Tracks the first 15-minute candle (9:15-9:30 AM) and detects breakouts
"""
from typing import Dict, Optional
from datetime import datetime, time as dt_time
import threading
import asyncio


class ORBTracker:
    """
    Tracks Opening Range Breakout for stocks
    - Captures 9:15-9:30 AM 15-minute candle (high/low)
    - Detects when subsequent 15-min candles break the range
    """
    
    def __init__(self):
        self.lock = threading.Lock()
        # Store opening range data: {symbol: {high, low, open, close, captured_at}}
        self.opening_ranges: Dict[str, Dict] = {}
        # Store breakout signals: {symbol: {signal, breakout_time, breakout_price}}
        self.breakout_signals: Dict[str, Dict] = {}
        # Track first 15-min candle building: {symbol: {open, high, low, close, start_time}}
        self.first_candle_building: Dict[str, Dict] = {}
        
    def reset_daily_data(self):
        """Reset data at start of new trading day"""
        with self.lock:
            self.opening_ranges.clear()
            self.breakout_signals.clear()
            self.first_candle_building.clear()
            print("ORB: Daily data reset")
    
    def update_stock_data(self, symbol: str, stock_data: Dict, current_time: datetime = None):
        """
        Update stock data and build first 15-minute candle (9:15-9:30 AM)
        
        Args:
            symbol: Stock symbol
            stock_data: Stock quote data with ltp
            current_time: Current time (defaults to now)
        """
        if current_time is None:
            current_time = datetime.now()
        
        current_time_only = current_time.time()
        
        # Market hours: 9:15 AM to 3:30 PM
        market_open = dt_time(9, 15)
        market_close = dt_time(15, 30)
        opening_range_end = dt_time(9, 30)
        
        if not (market_open <= current_time_only <= market_close):
            return
        
        ltp = stock_data.get('ltp')
        if ltp is None:
            return
        
        with self.lock:
            # Build first 15-minute candle (9:15-9:30 AM)
            if market_open <= current_time_only <= opening_range_end:
                if symbol not in self.first_candle_building:
                    # Start building first candle
                    self.first_candle_building[symbol] = {
                        'open': ltp,
                        'high': ltp,
                        'low': ltp,
                        'close': ltp,
                        'start_time': current_time.isoformat()
                    }
                    print(f"ORB: Started building first candle for {symbol} at {ltp}")
                else:
                    # Update the building candle
                    candle = self.first_candle_building[symbol]
                    candle['high'] = max(candle['high'], ltp)
                    candle['low'] = min(candle['low'], ltp)
                    candle['close'] = ltp
            
            # At 9:30 AM or just after, finalize the first candle as opening range
            elif current_time_only > opening_range_end and symbol not in self.opening_ranges:
                if symbol in self.first_candle_building:
                    # Finalize the first 15-min candle as opening range
                    candle = self.first_candle_building[symbol]
                    self.opening_ranges[symbol] = {
                        'high': candle['high'],
                        'low': candle['low'],
                        'open': candle['open'],
                        'close': candle['close'],
                        'captured_at': current_time.isoformat()
                    }
                    print(f"ORB: Finalized {symbol} - High: {candle['high']}, Low: {candle['low']}")
                    # Remove from building dict
                    del self.first_candle_building[symbol]
            
            # After 9:30 AM, check for breakouts
            if current_time_only > opening_range_end:
                if symbol in self.opening_ranges and symbol not in self.breakout_signals:
                    orb = self.opening_ranges[symbol]
                    
                    # Check for breakout
                    # Upper breakout: LTP crosses above opening range high
                    if ltp > orb['high']:
                        self.breakout_signals[symbol] = {
                            'signal': 'BUY',
                            'breakout_time': current_time.strftime("%H:%M:%S"),
                            'breakout_price': ltp,
                            'orb_high': orb['high'],
                            'orb_low': orb['low']
                        }
                        print(f"ORB: {symbol} BUY signal at {ltp} (broke above {orb['high']})")
                    
                    # Lower breakout: LTP crosses below opening range low
                    elif ltp < orb['low']:
                        self.breakout_signals[symbol] = {
                            'signal': 'SELL',
                            'breakout_time': current_time.strftime("%H:%M:%S"),
                            'breakout_price': ltp,
                            'orb_high': orb['high'],
                            'orb_low': orb['low']
                        }
                        print(f"ORB: {symbol} SELL signal at {ltp} (broke below {orb['low']})")
            
            # DEMO/TESTING MODE: If no opening range exists yet, simulate using current data
            # This allows testing outside market hours or before first candle is built
            if symbol not in self.opening_ranges and symbol not in self.first_candle_building:
                open_price = stock_data.get('open')
                day_high = stock_data.get('dayHigh')
                day_low = stock_data.get('dayLow')
                
                # Use open price +/- 1% as simulated first 15-min range
                if open_price is not None and open_price > 0:
                    simulated_high = open_price * 1.01  # 1% above open
                    simulated_low = open_price * 0.99   # 1% below open
                    
                    self.opening_ranges[symbol] = {
                        'high': simulated_high,
                        'low': simulated_low,
                        'open': open_price,
                        'close': ltp,
                        'captured_at': current_time.isoformat(),
                        'simulated': True  # Mark as simulated for demo
                    }
                    print(f"ORB: Demo mode - Simulated first 15-min for {symbol}: High={simulated_high:.2f}, Low={simulated_low:.2f}")
    
    def get_orb_data(self, symbol: str) -> Optional[Dict]:
        """
        Get ORB data for a symbol
        
        Returns:
            Dictionary with orb_high, orb_low, signal, breakout_time, breakout_price
            or None if no data available
        """
        with self.lock:
            if symbol not in self.opening_ranges:
                return None
            
            orb = self.opening_ranges[symbol]
            result = {
                'orb_high': orb['high'],
                'orb_low': orb['low'],
                'orb_open': orb.get('open'),
                'signal': None,
                'breakout_time': None,
                'breakout_price': None
            }
            
            # Add breakout signal if exists
            if symbol in self.breakout_signals:
                signal = self.breakout_signals[symbol]
                result['signal'] = signal['signal']
                result['breakout_time'] = signal['breakout_time']
                result['breakout_price'] = signal['breakout_price']
            
            return result
    
    def get_all_orb_data(self) -> Dict[str, Dict]:
        """Get ORB data for all tracked symbols"""
        with self.lock:
            result = {}
            for symbol in self.opening_ranges.keys():
                result[symbol] = self.get_orb_data(symbol)
            return result


# Global ORB tracker instance
_orb_tracker_instance: Optional[ORBTracker] = None


def get_orb_tracker() -> ORBTracker:
    """Get or create the global ORB tracker instance"""
    global _orb_tracker_instance
    if _orb_tracker_instance is None:
        _orb_tracker_instance = ORBTracker()
    return _orb_tracker_instance


class ORBService:
    """Service for Opening Range Breakout tracking"""
    
    @staticmethod
    def get_tracker() -> ORBTracker:
        """Get the ORB tracker instance"""
        return get_orb_tracker()
    
    @staticmethod
    def update_stock(symbol: str, stock_data: Dict):
        """Update stock data for ORB tracking"""
        tracker = get_orb_tracker()
        tracker.update_stock_data(symbol, stock_data)
    
    @staticmethod
    def get_orb_data(symbol: str) -> Optional[Dict]:
        """Get ORB data for a symbol"""
        tracker = get_orb_tracker()
        return tracker.get_orb_data(symbol)
    
    @staticmethod
    def get_all_orb_data() -> Dict[str, Dict]:
        """Get ORB data for all symbols"""
        tracker = get_orb_tracker()
        return tracker.get_all_orb_data()
    
    @staticmethod
    def reset_daily():
        """Reset ORB data for new trading day"""
    
    @staticmethod
    async def fetch_and_set_historical_orb(symbol: str, symbol_token: str, exchange: str, api_key: str, jwt_token: str):
        """Fetch historical first 15-min candle and set as ORB"""
        from services.historical_candle_service import historical_candle_service
        
        candle_data = await historical_candle_service.get_first_15min_candle(
            symbol_token=symbol_token,
            exchange=exchange,
            api_key=api_key,
            jwt_token=jwt_token
        )
        
        if candle_data:
            tracker = get_orb_tracker()
            with tracker.lock:
                tracker.opening_ranges[symbol] = {
                    'high': candle_data['high'],
                    'low': candle_data['low'],
                    'open': candle_data['open'],
                    'close': candle_data['close'],
                    'captured_at': datetime.now().isoformat(),
                    'from_historical': True
                }
                print(f"ORB: Set historical first 15-min for {symbol}: High={candle_data['high']}, Low={candle_data['low']}")
                return True
        return False
        tracker = get_orb_tracker()
        tracker.reset_daily_data()


# Create singleton instance
orb_service = ORBService()

# Made with Bob