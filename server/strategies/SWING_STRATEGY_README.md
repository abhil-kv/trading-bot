# Swing Trading Strategy - 52-Week High Momentum

## Overview
The Swing Trading Strategy identifies stocks that are near their 52-week highs with strong momentum and high trading volume. This strategy is designed for multi-day position trading, capturing momentum moves in stocks showing strength.

## Strategy Type
**Momentum/Swing Trading** - Captures medium-term price movements (days to weeks)

## Timeframe
**Daily** - Position holding period: 2-10 days

---

## 📊 Stock Selection Criteria

### Primary Filter: ChartInk Scanner
Stocks are sourced from a custom ChartInk scanner that identifies:
- Stocks approaching or at **52-week highs**
- Strong upward momentum
- Breakout patterns
- Volume confirmation

### Secondary Filter: Price Threshold
- **Daily Close > ₹200**
- Filters out penny stocks and low-quality stocks
- Ensures adequate liquidity
- Reduces slippage risk

### Data Source
- **Primary:** ChartInk API (real-time scanner results)
- **Backup:** Fallback to popular large-cap stocks
- **Cache:** Daily cache to reduce API calls
- **Refresh:** Automatic daily refresh at market open

---

## 🎯 Entry Strategy

### When to Enter
1. **Stock appears in ChartInk scanner**
   - Near 52-week high
   - Strong momentum confirmed

2. **Price > ₹200**
   - Adequate liquidity
   - Institutional interest

3. **High Volume**
   - Above average trading volume
   - Confirms genuine interest

4. **Breakout Confirmation**
   - Price breaking resistance
   - Strong closing above breakout level

### Entry Timing
- **Best:** Early morning (9:30 AM - 10:30 AM)
- **Good:** Mid-day consolidation breakouts (11:00 AM - 2:00 PM)
- **Avoid:** Last 30 minutes (3:00 PM - 3:30 PM)

### Position Sizing
- Risk **1-2%** of capital per trade
- Maximum **3-5 positions** simultaneously
- Diversify across sectors

---

## 🛡️ Risk Management

### Stop Loss Strategy
**Two Options:**

1. **Percentage-Based Stop Loss**
   - Set at **3-5%** below entry price
   - Simple and consistent
   - Good for volatile stocks

2. **Technical Stop Loss**
   - Below recent swing low
   - Below breakout level
   - Below key support level
   - More adaptive to price action

### Target Strategy
**Multiple Target Approach:**

1. **Target 1 (50% position):** +5-8%
   - Book partial profits
   - Reduce risk

2. **Target 2 (30% position):** +10-15%
   - Let winners run
   - Capture momentum

3. **Target 3 (20% position):** Trail stop
   - Use trailing stop loss
   - Maximize gains in strong moves

### Risk-Reward Ratio
- **Minimum:** 1:2
- **Target:** 1:3 or better
- **Never trade** if R:R < 1:2

---

## 📈 Technical Analysis

### Key Indicators to Monitor

1. **52-Week High/Low**
   - Distance from 52-week high
   - Breakout confirmation
   - New high = strong momentum

2. **Volume Analysis**
   - Compare to 20-day average
   - Volume spike on breakout
   - Declining volume = caution

3. **Price Action**
   - Higher highs and higher lows
   - Strong closing prices
   - Minimal wicks on daily candles

4. **Support/Resistance**
   - Previous resistance becomes support
   - Round number levels
   - Psychological levels

---

## ✅ Best Market Conditions

This strategy performs **BEST** in:

1. **Bull Market**
   - Overall market trending up
   - Positive sentiment
   - High participation

2. **Sector Rotation**
   - Money flowing into specific sectors
   - Leadership changes
   - Fresh momentum

3. **Breakout Markets**
   - Stocks breaking consolidation
   - New highs being made
   - Strong momentum

4. **High Liquidity**
   - Good trading volumes
   - Tight bid-ask spreads
   - Easy entry/exit

5. **Positive News Flow**
   - Earnings beats
   - Sector tailwinds
   - Positive announcements

---

## ⚠️ Poor Performance Conditions

This strategy performs **POORLY** in:

1. **Bear Market**
   - Overall market declining
   - Negative sentiment
   - False breakouts common

2. **High Volatility**
   - Excessive intraday swings
   - Stop losses hit frequently
   - Unpredictable moves

3. **Low Volume Days**
   - Thin trading
   - Wide spreads
   - Difficult exits

4. **Market Corrections**
   - Broad market selling
   - Momentum stocks hit hardest
   - Risk-off sentiment

5. **News-Driven Gaps**
   - Unexpected negative news
   - Gap downs
   - Panic selling

---

## 🔍 Stock Screening Process

### Step 1: ChartInk Scanner
```
Criteria:
- Close near 52-week high
- Volume > Average
- Price action strong
- Breakout patterns
```

### Step 2: Price Filter
```
Filter: Daily Close > ₹200
Reason: Liquidity and quality
```

### Step 3: Volume Verification
```
Check: Current volume vs 20-day average
Threshold: > 1.2× average (ideally)
```

### Step 4: Technical Confirmation
```
Verify:
- Clean breakout
- No major resistance nearby
- Trend strength
- Sector performance
```

### Step 5: Fundamental Check (Optional)
```
Quick check:
- Recent earnings
- Debt levels
- Promoter holding
- Any red flags
```

---

## 📊 Position Management

### Entry Checklist
- [ ] Stock from ChartInk scanner
- [ ] Price > ₹200
- [ ] Volume above average
- [ ] Clean chart pattern
- [ ] Stop loss identified
- [ ] Target levels set
- [ ] Position size calculated
- [ ] Risk-reward > 1:2
- [ ] Market conditions favorable
- [ ] No major news pending

### Daily Monitoring
1. **Check at Market Open**
   - Any gaps?
   - Pre-market news?
   - Overall market sentiment?

2. **Mid-Day Review**
   - Position P&L
   - Volume trends
   - Price action quality

3. **End of Day**
   - Update stop losses
   - Book partial profits if targets hit
   - Plan for next day

### Exit Rules

**Exit Immediately If:**
- Stop loss hit
- Negative news breaks
- Volume dries up significantly
- Chart pattern breaks down
- Market crashes

**Consider Exiting If:**
- Target 1 reached (book 50%)
- Momentum slowing
- Better opportunities elsewhere
- Holding period > 10 days with no progress

**Trail Stop Loss When:**
- Position up 5%+ (trail to breakeven)
- Position up 10%+ (trail to +5%)
- Position up 15%+ (trail to +10%)

---

## 💡 Trading Tips

### Do's ✅
- **Follow the scanner** - Trust the system
- **Use stop losses** - Always, no exceptions
- **Book partial profits** - Secure gains
- **Keep a journal** - Track all trades
- **Review weekly** - Learn from mistakes
- **Stay disciplined** - Follow the plan
- **Diversify** - Don't put all eggs in one basket

### Don'ts ❌
- **Don't average down** - Cut losses quickly
- **Don't ignore stops** - Respect your risk
- **Don't overtrade** - Quality over quantity
- **Don't chase** - Wait for proper setup
- **Don't hold losers** - Let winners run, cut losers
- **Don't trade on tips** - Do your own analysis
- **Don't revenge trade** - Take a break after losses

---

## 📈 Performance Tracking

### Key Metrics to Track

1. **Win Rate**
   - Target: 50-60%
   - Track monthly
   - Adjust if < 45%

2. **Average Win vs Average Loss**
   - Target: 2:1 or better
   - Ensure winners > losers
   - Key to profitability

3. **Maximum Drawdown**
   - Track peak to trough
   - Should be < 15%
   - Stop trading if > 20%

4. **Profit Factor**
   - Gross Profit / Gross Loss
   - Target: > 2.0
   - Indicates strategy health

5. **Holding Period**
   - Average days held
   - Track by outcome (win/loss)
   - Optimize timing

---

## 🛠️ Implementation Details

### Data Caching
- **Cache Duration:** 24 hours
- **Cache Location:** `server/data/cache/swing_stocks_cache.json`
- **Auto-Refresh:** Daily at first API call
- **Manual Refresh:** Available via force_refresh parameter

### API Integration
- **Primary Source:** ChartInk API
- **Rate Limiting:** Respects API limits
- **Error Handling:** Falls back to cached data
- **Retry Logic:** Automatic retry on failure

### Real-Time Updates
- **Fetch Frequency:** Every 5 minutes during market hours
- **Data Points:** LTP, Volume, 52W High/Low, Change%
- **Sorting:** By volume (descending)
- **Limit:** Top 100 stocks displayed

---

## 📊 Example Trade

### Setup
```
Stock: RELIANCE
Date: June 15, 2026
Entry Price: ₹2,850
52W High: ₹2,865
52W Low: ₹2,150
Volume: 1.5× average
Daily Close: ₹2,848 (> ₹200 ✓)
```

### Trade Plan
```
Entry: ₹2,850
Stop Loss: ₹2,765 (3% below entry)
Risk: ₹85 per share

Target 1: ₹2,993 (5% gain) - Exit 50%
Target 2: ₹3,135 (10% gain) - Exit 30%
Target 3: Trail stop - Exit 20%

Position Size: 100 shares
Capital at Risk: ₹8,500 (2% of ₹4,25,000)
```

### Outcome (Example)
```
Day 1: Entry at ₹2,850
Day 2: Up to ₹2,920 (+2.5%)
Day 3: Hit Target 1 at ₹2,993 - Booked 50% (₹7,150 profit)
Day 4: Consolidated at ₹3,010
Day 5: Hit Target 2 at ₹3,135 - Booked 30% (₹8,550 profit)
Day 6: Trailing stop at ₹3,100 for remaining 20%
Day 7: Trailed out at ₹3,180 (₹6,600 profit)

Total Profit: ₹22,300
Return: 7.8% on capital deployed
Risk-Reward: 1:2.6
```

---

## 🔧 Customization Options

### Scanner Adjustments
- Modify ChartInk scan criteria
- Add fundamental filters
- Adjust 52W high proximity
- Change volume thresholds

### Price Filters
- Adjust minimum price (₹200)
- Add maximum price cap
- Filter by market cap
- Sector-specific filters

### Risk Parameters
- Adjust stop loss percentage
- Modify target levels
- Change position sizing
- Alter max positions

---

## 📚 Additional Resources

### Recommended Books
- "How to Make Money in Stocks" by William O'Neil
- "Momentum Masters" by Mark Minervini
- "Trade Like a Stock Market Wizard" by Mark Minervini

### Related Strategies
- **CANSLIM Method** - William O'Neil's approach
- **Stage Analysis** - Stan Weinstein's method
- **Relative Strength** - Momentum comparison

### Tools
- **ChartInk** - Stock screening
- **TradingView** - Charting and analysis
- **Screener.in** - Fundamental screening

---

## ⚡ Quick Reference

| Aspect | Details |
|--------|---------|
| **Strategy Type** | Momentum/Swing |
| **Timeframe** | Daily (2-10 day holds) |
| **Entry** | 52W high breakout + Volume |
| **Stop Loss** | 3-5% or technical level |
| **Target** | 5-15% in stages |
| **Risk-Reward** | Minimum 1:2 |
| **Position Size** | 1-2% risk per trade |
| **Max Positions** | 3-5 simultaneously |
| **Best Market** | Bull market, high liquidity |
| **Avoid** | Bear market, low volume |

---

## 📝 Trading Journal Template

```
Date: __________
Stock: __________
Entry Price: ₹__________
Entry Time: __________
Entry Reason: __________

Stop Loss: ₹__________
Target 1: ₹__________
Target 2: ₹__________
Target 3: ₹__________

Position Size: __________ shares
Capital at Risk: ₹__________
Risk-Reward: 1:__________

Exit Price: ₹__________
Exit Time: __________
Exit Reason: __________

Profit/Loss: ₹__________
Return %: __________%

What Worked: __________
What Didn't: __________
Lessons Learned: __________
```

---

## 🎓 Learning Path

### Beginner (Weeks 1-4)
1. Understand momentum trading concepts
2. Learn to read ChartInk scanner
3. Practice identifying 52W high breakouts
4. Paper trade for 2 weeks
5. Study winning trades

### Intermediate (Weeks 5-12)
1. Start with small position sizes
2. Focus on risk management
3. Track all trades in journal
4. Review weekly performance
5. Adjust strategy based on results

### Advanced (Weeks 13+)
1. Optimize entry/exit timing
2. Add sector rotation analysis
3. Develop market timing skills
4. Scale position sizes
5. Mentor others

---

## 🚨 Common Mistakes to Avoid

1. **Buying too late** - Wait for pullback after initial breakout
2. **Ignoring volume** - Volume confirms genuine moves
3. **No stop loss** - Always protect capital
4. **Holding too long** - Book profits, don't be greedy
5. **Overtrading** - Quality setups only
6. **Ignoring market** - Trade with the trend
7. **Poor position sizing** - Risk management is key
8. **Emotional trading** - Stick to the plan
9. **Not journaling** - Learn from every trade
10. **Giving up too soon** - Consistency takes time

---

## 📞 Support & Updates

### Cache Management
- Cache file: `server/data/cache/swing_stocks_cache.json`
- Manual refresh: Use `force_refresh=true` parameter
- Cache expiry: 24 hours

### API Status
- Monitor ChartInk API availability
- Fallback to cached data if API fails
- Check logs for API errors

### Strategy Updates
- Review strategy monthly
- Adjust parameters based on market conditions
- Document all changes

---

**Disclaimer:** This strategy is for educational purposes only. Past performance does not guarantee future results. Swing trading involves significant risk. Always do your own research and consider your risk tolerance before trading.

---

*Last Updated: June 2026*
*Version: 1.0*