# ✅ BOT HYBRID DLMM - SIAP TESTING

## Status: READY FOR DRY RUN

Semua perubahan telah diterapkan dan diverifikasi. Bot siap untuk diuji dalam mode dry run.

---

## 📋 API YANG DIPERLUKAN

### WAJIB (Tanpa Biaya):
1. **GeckoTerminal** - OHLCV data (FREE, no key)
2. **DexScreener** - Fallback price data (FREE, no key)  
3. **GMGN.ai** - Security metrics (FREE, web scraping)
4. **RugCheck.xyz** - Token validation (FREE, no key)
5. **Jupiter** - Swap execution (FREE, no key)
6. **Meteora** - DLMM pool interaction (FREE, on-chain)

### OPSIONAL (Recommended):
7. **OpenRouter** - LLM provider (~$1-2/month untuk DeepSeek-V3)
8. **Helius** - Enhanced wallet data (FREE tier available)

---

## 🔧 SETUP LANGKAH DEMI LANGKAH

### 1. Buat File `.env`
```bash
cp .env.example .env
```

### 2. Isi API Keys di `.env`:
```bash
# Wallet (WAJIB)
WALLET_PRIVATE_KEY=your_base58_private_key_here

# LLM Provider (WAJIB untuk screening)
OPENROUTER_API_KEY=sk-or-your_key_here

# Optional tapi recommended
HELIUS_API_KEY=your_helius_key_here

# Mode Testing
DRY_RUN=true
```

### 3. Install Dependencies (jika belum):
```bash
npm install
```

---

## 🧪 TESTING MODE DRY RUN

### Test 1: Technical Analysis Module
```bash
node test/test-fib-strategy.js
```
**Expected Output:**
- ✓ Hard Rules module loaded
- ✓ Technical Analysis module loaded  
- ✓ Position Manager module loaded
- Demo Fib calculation ditampilkan

### Test 2: Screening Module
```bash
node test/test-screening.js
```
**Expected Output:**
- Mock pool validation result
- Hard rules filtering demo

### Test 3: Full Integration (Dry Run)
```bash
node index.js
```
**Expected Behavior:**
- Bot start tanpa error
- Cron jobs berjalan (screening setiap 30 menit)
- Log menampilkan proses screening
- TIDAK ada transaksi nyata (DRY_RUN=true)

---

## 🎯 FITUR YANG SUDAH DIIMPLEMENTASIKAN

### ✅ 1. Migrasi API (Birdeye → GeckoTerminal)
- Primary: GeckoTerminal API (free, no auth)
- Fallback: DexScreener (limited candles)
- Removed: Helius OHLCV dependency
- Removed: Birdeye paid API

### ✅ 2. Bid-Ask Only Mode
- Entry: Single-side SOL only (`amount_x: 0`)
- Strategy: `'bid_ask'` dengan `bins_above: 0`
- Modal tetap 100% SOL sampai harga masuk range

### ✅ 3. Auto-Swap to SOL pada Exit
- Stop Loss: Close position → Swap semua token ke SOL
- Take Profit: Close position → Swap semua token ke SOL
- Slippage: 2% untuk emergency exit
- Semua modal kembali ke SOL otomatis

### ✅ 4. Hard Rules (13 Aturan)
- Market Cap ≥ $400K
- TVL ≤ $100K
- Volume 1m ≥ $1K
- Global Fees ≥ 30 SOL
- DLMM Fee Tier 1-5%
- Sniper ≤ 15%
- Bundler ≤ 60%
- Insider ≤ 30%
- Dev Sold All (wajib)
- Dev Rug History ≤ 50%
- Top 10 Holder <1 SOL maks 3 wallet
- Fresh Wallet check
- Price Deviation ≤ 5%

### ✅ 5. Fibonacci Strategy
- Timeframe: 5 menit
- Entry Zone: Fib 0.5 - 0.786
- Take Profit: 2% minimum
- Stop Loss: Candle close below range bottom
- ATH detection + Swing Low identification

---

## 📁 FILE YANG DIMODIFIKASI

| File | Perubahan | Status |
|------|-----------|--------|
| `tools/technicals.js` | GeckoTerminal API integration | ✅ OK |
| `tools/positionManager.js` | Bid-ask mode + auto-swap | ✅ OK |
| `tools/hardRules.js` | 13 hard rules implementation | ✅ OK |
| `tools/screening.js` | Hard rules integration | ✅ OK |
| `.env.example` | Updated API requirements | ✅ OK |
| `HYBRID_CHANGES.md` | Documentation | ✅ OK |

---

## ⚠️ CATATAN PENTING

### 1. GeckoTerminal API Limitations
- Rate limit: ~30 requests/minute
- Coverage: Tidak semua pool tersedia
- Solusi: Fallback ke DexScreener sudah diimplementasi

### 2. Testing Checklist
Sebelum live run, pastikan:
- [ ] Dry run berhasil tanpa error
- [ ] Screening menemukan kandidat valid
- [ ] Technical analysis detect ATH correctly
- [ ] Fib levels calculated accurately
- [ ] Entry signal muncul saat price in zone
- [ ] Exit trigger bekerja (TP/SL)

### 3. Monitoring
Selama dry run, perhatikan log untuk:
- `[Technical]` - Candle fetching status
- `[HardRules]` - Pool validation results
- `[PositionManager]` - Entry/Exit signals
- `[Screening]` - Candidate selection process

---

## 🚀 NEXT STEPS

1. **Setup .env** dengan API keys Anda
2. **Run dry run tests** (test-fib-strategy.js)
3. **Monitor logs** selama 24 jam
4. **Review hasil** screening dan entry signals
5. **Adjust parameters** jika perlu (config.js)
6. **Switch to live** setelah confident (DRY_RUN=false)

---

## 🆘 TROUBLESHOOTING

### Error: "No candle data available"
- Penyebab: GeckoTerminal tidak support pool tersebut
- Solusi: Cek apakah pool ada di DexScreener, atau tunggu data tersedia

### Error: "API rate limit exceeded"
- Penyebab: Terlalu banyak request ke GeckoTerminal
- Solusi: Tambah delay antar request atau upgrade API tier

### Error: "LLM provider unavailable"
- Penyebab: OpenRouter API key invalid atau quota habis
- Solusi: Cek API key di OpenRouter dashboard, atau gunakan LM Studio lokal

---

## 📞 SUPPORT

Jika menemukan bug atau issue saat testing:
1. Screenshot error log lengkap
2. Catat langkah yang dilakukan sebelum error
3. Cek apakah API keys masih valid
4. Pastikan network connection stabil

**Bot ini 100% siap untuk dry run testing!** 🎉
