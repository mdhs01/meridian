# Fib Retracement DLMM Strategy - Implementation Summary

## ✅ Completed Implementation

### 1. Hard Rules Module (`tools/hardRules.js`)
**Purpose:** Validate all pool candidates against strict security and safety thresholds BEFORE LLM sees them.

**Implemented Rules:**
- ✓ Market Cap ≥ $400K
- ✓ TVL ≤ $100K  
- ✓ Volume 1m ≥ $1,000 (realtime)
- ✓ Total Fees ≥ 30 SOL
- ✓ DLMM Fee Tier 1%-5%
- ✓ Sniper % ≤ 15%
- ✓ Bundler % ≤ 60%
- ✓ Insider % ≤ 30%
- ✓ Dev Must Sell All (true)
- ✓ Dev Rug History ≤ 50%
- ✓ Top 10 Holders: Max 3 wallets < 1 SOL
- ✓ Fresh Wallets (<24h) detection
- ✓ Rugcheck.xyz Status = "Good"
- ✓ Token Age: 2-48 hours

**Usage:**
```javascript
import * as hardRules from './tools/hardRules.js';

// Single validation
const result = await hardRules.validate(poolData);
if (result.passed) { /* proceed to LLM */ }

// Batch validation
const approvedPools = await hardRules.batchValidate(candidatePools);
```

---

### 2. Technical Analysis Module (`tools/technicals.js`)
**Purpose:** Automated ATH detection, Swing Low identification, and Fibonacci calculations on 5m timeframe.

**Key Functions:**
- `fetchCandles(tokenAddress)` - Fetch 5m OHLCV from Birdeye API
- `detectATH(candles)` - Find highest high in lookback period
- `detectSwingLow(candles, athIndex)` - Find support before breakout
- `calculateFibLevels(high, low)` - Calculate 0%, 50%, 78.6%, 100% levels
- `analyzeSetup(tokenAddress)` - Complete technical analysis

**Fibonacci Levels:**
- **0% (ATH):** Breakout point
- **50%:** Entry zone TOP (start deploying liquidity)
- **78.6%:** Entry zone BOTTOM (end of liquidity range)
- **100%:** Swing low (invalidation point)

**Usage:**
```javascript
import * as technicals from './tools/technicals.js';

const setup = await technicals.analyzeSetup(tokenAddress);
// Returns: { status: 'READY_TO_ENTRY' | 'WAITING' | 'BELOW_RANGE', fibLevels, currentPrice }
```

---

### 3. Position Manager (`tools/positionManager.js`)
**Purpose:** Execute entry, monitor positions, and manage exits based on Fib strategy.

**Entry Logic:**
- Deploy single-side SOL liquidity
- Range: 50% - 78.6% Fibonacci retracement
- Capital: Configurable (default 0.5 SOL)

**Exit Conditions:**
1. **Take Profit:** PnL ≥ 2% → Withdraw & swap to SOL
2. **Stop Loss:** 5m candle CLOSE below 78.6% level → Immediate cut loss
3. **Monitor:** Check every 5 minutes

**Key Functions:**
- `shouldEntry(setup)` - Check if entry conditions met
- `executeEntry(poolAddress, setup, wallet, connection)` - Deploy position
- `monitorPosition(position, connection)` - Check exit conditions
- `executeExit(position, action, wallet, connection)` - Close position
- `manageAllPositions(wallet, connection)` - Management loop

---

### 4. Configuration Updates (`config.js`)
**New Screening Parameters:**
```javascript
screening: {
  minMcap: 400_000,        // $400K minimum
  maxTvl: 100_000,         // $100K maximum
  minVolume: 1000,         // $1K per minute realtime
  minTokenFeesSol: 30,     // 30 SOL total fees
  maxBundlePct: 60,        // 60% max bundler
  maxSniperPct: 15,        // 15% max sniper
  maxInsiderPct: 30,       // 30% max insider
  devMustSellAll: true,    // Dev sold all requirement
  maxDevRugPct: 50,        // 50% max dev rug history
  maxFreshWalletsTop10: 3, // Max 3 small wallets in top 10
  minTop10BalanceSol: 1,   // 1 SOL minimum for top holders
  requireRugcheckGood: true,
  minTokenAgeHours: 2,     // 2 hours minimum
  maxTokenAgeHours: 48,    // 48 hours maximum
  dlmmFeeTierMin: 1.0,     // 1% minimum fee tier
  dlmmFeeTierMax: 5.0,     // 5% maximum fee tier
}
```

**New Management Parameters:**
```javascript
management: {
  fibEntryTop: 0.5,        // 50% Fib
  fibEntryBottom: 0.786,   // 78.6% Fib
  targetProfitPercent: 2.0,// 2% take profit
  stopLossBelowRange: true,// Candle close SL
}
```

---

## 🔄 Complete Workflow

### Phase 1: Screening (Every 30 min)
```
1. Fetch new pools from Meteora (age 2-48h)
2. Enrich with GMGN/OKX data (security metrics)
3. HARD RULES VALIDATION ← All-or-nothing filter
4. Shortlist: Only pools that pass ALL rules
5. LLM selects BEST from shortlist (qualitative analysis)
```

### Phase 2: Technical Setup (Continuous)
```
1. For LLM-selected pool, run technical analysis
2. Detect ATH breakout on 5m chart
3. Identify Swing Low before breakout
4. Calculate Fibonacci levels
5. Wait for pullback to 50%-78.6% zone
6. Status: READY_TO_ENTRY when price in zone
```

### Phase 3: Entry Execution
```
1. Check: status === 'READY_TO_ENTRY'
2. Calculate bin range from Fib levels
3. Deploy single-side SOL liquidity
4. Record position in state.json
5. Notify via Telegram
```

### Phase 4: Position Monitoring (Every 5 min)
```
1. Fetch current price (5m candle)
2. Check if candle CLOSE below 78.6% → STOP LOSS
3. Check if PnL ≥ 2% → TAKE PROFIT
4. If neither → HOLD
5. Auto-swap to SOL after exit
```

---

## 📊 Example Scenario

**Token:** $EXAMPLE
- Market Cap: $500K ✓
- TVL: $80K ✓
- Volume 1m: $1,500 ✓
- Fees: 45 SOL ✓
- Sniper: 10% ✓
- Bundler: 40% ✓
- Dev Sold All: Yes ✓
- Rugcheck: Good ✓

**Technical Setup:**
- ATH: $0.00100
- Swing Low: $0.00050
- 50% Fib: $0.00075 (Entry Top)
- 78.6% Fib: $0.000607 (Entry Bottom)
- Current Price: $0.00070 ✓ (IN ZONE)

**Action:** Deploy 0.5 SOL liquidity in range $0.000607 - $0.00075

**Exit Scenarios:**
- Price bounces to $0.00072 (+2.8%) → Take Profit ✓
- Price closes at $0.00059 (below 78.6%) → Stop Loss ✗

---

## 🧪 Testing

Run test suite:
```bash
node test/test-fib-strategy.js
```

Expected output:
- Hard Rules validation working
- Fibonacci calculations correct
- Entry/Exit logic functional

---

## 🔧 Next Steps (Dry Run Mode)

1. **Enable Dry Run:**
   ```bash
   export DRY_RUN=true
   ```

2. **Monitor Logs:**
   ```bash
   tail -f logs/bot.log
   ```

3. **Verify:**
   - Screening rejects bad pools correctly
   - Technical analysis detects setups accurately
   - Entry signals trigger at right time
   - Exit conditions work as expected

4. **Adjust Parameters:**
   - Edit `user-config.json` for fine-tuning
   - No code changes needed for threshold adjustments

---

## ⚠️ Important Notes

1. **LLM Role:** LLM ONLY selects from pre-approved pools. Cannot override hard rules.

2. **Single-Side Risk:** Providing only SOL means you accumulate tokens if price drops. Stop loss is critical.

3. **5m Timeframe:** All analysis uses 5-minute candles. Faster timeframes may give false signals.

4. **API Dependencies:**
   - Birdeye: Candle data
   - GMGN: Security metrics (sniper, bundler, insider)
   - OKX: Fee data, dev history
   - Rughcheck: Audit status
   - Helius: Wallet age (fallback)

5. **Gas Optimization:** Batch operations where possible to minimize SOL spent on fees.

---

## 📁 Files Modified/Created

| File | Status | Purpose |
|------|--------|---------|
| `tools/hardRules.js` | ✅ Created | Hard rule validations |
| `tools/technicals.js` | ✅ Created | TA & Fib calculations |
| `tools/positionManager.js` | ✅ Created | Entry/Exit management |
| `config.js` | ✅ Updated | New screening & management params |
| `test/test-fib-strategy.js` | ✅ Created | Test suite |
| `IMPLEMENTATION_SUMMARY.md` | ✅ Created | This documentation |

---

**Implementation Date:** 2024
**Strategy:** Fib Retracement DLMM (Single-Side SOL)
**Status:** Ready for Dry Run Testing
