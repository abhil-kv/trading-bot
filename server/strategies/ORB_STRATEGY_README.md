# Opening Range Breakout (ORB) Strategy

## Overview
The Opening Range Breakout (ORB) strategy is a popular intraday trading method that captures momentum moves by identifying breakouts from the first 15 minutes of trading. This strategy is based on the principle that the opening range often sets the tone for the day's price action.

## Strategy Type
**Breakout/Momentum** - Intraday strategy capturing directional moves

## Timeframe
**Intraday** - First 15 minutes (9:15 AM - 9:30 AM IST) defines the range

---

## 📊 How It Works

### Phase 1: Opening Range Capture (9:15 AM - 9:30 AM)
The strategy tracks the **first 15-minute candle** of the trading day:

- **Opening Range High:** Highest price between 9:15 AM - 9:30 AM
- **Opening Range Low:** Lowest price between 9:15 AM - 9:30 AM
- **Opening Price:** Price at 9:15 AM
- **Closing Price:** Price at 9:30 AM

This 15-minute range represents the initial battle between buyers and sellers.

### Phase 2: Breakout Detection (After 9:30 AM)
After 9:30 AM, the strategy monitors for breakouts:

**BUY Signal (Bullish Breakout):**
- Price breaks **ABOVE** the Opening Range High
- Indicates strong buying pressure
- Suggests upward momentum for the day

**SELL Signal (Bearish Breakout):**
- Price breaks **BELOW** the Opening Range Low
- Indicates strong selling pressure
- Suggests downward momentum for the day

---

## 🎯 Entry Rules

### BUY Entry
**Trigger:** Price closes above Opening Range High

**Conditions:**
1. Current time > 9:30 AM
2. Price > Opening Range High
3. Preferably with volume confirmation
4. No prior breakout signal for the day

**Entry Price:** Current market price when breakout is detected

### SELL Entry
**Trigger:** Price closes below Opening Range Low

**Conditions:**
1. Current time > 9:30 AM
2. Price < Opening Range Low
3. Preferably with volume confirmation
4. No prior breakout signal for the day

**Entry Price:** Current market price when breakout is detected

---

## 🛡️ Risk Management

### Stop Loss Strategy

**For BUY Trades:**
- **Stop Loss:** Opening Range Low
- **Logic:** If price falls back into the range, breakout has failed
- **Risk:** Entry Price - Opening Range Low

**For SELL Trades:**
- **Stop Loss:** Opening Range High
- **Logic:** If price rises back into the range, breakout has failed
- **Risk:** Opening Range High - Entry Price

### Target Strategy

**Method 1: Fixed Risk-Reward**
- **Target:** 2× or 3× the risk
- **BUY Target:** Entry + (2 × Risk)
- **SELL Target:** Entry - (2 × Risk)

**Method 2: Range Projection**
- **Range Size:** Opening Range High - Opening Range Low
- **BUY Target:** Opening Range High + (1× to 2× Range Size)
- **SELL Target:** Opening Range Low - (1× to 2× Range Size)

**Method 3: Technical Levels**
- Previous day's high/low
- Key support/resistance levels
- Round numbers (psychological levels)

### Position Sizing
- Risk **1-2%** of capital per trade
- Calculate position size based on stop loss distance
- Adjust for volatility (wider range = smaller position)

---

## ✅ Best Market Conditions

This strategy performs **BEST** in:

1. **Trending Days**
   - Clear directional bias
   - Strong momentum
   - Follow-through after breakout

2. **High Volatility**
   - Larger opening ranges
   - Better risk-reward opportunities
   - Clear breakouts

3. **News-Driven Days**
   - Earnings announcements
   - Economic data releases
   - Sector-specific news

4. **Gap Days**
   - Gap up with continuation
   - Gap down with continuation
   - Strong opening momentum

5. **High Volume Days**
   - Increased participation
   - Better liquidity
   - Stronger moves

---

## ⚠️ Poor Performance Conditions

This strategy performs **POORLY** in:

1. **Sideways/Range-Bound Days**
   - No clear direction
   - Multiple false breakouts
   - Whipsaws common

2. **Low Volatility**
   - Narrow opening ranges
   - Poor risk-reward
   - Minimal movement

3. **Choppy Markets**
   - Erratic price action
   - No sustained moves
   - Stop losses hit frequently

4. **Late Entry**
   - Entering too far from breakout
   - Reduced risk-reward
   - Higher chance of reversal

5. **Wide Opening Ranges**
   - Large stop loss required
   - Poor risk-reward ratio
   - Difficult to manage

---

## 📈 Trading Guidelines

### Pre-Market Preparation
1. **Identify Stocks**
   - High liquidity stocks
   - Stocks with news/catalysts
   - Stocks showing pre-market strength/weakness

2. **Check Market Sentiment**
   - Index futures direction
   - Global market cues
   - Sector trends

3. **Set Alerts**
   - Alert at Opening Range High
   - Alert at Opening Range Low
   - Volume alerts

### During Opening Range (9:15-9:30 AM)
1. **Observe Price Action**
   - Note the high and low
   - Watch volume patterns
   - Identify initial direction

2. **Assess Range Quality**
   - Narrow range = easier to break
   - Wide range = larger risk
   - Balanced range = ideal

3. **Don't Trade Yet**
   - Wait for range to complete
   - Avoid impulsive entries
   - Let the setup develop

### After 9:30 AM
1. **Wait for Breakout**
   - Don't anticipate
   - Wait for clear break
   - Confirm with volume

2. **Enter on Confirmation**
   - Price sustains above/below range
   - Volume increases
   - No immediate reversal

3. **Manage Position**
   - Set stop loss immediately
   - Define target
   - Trail stop if profitable

---

## 🎯 Entry Checklist

Before entering a trade, verify:

- [ ] Opening range is captured (9:15-9:30 AM data)
- [ ] Current time is after 9:30 AM
- [ ] Clear breakout above high OR below low
- [ ] Volume is increasing (confirmation)
- [ ] No prior breakout signal for this stock today
- [ ] Stop loss level is identified
- [ ] Target level is calculated
- [ ] Risk-reward ratio is at least 1:2
- [ ] Position size is calculated
- [ ] Market conditions are favorable

---

## 📊 Example Trades

### Example 1: Bullish Breakout (BUY)
```
Stock: RELIANCE
Date: June 15, 2026

Opening Range (9:15-9:30 AM):
- High: ₹2,865
- Low: ₹2,850
- Open: ₹2,852
- Close: ₹2,860
- Range Size: ₹15

Breakout Time: 10:05 AM
Entry Price: ₹2,870 (broke above ₹2,865)
Stop Loss: ₹2,850 (Opening Range Low)
Risk: ₹20 per share

Target Options:
1. Fixed R:R (2×): ₹2,910 (₹2,870 + ₹40)
2. Range Projection: ₹2,880 (₹2,865 + ₹15)
3. Previous Day High: ₹2,895

Selected Target: ₹2,910 (2× risk)
Risk-Reward: 1:2

Position Size: 500 shares (₹10,000 risk = 2% of ₹5,00,000)

Outcome:
- Hit target at 11:30 AM
- Profit: ₹20,000 (₹40 × 500 shares)
- Return: 4% on capital deployed
```

### Example 2: Bearish Breakout (SELL)
```
Stock: INFY
Date: June 16, 2026

Opening Range (9:15-9:30 AM):
- High: ₹1,485
- Low: ₹1,475
- Open: ₹1,483
- Close: ₹1,477
- Range Size: ₹10

Breakout Time: 9:45 AM
Entry Price: ₹1,472 (broke below ₹1,475)
Stop Loss: ₹1,485 (Opening Range High)
Risk: ₹13 per share

Target Options:
1. Fixed R:R (2×): ₹1,446 (₹1,472 - ₹26)
2. Range Projection: ₹1,465 (₹1,475 - ₹10)
3. Previous Day Low: ₹1,460

Selected Target: ₹1,446 (2× risk)
Risk-Reward: 1:2

Position Size: 750 shares (₹9,750 risk ≈ 2% of ₹5,00,000)

Outcome:
- Hit target at 1:15 PM
- Profit: ₹19,500 (₹26 × 750 shares)
- Return: 3.9% on capital deployed
```

---

## 🔧 Advanced Techniques

### 1. Multiple Timeframe Confirmation
- Check 5-minute chart for breakout candle
- Verify 15-minute chart shows strength
- Ensure hourly trend aligns

### 2. Volume Analysis
- **Breakout Volume > Average Volume**
- Increasing volume = genuine breakout
- Decreasing volume = potential false breakout

### 3. Price Action Confirmation
- **Strong breakout candle** (large body, small wicks)
- **Immediate follow-through** (next candle continues)
- **No immediate reversal** (stays outside range)

### 4. Partial Profit Taking
- Book 50% at 1:1 risk-reward
- Move stop to breakeven
- Let remaining 50% run to target

### 5. Trailing Stop Loss
- After 1:1 R:R, trail stop to breakeven
- After 1.5:1 R:R, trail stop to +0.5R
- After 2:1 R:R, trail stop to +1R

---

## 📊 Range Quality Assessment

### Ideal Opening Range
- **Size:** 0.5% - 1.5% of stock price
- **Shape:** Balanced (not too wide or narrow)
- **Volume:** Average to above average
- **Price Action:** Clean, not choppy

### Narrow Range (< 0.5%)
- **Pros:** Easy to break, clear signals
- **Cons:** Small targets, frequent breakouts
- **Strategy:** Use tighter stops, smaller positions

### Wide Range (> 2%)
- **Pros:** Larger targets if breakout succeeds
- **Cons:** Large stop loss, poor R:R
- **Strategy:** Wait for retest, use smaller positions

### Choppy Range
- **Characteristics:** Multiple swings, no clear direction
- **Risk:** False breakouts likely
- **Strategy:** Avoid or wait for clearer setup

---

## 🚨 Common Mistakes to Avoid

1. **Trading Before 9:30 AM**
   - Opening range not complete
   - Premature entries
   - Higher risk of reversal

2. **Chasing Breakouts**
   - Entering too far from breakout point
   - Poor risk-reward
   - Increased chance of pullback

3. **Ignoring Stop Loss**
   - Hoping for reversal
   - Letting losses run
   - Emotional decision-making

4. **Overtrading**
   - Trading every breakout
   - Not selective enough
   - Quality over quantity

5. **Not Confirming Volume**
   - Breakout without volume = weak
   - False breakouts common
   - Always check volume

6. **Holding Overnight**
   - ORB is intraday strategy
   - Exit by 3:15 PM
   - Don't convert to swing trade

7. **Trading in Choppy Markets**
   - Multiple false breakouts
   - Whipsaws common
   - Better to skip the day

---

## 📈 Performance Metrics

### Expected Win Rate
- **50-60%** in trending markets
- **30-40%** in choppy markets
- **Overall:** 45-55%

### Risk-Reward
- **Minimum:** 1:2
- **Average:** 1:2 to 1:3
- **Maximum:** 1:5+ on strong trending days

### Holding Period
- **Average:** 1-3 hours
- **Maximum:** Same day (exit by 3:15 PM)
- **Minimum:** 15-30 minutes

### Daily Trades
- **Recommended:** 1-3 trades per day
- **Maximum:** 5 trades per day
- **Focus:** Quality setups only

---

## 🛠️ Implementation Details

### Real-Time Tracking
- Monitors all stocks from 9:15 AM
- Builds first 15-minute candle tick-by-tick
- Finalizes opening range at 9:30 AM
- Detects breakouts in real-time

### Data Storage
- Opening ranges stored per symbol
- Breakout signals tracked separately
- Daily reset at market open
- Thread-safe implementation

### Demo Mode
- Simulates opening range outside market hours
- Uses open price ±1% as range
- Allows testing and development
- Marked as simulated data

---

## 📚 Additional Resources

### Recommended Books
- "Opening Range Breakout" by Toby Crabel
- "Day Trading and Swing Trading the Currency Market" by Kathy Lien
- "The Complete Guide to Day Trading" by Markus Heitkoetter

### Related Strategies
- **First Hour Breakout** - Extended to 60 minutes
- **Gap and Go** - Combines gaps with ORB
- **VWAP Breakout** - Uses VWAP instead of range

### Tools
- **TradingView** - Charting and alerts
- **Market Profile** - Understanding opening range
- **Volume Profile** - Volume-based analysis

---

## ⚡ Quick Reference

| Aspect | Details |
|--------|---------|
| **Strategy Type** | Breakout/Momentum |
| **Timeframe** | Intraday (First 15 min) |
| **Opening Range** | 9:15 AM - 9:30 AM |
| **BUY Signal** | Price > Opening Range High |
| **SELL Signal** | Price < Opening Range Low |
| **Stop Loss (BUY)** | Opening Range Low |
| **Stop Loss (SELL)** | Opening Range High |
| **Target** | 2-3× Risk or Range Projection |
| **Risk-Reward** | Minimum 1:2 |
| **Position Size** | 1-2% risk per trade |
| **Exit Time** | By 3:15 PM (same day) |
| **Best Market** | Trending, high volatility |
| **Avoid** | Choppy, range-bound |

---

## 📝 Daily Trading Routine

### Pre-Market (8:00 AM - 9:15 AM)
- [ ] Check global markets and index futures
- [ ] Review stocks with news/catalysts
- [ ] Identify potential ORB candidates
- [ ] Set up watchlist and alerts
- [ ] Review previous day's trades

### Opening Range (9:15 AM - 9:30 AM)
- [ ] Monitor opening price action
- [ ] Track high and low for each stock
- [ ] Observe volume patterns
- [ ] Note market sentiment
- [ ] Don't trade yet - just observe

### Trading Hours (9:30 AM - 3:15 PM)
- [ ] Wait for clear breakouts
- [ ] Enter with confirmation
- [ ] Set stop loss immediately
- [ ] Monitor position actively
- [ ] Trail stops on profitable trades
- [ ] Exit all positions by 3:15 PM

### Post-Market (3:30 PM onwards)
- [ ] Review all trades
- [ ] Update trading journal
- [ ] Calculate P&L and metrics
- [ ] Identify lessons learned
- [ ] Plan for next day

---

## 🎓 Learning Path

### Week 1-2: Observation
- Watch opening ranges form
- Note breakout patterns
- Track success rate
- Don't trade yet

### Week 3-4: Paper Trading
- Simulate trades
- Practice entry/exit
- Test different stocks
- Refine strategy

### Week 5-6: Small Live Trades
- Start with 1 stock
- Use minimum position size
- Focus on execution
- Build confidence

### Week 7+: Scale Up
- Increase position sizes gradually
- Trade multiple stocks
- Optimize parameters
- Track performance

---

## 💡 Pro Tips

1. **Best Stocks for ORB**
   - High liquidity (Nifty 50)
   - Average daily range > 2%
   - Consistent volume
   - Clear trends

2. **Timing Matters**
   - Best breakouts: 9:30-10:30 AM
   - Good breakouts: 10:30-12:00 PM
   - Risky breakouts: After 2:00 PM

3. **Market Context**
   - Trade with overall market direction
   - Stronger signals when indices also break
   - Avoid counter-trend trades

4. **Risk Management**
   - Never risk more than 2% per trade
   - Use proper position sizing
   - Always use stop losses
   - Don't average down

5. **Psychology**
   - Be patient for setup
   - Don't force trades
   - Accept small losses
   - Let winners run

---

**Disclaimer:** This strategy is for educational purposes only. Past performance does not guarantee future results. Opening Range Breakout trading involves significant risk. Always do your own research and consider your risk tolerance before trading.

---

*Last Updated: June 2026*
*Version: 1.0*