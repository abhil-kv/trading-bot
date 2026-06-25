# Strong Mean Reversion Strategy

## Overview
The Strong Mean Reversion Strategy is designed to capitalize on price reversals in range-bound and sideways markets. It identifies oversold (buy) and overbought (sell) conditions using technical indicators and confirms signals with volume spikes and candlestick patterns.

## Strategy Type
**Mean Reversion** - Assumes that prices will revert to their mean after extreme movements.

## Timeframe
**5 Minutes** - Intraday strategy using 5-minute candles

---

## 📊 Buy Signal Conditions

A **BUY** signal is generated when **ALL** of the following conditions are met:

1. **RSI(14) < 30**
   - Relative Strength Index below 30 indicates oversold conditions
   - Price has fallen significantly and may bounce back

2. **Close ≤ Lower Bollinger Band**
   - Price touches or breaks below the lower Bollinger Band
   - Indicates extreme downward movement from the mean

3. **Volume > 1.2 × Average Volume(20)**
   - Current volume is at least 20% higher than the 20-period average
   - Confirms strong participation in the move

4. **Close > Open (Green Candle)**
   - Current 5-minute candle closes higher than it opened
   - Shows buying pressure and potential reversal

5. **Price > EMA(200)**
   - Price is above the 200-period Exponential Moving Average
   - Ensures we're buying in an overall uptrend context

### Buy Exit Strategy

**Stop Loss:**
- Set at the **Previous Swing Low** (lowest low of last 20 candles)
- Protects against continued downward movement

**Target:**
- **Primary Target:** Middle Bollinger Band
- **Alternative Target:** 2 × Risk (Entry Price + 2 × (Entry - Stop Loss))
- Whichever is **higher** is selected as the target

**Risk-Reward Ratio:** Minimum 1:2

---

## 📉 Sell Signal Conditions

A **SELL** signal is generated when **ALL** of the following conditions are met:

1. **RSI(14) > 70**
   - Relative Strength Index above 70 indicates overbought conditions
   - Price has risen significantly and may pull back

2. **Close ≥ Upper Bollinger Band**
   - Price touches or breaks above the upper Bollinger Band
   - Indicates extreme upward movement from the mean

3. **Volume > 1.2 × Average Volume(20)**
   - Current volume is at least 20% higher than the 20-period average
   - Confirms strong participation in the move

4. **Close < Open (Red Candle)**
   - Current 5-minute candle closes lower than it opened
   - Shows selling pressure and potential reversal

5. **Price < EMA(200)**
   - Price is below the 200-period Exponential Moving Average
   - Ensures we're selling in an overall downtrend context

### Sell Exit Strategy

**Stop Loss:**
- Set at the **Previous Swing High** (highest high of last 20 candles)
- Protects against continued upward movement

**Target:**
- **Primary Target:** Middle Bollinger Band
- **Alternative Target:** 2 × Risk (Entry Price - 2 × (Stop Loss - Entry))
- Whichever is **lower** is selected as the target

**Risk-Reward Ratio:** Minimum 1:2

---

## 📈 Technical Indicators Used

### 1. RSI (Relative Strength Index)
- **Period:** 14
- **Oversold:** < 30
- **Overbought:** > 70
- **Purpose:** Identifies momentum extremes

### 2. Bollinger Bands
- **Period:** 20
- **Standard Deviation:** 2.0
- **Components:**
  - Upper Band: SMA(20) + 2 × StdDev
  - Middle Band: SMA(20)
  - Lower Band: SMA(20) - 2 × StdDev
- **Purpose:** Identifies price extremes and mean

### 3. EMA (Exponential Moving Average)
- **Period:** 200
- **Purpose:** Determines overall trend direction
- **Buy:** Price > EMA200 (uptrend context)
- **Sell:** Price < EMA200 (downtrend context)

### 4. Volume Analysis
- **Period:** 20 (for average calculation)
- **Threshold:** 1.2× average volume
- **Purpose:** Confirms genuine moves with participation

---

## ✅ Best Market Conditions

This strategy performs **BEST** in:

1. **Sideways Market**
   - Price oscillates within a range
   - Clear support and resistance levels
   - Mean reversion is most reliable

2. **Range-Bound Market**
   - Price bounces between defined boundaries
   - Predictable price action
   - High probability of reversals

3. **Low Trend Environment**
   - Minimal directional bias
   - Price respects technical levels
   - Indicators work effectively

4. **Consolidation Phases**
   - After strong trends, during consolidation
   - Price stabilizes before next move
   - Mean reversion opportunities increase

---

## ⚠️ Poor Performance Conditions

This strategy performs **POORLY** in:

1. **Strong Uptrend**
   - Price consistently breaks above upper bands
   - RSI remains overbought for extended periods
   - Selling signals lead to losses

2. **Strong Downtrend**
   - Price consistently breaks below lower bands
   - RSI remains oversold for extended periods
   - Buying signals lead to losses

3. **News Breakouts**
   - Fundamental news drives price action
   - Technical indicators become unreliable
   - Extreme volatility invalidates signals

4. **Gap Up Days**
   - Large opening gaps create abnormal conditions
   - Price may not revert to mean
   - Risk-reward becomes unfavorable

5. **Gap Down Days**
   - Large opening gaps create abnormal conditions
   - Price may continue trending
   - Stop losses may be hit quickly

---

## 🎯 Risk Management

### Position Sizing
- Risk only **1-2%** of capital per trade
- Calculate position size based on stop loss distance

### Stop Loss Rules
- **Always use stop loss** - No exceptions
- Place stop loss at previous swing low/high
- Never move stop loss against your position

### Target Management
- Take partial profits at Middle Bollinger Band
- Trail stop loss to breakeven after 1:1 risk-reward
- Exit completely at 2× risk target

### Maximum Trades
- Limit to **3-5 trades per day**
- Avoid overtrading in choppy conditions
- Quality over quantity

---

## 📋 Entry Checklist

Before entering a trade, verify:

- [ ] All 5 signal conditions are met
- [ ] Volume spike is confirmed (>1.2× average)
- [ ] Candle color matches signal (green for buy, red for sell)
- [ ] Price relationship with EMA200 is correct
- [ ] Stop loss level is identified
- [ ] Target level is calculated
- [ ] Risk-reward ratio is at least 1:2
- [ ] Market is not in strong trend
- [ ] No major news events expected
- [ ] Position size is calculated

---

## 🔧 Implementation Details

### Data Requirements
- **Minimum Candles:** 200 (for EMA200 calculation)
- **Candle Interval:** 5 minutes
- **Historical Data:** At least 2-3 days of 5-minute data

### Real-Time Monitoring
- Strategy runs in separate thread
- Analyzes data every 30 seconds per stock
- Builds 5-minute candles from tick data
- Maintains last 300 candles (25 hours)

### Signal Generation
- Signals are generated in real-time
- Each stock analyzed independently
- Duplicate signals prevented
- Active signals tracked until exit

---

## 📊 Performance Metrics

### Expected Win Rate
- **50-60%** in ideal conditions (sideways/range-bound)
- **30-40%** in trending markets (avoid these)

### Risk-Reward
- **Minimum:** 1:2
- **Average:** 1:2 to 1:3
- **Maximum:** Depends on Bollinger Band width

### Holding Period
- **Average:** 30 minutes to 2 hours
- **Maximum:** Same day (intraday strategy)
- **Minimum:** 15 minutes (wait for confirmation)

---

## 🚀 Usage Example

### Buy Signal Example
```
Symbol: RELIANCE
Time: 10:35 AM
LTP: ₹2,456.75
RSI: 28.5 ✓ (< 30)
Lower BB: ₹2,458.00 ✓ (Price ≤ Lower BB)
Volume: 1.35× average ✓ (> 1.2×)
Candle: Green ✓ (Close > Open)
EMA200: ₹2,420.00 ✓ (Price > EMA200)

Entry: ₹2,456.75
Stop Loss: ₹2,440.20 (Previous swing low)
Target: ₹2,489.85 (2× risk)
Risk: ₹16.55
Reward: ₹33.10
Risk-Reward: 1:2 ✓
```

### Sell Signal Example
```
Symbol: TCS
Time: 2:15 PM
LTP: ₹3,845.30
RSI: 72.3 ✓ (> 70)
Upper BB: ₹3,843.00 ✓ (Price ≥ Upper BB)
Volume: 1.28× average ✓ (> 1.2×)
Candle: Red ✓ (Close < Open)
EMA200: ₹3,860.00 ✓ (Price < EMA200)

Entry: ₹3,845.30
Stop Loss: ₹3,862.15 (Previous swing high)
Target: ₹3,811.60 (2× risk)
Risk: ₹16.85
Reward: ₹33.70
Risk-Reward: 1:2 ✓
```

---

## 🛠️ Customization Options

### Adjustable Parameters
1. **RSI Period:** Default 14 (can use 9 for faster signals)
2. **RSI Thresholds:** Default 30/70 (can use 25/75 for stricter)
3. **Bollinger Period:** Default 20 (can use 15 for faster)
4. **Bollinger StdDev:** Default 2.0 (can use 2.5 for wider bands)
5. **EMA Period:** Default 200 (can use 50 for shorter-term)
6. **Volume Multiplier:** Default 1.2× (can use 1.5× for stricter)
7. **Swing Period:** Default 20 candles (can adjust for different markets)

### Market-Specific Adjustments
- **High Volatility Stocks:** Use wider Bollinger Bands (2.5 StdDev)
- **Low Volatility Stocks:** Use tighter Bollinger Bands (1.5 StdDev)
- **Liquid Stocks:** Lower volume threshold (1.1×)
- **Illiquid Stocks:** Higher volume threshold (1.5×)

---

## 📚 Additional Resources

### Related Strategies
- **Bollinger Band Squeeze:** For breakout trading
- **RSI Divergence:** For trend reversal
- **Volume Profile:** For support/resistance

### Recommended Reading
- "Mean Reversion Trading Systems" by Howard Bandy
- "Bollinger on Bollinger Bands" by John Bollinger
- "Technical Analysis of the Financial Markets" by John Murphy

---

## ⚡ Quick Reference

| Aspect | Buy | Sell |
|--------|-----|------|
| RSI | < 30 | > 70 |
| Bollinger Band | ≤ Lower | ≥ Upper |
| Volume | > 1.2× Avg | > 1.2× Avg |
| Candle | Green | Red |
| EMA200 | Price > EMA | Price < EMA |
| Stop Loss | Swing Low | Swing High |
| Target | Middle BB or 2×R | Middle BB or 2×R |

---

## 📝 Notes

- **Always backtest** before live trading
- **Paper trade** for at least 2 weeks
- **Keep a trading journal** to track performance
- **Review trades** weekly to improve
- **Adapt to market conditions** - skip trading in strong trends
- **Use proper position sizing** - never risk more than 2% per trade

---

**Disclaimer:** This strategy is for educational purposes only. Past performance does not guarantee future results. Always do your own research and consider your risk tolerance before trading.

---

*Last Updated: June 2026*
*Version: 2.0*