"""
Opening Range Breakout (ORB) Service
Tracks the first 15-minute candle (9:15-9:30 AM) and detects breakouts
"""
from typing import Dict, Optional
from datetime import datetime, time as dt_time
import threading


class ORBTracker:
    """
    Tracks Opening Range Breakout for stocks
    - Captures 9:15-9:30 AM 15-minute candle (high/low)
    - Detects when subsequent 15-min candles break the range
    """
    
    def __init__(self):
        self.lock = threading.Lock()
        # Store opening range data: {symbol: {high, low, captured_at}}
        self.opening_ranges: Dict[str, Dict] = {}
        # Store breakout signals: {symbol: {signal, breakout_time, breakout_price}}
        self.breakout_signals: Dict[str, Dict] = {}
        # Track current 15-min candle data for breakout detection
        self.current_candles: Dict[str, Dict] = {}
        
    def reset_daily_data(self):
        """Reset data at start of new trading day"""
        with self.lock:
            self.opening_ranges.clear()
            self.breakout_signals.clear()
            self.current_candles.clear()
            print("ORB: Daily data reset")
    
    def update_stock_data(self, symbol: str, stock_data: Dict, current_time: datetime = None):
        """
        Update stock data and check for opening range capture and breakouts
        
        Args:
            symbol: Stock symbol
            stock_data: Stock quote data with open, high, low, close
            current_time: Current time (defaults to now)
        """
        if current_time is None:
            current_time = datetime.now()
        
        current_time_only = current_time.time()
        
        # Market hours: 9:15 AM to 3:30 PM
        market_open = dt_time(9, 15)
        market_close = dt_time(15, 30)
        
        if not (market_open <= current_time_only <= market_close):
            return
        
        with self.lock:
            # Capture opening range (9:15-9:30 AM)
            opening_range_end = dt_time(9, 30)
            
            if market_open <= current_time_only <= opening_range_end:
                # We're in the opening range period
                ltp = stock_data.get('ltp')
                day_high = stock_data.get('dayHigh')
                day_low = stock_data.get('dayLow')
                open_price = stock_data.get('open')
                
                if symbol not in self.opening_ranges:
                    # Initialize opening range tracking
                    # Use available data, prioritizing actual values
                    high_val = day_high if day_high is not None else ltp
                    low_val = day_low if day_low is not None else ltp
                    open_val = open_price if open_price is not None else ltp
                    
                    if high_val is not None and low_val is not None:
                        self.opening_ranges[symbol] = {
                            'high': high_val,
                            'low': low_val,
                            'open': open_val,
                            'captured_at': current_time.isoformat()
                        }
                        print(f"ORB: Initialized {symbol} - High: {high_val}, Low: {low_val}")
                else:
                    # Update opening range with latest high/low
                    if day_high is not None:
                        self.opening_ranges[symbol]['high'] = max(
                            self.opening_ranges[symbol]['high'],
                            day_high
                        )
                    if day_low is not None:
                        self.opening_ranges[symbol]['low'] = min(
                            self.opening_ranges[symbol]['low'],
                            day_low
                        )
            
            # For testing/demo: If outside market hours, use current day's high/low as opening range
            elif symbol not in self.opening_ranges:
                # Initialize with current day's data for demo purposes
                day_high = stock_data.get('dayHigh')
                day_low = stock_data.get('dayLow')
                open_price = stock_data.get('open')
                ltp = stock_data.get('ltp')
                
                if day_high is not None and day_low is not None:
                    self.opening_ranges[symbol] = {
                        'high': day_high,
                        'low': day_low,
                        'open': open_price if open_price is not None else ltp,
                        'captured_at': current_time.isoformat()
                    }
                    print(f"ORB: Demo mode - Initialized {symbol} with day's high/low")
            
            # After 9:30 AM, check for breakouts
            elif current_time_only > opening_range_end:
                if symbol in self.opening_ranges and symbol not in self.breakout_signals:
                    orb = self.opening_ranges[symbol]
                    ltp = stock_data.get('ltp')
                    
                    if ltp is None:
                        return
                    
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
        tracker = get_orb_tracker()
        tracker.reset_daily_data()


# Create singleton instance
orb_service = ORBService()

# Made with Bob