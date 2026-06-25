"""
Database Service
Handles all database operations for trading strategies
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, List, Optional
from datetime import datetime
import os
from contextlib import contextmanager


class DatabaseService:
    """Service for database operations"""
    
    def __init__(self):
        self.connection_params = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'trading_bot'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', '')
        }
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = None
        try:
            conn = psycopg2.connect(**self.connection_params)
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()
    
    # ============================================
    # MEAN REVERSION SIGNALS
    # ============================================
    
    def insert_mean_reversion_signal(self, signal: Dict) -> str:
        """
        Insert a new mean reversion signal
        
        Args:
            signal: Dictionary with signal data
            
        Returns:
            Signal ID (UUID)
        """
        with self.get_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                INSERT INTO mean_reversion_signals 
                (symbol, name, signal_type, entry_price, entry_time, 
                 rsi, bb_upper, bb_middle, bb_lower, ema_value, ema_period,
                 volume_ratio, stop_loss, target, risk_amount, reward_amount,
                 risk_reward_ratio, status, index_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                signal.get('symbol'),
                signal.get('name'),
                signal.get('type'),
                signal.get('entryPrice'),
                signal.get('signalTime', datetime.now()),
                signal.get('rsi'),
                signal.get('bb_upper'),
                signal.get('bb_middle'),
                signal.get('bb_lower'),
                signal.get('ema'),
                signal.get('ema_period', 200),
                signal.get('volume_ratio'),
                signal.get('stopLoss'),
                signal.get('target'),
                signal.get('entryPrice', 0) - signal.get('stopLoss', 0) if signal.get('type') == 'BUY' 
                    else signal.get('stopLoss', 0) - signal.get('entryPrice', 0),
                signal.get('target', 0) - signal.get('entryPrice', 0) if signal.get('type') == 'BUY'
                    else signal.get('entryPrice', 0) - signal.get('target', 0),
                signal.get('riskReward'),
                'ACTIVE',
                signal.get('index', 'nifty500')
            ))
            
            signal_id = cur.fetchone()[0]
            cur.close()
            return str(signal_id)
    
    def update_mean_reversion_exit(self, signal_id: str, exit_data: Dict) -> bool:
        """
        Update mean reversion signal with exit data
        
        Args:
            signal_id: Signal UUID
            exit_data: Dictionary with exit information
            
        Returns:
            True if successful
        """
        with self.get_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                UPDATE mean_reversion_signals
                SET exit_price = %s,
                    exit_time = %s,
                    exit_reason = %s,
                    profit_loss = %s,
                    profit_loss_percent = %s,
                    status = 'CLOSED'
                WHERE id = %s
            """, (
                exit_data.get('exit_price'),
                exit_data.get('exit_time', datetime.now()),
                exit_data.get('exit_reason'),
                exit_data.get('profit_loss'),
                exit_data.get('profit_loss_percent'),
                signal_id
            ))
            
            cur.close()
            return True
    
    def get_active_mean_reversion_signals(self) -> List[Dict]:
        """Get all active mean reversion signals"""
        with self.get_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute("""
                SELECT * FROM v_active_mean_reversion
                ORDER BY entry_time DESC
            """)
            
            signals = cur.fetchall()
            cur.close()
            return [dict(signal) for signal in signals]
    
    # ============================================
    # SWING SIGNALS
    # ============================================
    
    def insert_swing_signal(self, signal: Dict) -> str:
        """Insert a new swing trading signal"""
        with self.get_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                INSERT INTO swing_signals 
                (symbol, name, entry_price, entry_date, entry_time,
                 week_52_high, week_52_low, volume, avg_volume_20, volume_ratio,
                 stop_loss, stop_loss_type, target_1, target_2, target_3,
                 status, source, sector, market_cap)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                signal.get('symbol'),
                signal.get('name'),
                signal.get('ltp'),
                datetime.now().date(),
                datetime.now(),
                signal.get('high_52w'),
                signal.get('low_52w'),
                signal.get('volume'),
                signal.get('volume') / 1.2 if signal.get('volume') else None,  # Estimate avg volume
                1.2,  # Assuming volume spike
                signal.get('ltp', 0) * 0.95,  # 5% stop loss
                'PERCENTAGE',
                signal.get('ltp', 0) * 1.05,  # 5% target
                signal.get('ltp', 0) * 1.10,  # 10% target
                signal.get('ltp', 0) * 1.15,  # 15% target
                'ACTIVE',
                'CHARTINK',
                None,
                None
            ))
            
            signal_id = cur.fetchone()[0]
            cur.close()
            return str(signal_id)
    
    def update_swing_exit(self, signal_id: str, exit_data: Dict) -> bool:
        """Update swing signal with exit data"""
        with self.get_connection() as conn:
            cur = conn.cursor()
            
            holding_days = (exit_data.get('exit_date', datetime.now().date()) - 
                          exit_data.get('entry_date', datetime.now().date())).days
            
            cur.execute("""
                UPDATE swing_signals
                SET exit_price = %s,
                    exit_date = %s,
                    exit_time = %s,
                    exit_reason = %s,
                    holding_days = %s,
                    profit_loss = %s,
                    profit_loss_percent = %s,
                    status = 'CLOSED'
                WHERE id = %s
            """, (
                exit_data.get('exit_price'),
                exit_data.get('exit_date', datetime.now().date()),
                exit_data.get('exit_time', datetime.now()),
                exit_data.get('exit_reason'),
                holding_days,
                exit_data.get('profit_loss'),
                exit_data.get('profit_loss_percent'),
                signal_id
            ))
            
            cur.close()
            return True
    
    def get_active_swing_signals(self) -> List[Dict]:
        """Get all active swing signals"""
        with self.get_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute("""
                SELECT * FROM v_active_swing
                ORDER BY entry_date DESC
            """)
            
            signals = cur.fetchall()
            cur.close()
            return [dict(signal) for signal in signals]
    
    # ============================================
    # ORB SIGNALS
    # ============================================
    
    def insert_orb_signal(self, signal: Dict) -> str:
        """Insert a new ORB signal"""
        with self.get_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                INSERT INTO orb_signals 
                (symbol, name, trade_date, orb_high, orb_low, orb_open, orb_close,
                 orb_range, orb_range_percent, breakout_type, breakout_time, breakout_price,
                 entry_price, entry_time, stop_loss, target, risk_amount, reward_amount,
                 risk_reward_ratio, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                signal.get('symbol'),
                signal.get('name'),
                datetime.now().date(),
                signal.get('orb_high'),
                signal.get('orb_low'),
                signal.get('orb_open'),
                signal.get('orb_close'),
                signal.get('orb_high', 0) - signal.get('orb_low', 0),
                ((signal.get('orb_high', 0) - signal.get('orb_low', 0)) / signal.get('orb_open', 1)) * 100,
                'BULLISH' if signal.get('signal') == 'BUY' else 'BEARISH',
                signal.get('breakout_time', datetime.now()),
                signal.get('breakout_price'),
                signal.get('breakout_price'),
                datetime.now(),
                signal.get('orb_low') if signal.get('signal') == 'BUY' else signal.get('orb_high'),
                signal.get('breakout_price', 0) + (signal.get('orb_high', 0) - signal.get('orb_low', 0)) * 2 
                    if signal.get('signal') == 'BUY'
                    else signal.get('breakout_price', 0) - (signal.get('orb_high', 0) - signal.get('orb_low', 0)) * 2,
                abs(signal.get('breakout_price', 0) - (signal.get('orb_low') if signal.get('signal') == 'BUY' else signal.get('orb_high'))),
                abs((signal.get('orb_high', 0) - signal.get('orb_low', 0)) * 2),
                2.0,
                'ACTIVE'
            ))
            
            signal_id = cur.fetchone()[0]
            cur.close()
            return str(signal_id)
    
    def update_orb_exit(self, signal_id: str, exit_data: Dict) -> bool:
        """Update ORB signal with exit data"""
        with self.get_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                UPDATE orb_signals
                SET exit_price = %s,
                    exit_time = %s,
                    exit_reason = %s,
                    profit_loss = %s,
                    profit_loss_percent = %s,
                    status = 'CLOSED'
                WHERE id = %s
            """, (
                exit_data.get('exit_price'),
                exit_data.get('exit_time', datetime.now()),
                exit_data.get('exit_reason'),
                exit_data.get('profit_loss'),
                exit_data.get('profit_loss_percent'),
                signal_id
            ))
            
            cur.close()
            return True
    
    def get_active_orb_signals(self) -> List[Dict]:
        """Get all active ORB signals"""
        with self.get_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute("""
                SELECT * FROM v_active_orb
                ORDER BY trade_date DESC, entry_time DESC
            """)
            
            signals = cur.fetchall()
            cur.close()
            return [dict(signal) for signal in signals]
    
    # ============================================
    # CANDLE DATA
    # ============================================
    
    def insert_candle(self, candle: Dict) -> bool:
        """Insert a 5-minute candle"""
        with self.get_connection() as conn:
            cur = conn.cursor()
            
            try:
                cur.execute("""
                    INSERT INTO candles 
                    (symbol, exchange, timestamp, open, high, low, close, volume, interval)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (symbol, timestamp, interval) DO NOTHING
                """, (
                    candle.get('symbol'),
                    candle.get('exchange', 'NSE'),
                    candle.get('timestamp'),
                    candle.get('open'),
                    candle.get('high'),
                    candle.get('low'),
                    candle.get('close'),
                    candle.get('volume'),
                    candle.get('interval', '5min')
                ))
                cur.close()
                return True
            except Exception as e:
                print(f"Error inserting candle: {e}")
                return False
    
    def get_candles(self, symbol: str, limit: int = 200) -> List[Dict]:
        """Get recent candles for a symbol"""
        with self.get_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            cur.execute("""
                SELECT * FROM candles
                WHERE symbol = %s
                ORDER BY timestamp DESC
                LIMIT %s
            """, (symbol, limit))
            
            candles = cur.fetchall()
            cur.close()
            return [dict(candle) for candle in candles]
    
    # ============================================
    # PERFORMANCE TRACKING
    # ============================================
    
    def update_daily_performance(self, strategy_name: str, date: datetime.date = None) -> bool:
        """Calculate and update daily performance for a strategy"""
        if date is None:
            date = datetime.now().date()
        
        with self.get_connection() as conn:
            cur = conn.cursor()
            
            # Get table name based on strategy
            table_map = {
                'mean_reversion': 'mean_reversion_signals',
                'swing': 'swing_signals',
                'orb': 'orb_signals'
            }
            
            table = table_map.get(strategy_name.lower())
            if not table:
                return False
            
            # Calculate metrics
            cur.execute(f"""
                WITH daily_stats AS (
                    SELECT 
                        COUNT(*) as total_trades,
                        SUM(CASE WHEN profit_loss > 0 THEN 1 ELSE 0 END) as winning_trades,
                        SUM(CASE WHEN profit_loss < 0 THEN 1 ELSE 0 END) as losing_trades,
                        SUM(CASE WHEN profit_loss = 0 THEN 1 ELSE 0 END) as breakeven_trades,
                        SUM(CASE WHEN profit_loss > 0 THEN profit_loss ELSE 0 END) as total_profit,
                        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE 0 END) as total_loss,
                        SUM(profit_loss) as net_pnl,
                        AVG(CASE WHEN profit_loss > 0 THEN profit_loss END) as avg_profit,
                        AVG(CASE WHEN profit_loss < 0 THEN profit_loss END) as avg_loss,
                        MAX(profit_loss) as largest_win,
                        MIN(profit_loss) as largest_loss
                    FROM {table}
                    WHERE DATE(exit_time) = %s
                        AND status = 'CLOSED'
                )
                INSERT INTO strategy_performance 
                (strategy_name, date, total_trades, winning_trades, losing_trades, breakeven_trades,
                 win_rate, total_profit, total_loss, net_profit_loss, avg_profit, avg_loss,
                 largest_win, largest_loss, profit_factor)
                SELECT 
                    %s,
                    %s,
                    total_trades,
                    winning_trades,
                    losing_trades,
                    breakeven_trades,
                    CASE WHEN total_trades > 0 THEN (winning_trades::DECIMAL / total_trades) * 100 ELSE 0 END,
                    total_profit,
                    total_loss,
                    net_pnl,
                    avg_profit,
                    avg_loss,
                    largest_win,
                    largest_loss,
                    CASE WHEN total_loss > 0 THEN total_profit / total_loss ELSE 0 END
                FROM daily_stats
                ON CONFLICT (strategy_name, date) 
                DO UPDATE SET
                    total_trades = EXCLUDED.total_trades,
                    winning_trades = EXCLUDED.winning_trades,
                    losing_trades = EXCLUDED.losing_trades,
                    win_rate = EXCLUDED.win_rate,
                    total_profit = EXCLUDED.total_profit,
                    total_loss = EXCLUDED.total_loss,
                    net_profit_loss = EXCLUDED.net_profit_loss,
                    updated_at = CURRENT_TIMESTAMP
            """, (date, strategy_name, date))
            
            cur.close()
            return True
    
    def get_strategy_performance(self, strategy_name: str = None, days: int = 30) -> List[Dict]:
        """Get performance data for strategies"""
        with self.get_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            if strategy_name:
                cur.execute("""
                    SELECT * FROM strategy_performance
                    WHERE strategy_name = %s
                        AND date >= CURRENT_DATE - INTERVAL '%s days'
                    ORDER BY date DESC
                """, (strategy_name, days))
            else:
                cur.execute("""
                    SELECT * FROM strategy_performance
                    WHERE date >= CURRENT_DATE - INTERVAL '%s days'
                    ORDER BY date DESC, strategy_name
                """, (days,))
            
            performance = cur.fetchall()
            cur.close()
            return [dict(p) for p in performance]


# Create singleton instance
database_service = DatabaseService()

# Made with Bob
