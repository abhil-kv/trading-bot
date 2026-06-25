# Trading Bot Database Setup

## Overview
This directory contains the PostgreSQL database schema for storing trading signals, performance metrics, and historical data for all trading strategies.

## Database Tables

### 1. **candles**
Stores 5-minute candle data for all stocks
- Historical price data (OHLCV)
- Used for technical analysis
- Indexed by symbol and timestamp

### 2. **mean_reversion_signals**
Stores signals from the Strong Mean Reversion strategy
- Entry/exit details
- Technical indicators (RSI, Bollinger Bands, EMA)
- Risk management (stop loss, target)
- P&L tracking

### 3. **swing_signals**
Stores signals from the Swing Trading strategy
- 52-week high momentum trades
- Multiple target levels
- Partial exit tracking
- Holding period analysis

### 4. **orb_signals**
Stores signals from the Opening Range Breakout strategy
- Opening range data (9:15-9:30 AM)
- Breakout details
- Intraday trade tracking
- False breakout detection

### 5. **strategy_performance**
Daily performance metrics for each strategy
- Win rate, profit factor
- Average profit/loss
- Trade statistics

### 6. **trade_journal**
Manual notes and observations for trades
- Entry/exit notes
- Lessons learned
- Market conditions
- Emotional state tracking

### 7. **market_conditions**
Daily market data and conditions
- Nifty 50 OHLC
- VIX, advance/decline ratio
- Market type classification

### 8. **watchlist**
Stocks being monitored for potential signals
- Per-strategy watchlists
- Alert levels
- Monitoring reasons

## Setup Instructions

### Prerequisites
- PostgreSQL 12 or higher installed
- Database user with CREATE privileges

### Step 1: Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE trading_bot;

# Connect to the database
\c trading_bot
```

### Step 2: Run Schema
```bash
# From the server/database directory
psql -U postgres -d trading_bot -f schema.sql
```

Or from within psql:
```sql
\i /path/to/server/database/schema.sql
```

### Step 3: Verify Tables
```sql
-- List all tables
\dt

-- Check table structure
\d mean_reversion_signals
\d swing_signals
\d orb_signals
```

### Step 4: Configure Connection
Create a `.env` file in the server directory:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/trading_bot
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trading_bot
DB_USER=your_username
DB_PASSWORD=your_password
```

## Database Views

### v_active_mean_reversion
Shows all active mean reversion signals
```sql
SELECT * FROM v_active_mean_reversion;
```

### v_active_swing
Shows all active swing trading positions
```sql
SELECT * FROM v_active_swing;
```

### v_active_orb
Shows all active ORB signals for today
```sql
SELECT * FROM v_active_orb;
```

### v_daily_performance
Shows daily performance summary for all strategies
```sql
SELECT * FROM v_daily_performance WHERE date = CURRENT_DATE;
```

## Common Queries

### Get All Active Signals
```sql
SELECT 'Mean Reversion' as strategy, symbol, entry_price, entry_time
FROM mean_reversion_signals WHERE status = 'ACTIVE'
UNION ALL
SELECT 'Swing' as strategy, symbol, entry_price, entry_time
FROM swing_signals WHERE status IN ('ACTIVE', 'PARTIAL')
UNION ALL
SELECT 'ORB' as strategy, symbol, entry_price, entry_time
FROM orb_signals WHERE status = 'ACTIVE'
ORDER BY entry_time DESC;
```

### Today's Performance
```sql
SELECT 
    strategy_name,
    total_trades,
    winning_trades,
    win_rate,
    net_profit_loss
FROM strategy_performance
WHERE date = CURRENT_DATE;
```

### Best Performing Stocks (Last 30 Days)
```sql
SELECT 
    symbol,
    COUNT(*) as total_trades,
    SUM(CASE WHEN profit_loss > 0 THEN 1 ELSE 0 END) as wins,
    ROUND(AVG(profit_loss_percent), 2) as avg_return_pct,
    ROUND(SUM(profit_loss), 2) as total_pnl
FROM mean_reversion_signals
WHERE entry_time >= CURRENT_DATE - INTERVAL '30 days'
    AND status = 'CLOSED'
GROUP BY symbol
HAVING COUNT(*) >= 3
ORDER BY avg_return_pct DESC
LIMIT 10;
```

### Strategy Win Rate Comparison
```sql
SELECT 
    strategy_name,
    ROUND(AVG(win_rate), 2) as avg_win_rate,
    SUM(total_trades) as total_trades,
    ROUND(SUM(net_profit_loss), 2) as total_pnl,
    ROUND(AVG(profit_factor), 2) as avg_profit_factor
FROM strategy_performance
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY strategy_name
ORDER BY avg_win_rate DESC;
```

### Open Positions Summary
```sql
-- Mean Reversion
SELECT 
    'Mean Reversion' as strategy,
    COUNT(*) as open_positions,
    ROUND(SUM(entry_price * 100), 2) as capital_deployed
FROM mean_reversion_signals
WHERE status = 'ACTIVE'

UNION ALL

-- Swing
SELECT 
    'Swing Trading' as strategy,
    COUNT(*) as open_positions,
    ROUND(SUM(entry_price * 100), 2) as capital_deployed
FROM swing_signals
WHERE status IN ('ACTIVE', 'PARTIAL')

UNION ALL

-- ORB
SELECT 
    'ORB' as strategy,
    COUNT(*) as open_positions,
    ROUND(SUM(entry_price * 100), 2) as capital_deployed
FROM orb_signals
WHERE status = 'ACTIVE';
```

### Closed Trades Analysis
```sql
SELECT 
    symbol,
    signal_type,
    entry_price,
    exit_price,
    profit_loss,
    profit_loss_percent,
    EXTRACT(EPOCH FROM (exit_time - entry_time))/3600 as holding_hours,
    exit_reason
FROM mean_reversion_signals
WHERE status = 'CLOSED'
    AND entry_time >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY exit_time DESC;
```

## Data Maintenance

### Archive Old Data
```sql
-- Archive candles older than 90 days
DELETE FROM candles 
WHERE timestamp < CURRENT_DATE - INTERVAL '90 days';

-- Archive closed signals older than 1 year
DELETE FROM mean_reversion_signals 
WHERE status = 'CLOSED' 
    AND exit_time < CURRENT_DATE - INTERVAL '1 year';
```

### Backup Database
```bash
# Full backup
pg_dump -U postgres trading_bot > backup_$(date +%Y%m%d).sql

# Backup specific tables
pg_dump -U postgres -t mean_reversion_signals -t swing_signals -t orb_signals trading_bot > signals_backup.sql
```

### Restore Database
```bash
psql -U postgres trading_bot < backup_20260625.sql
```

## Performance Optimization

### Analyze Tables
```sql
ANALYZE mean_reversion_signals;
ANALYZE swing_signals;
ANALYZE orb_signals;
ANALYZE candles;
```

### Vacuum Tables
```sql
VACUUM ANALYZE mean_reversion_signals;
VACUUM ANALYZE swing_signals;
VACUUM ANALYZE orb_signals;
```

### Check Index Usage
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Integration with Python

### Install Dependencies
```bash
pip install psycopg2-binary sqlalchemy
```

### Example Connection
```python
import psycopg2
from sqlalchemy import create_engine

# Using psycopg2
conn = psycopg2.connect(
    host="localhost",
    database="trading_bot",
    user="your_username",
    password="your_password"
)

# Using SQLAlchemy
engine = create_engine('postgresql://username:password@localhost:5432/trading_bot')
```

### Insert Signal Example
```python
import psycopg2
from datetime import datetime

conn = psycopg2.connect(...)
cur = conn.cursor()

# Insert mean reversion signal
cur.execute("""
    INSERT INTO mean_reversion_signals 
    (symbol, name, signal_type, entry_price, entry_time, rsi, bb_lower, bb_middle, bb_upper, 
     ema_value, ema_period, stop_loss, target, risk_reward_ratio, status)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id
""", (
    'RELIANCE', 'Reliance Industries', 'BUY', 2456.75, datetime.now(),
    28.5, 2440.20, 2470.50, 2500.80, 2420.00, 200,
    2440.20, 2489.85, 2.0, 'ACTIVE'
))

signal_id = cur.fetchone()[0]
conn.commit()
cur.close()
conn.close()
```

### Query Signals Example
```python
import pandas as pd
from sqlalchemy import create_engine

engine = create_engine('postgresql://username:password@localhost:5432/trading_bot')

# Get active signals
df = pd.read_sql_query("""
    SELECT * FROM v_active_mean_reversion
""", engine)

print(df)
```

## Monitoring

### Check Database Size
```sql
SELECT 
    pg_size_pretty(pg_database_size('trading_bot')) as database_size;
```

### Check Table Sizes
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Active Connections
```sql
SELECT 
    datname,
    count(*) as connections
FROM pg_stat_activity
GROUP BY datname;
```

## Troubleshooting

### Connection Issues
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Permission Issues
```sql
-- Grant all privileges to user
GRANT ALL PRIVILEGES ON DATABASE trading_bot TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_username;
```

### Reset Database
```sql
-- Drop all tables (careful!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Re-run schema.sql
\i /path/to/schema.sql
```

## Best Practices

1. **Regular Backups**: Schedule daily backups
2. **Index Maintenance**: Run ANALYZE weekly
3. **Data Archival**: Archive old data monthly
4. **Monitor Performance**: Check slow queries regularly
5. **Use Transactions**: Wrap related operations in transactions
6. **Parameterized Queries**: Always use parameterized queries to prevent SQL injection
7. **Connection Pooling**: Use connection pooling for better performance

## Support

For issues or questions:
- Check PostgreSQL logs: `/var/log/postgresql/`
- Review query performance: Use EXPLAIN ANALYZE
- Monitor connections: Check pg_stat_activity

---

*Last Updated: June 2026*
*Version: 1.0*