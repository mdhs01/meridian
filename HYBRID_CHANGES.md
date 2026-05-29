# Perubahan Hybrid DLMM Bot - Dokumentasi Lengkap

## Ringkasan Perubahan

Bot telah diubah dari sistem otonom penuh menjadi **Hybrid System** dengan pendekatan "Guardrailed Autonomy" yang menggabungkan:
1. **Hard Rules** untuk keamanan dan filter matematis
2. **LLM** hanya untuk analisis kualitatif dan naratif
3. **Technical Analysis** berbasis Fibonacci untuk timing entry/exit

---

## 1. Migrasi API: Birdeye → Helius/DexScreener

### File: `tools/technicals.js`

**Perubahan:**
- ✅ Menghapus dependency ke Birdeye API (berbayar)
- ✅ Menggunakan **Helius Enhanced API** sebagai sumber utama (gratis tier developer)
- ✅ Fallback ke **DexScreener API** (gratis, no auth)
- ✅ Fungsi `buildCandlesFromTransactions()` untuk membangun candle dari data transaksi on-chain

**API yang Diperlukan:**
```env
HELIUS_API_KEY=your_helius_api_key_here
```

**Keuntungan:**
- Gratis untuk penggunaan dasar (Helius memberikan 100 req/hari gratis)
- Data lebih akurat karena langsung dari on-chain
- Tidak perlu subscription berbayar

---

## 2. Update Bid-Ask Only Mode

### File: `tools/positionManager.js`

**Perubahan Utama:**

#### A. Entry Strategy (Single-Side SOL)
```javascript
// Deploy position dengan strategy='bid_ask'
const result = await deployPosition({
    pool_address: poolAddress,
    amount_y: capitalAmount,  // SOL side only
    amount_x: 0,              // No base token
    strategy: 'bid_ask',      // Bid-Ask mode
    bins_below: binConfig.estimatedBinCount,
    bins_above: 0             // Pure bid side
});
```

**Cara Kerja:**
- Hanya menyetor **SOL** ke pool DLMM
- Likuiditas ditempatkan di sisi **BID** (beli)
- Token base hanya didapat ketika harga turun ke range entry
- Modal tetap 100% dalam SOL sampai terjadi fill

#### B. Exit Strategy (Auto-Swap to SOL)
```javascript
// CRITICAL: Auto-swap semua token ke SOL setelah close
const swapResult = await swapToSOL({
    inputMint: position.tokenAddress,
    amount: tokenAmount,
    slippageBps: 200 // 2% slippage untuk emergency exit
});
```

**Flow Exit:**
1. Close position → withdraw SOL + token
2. **AUTO-SWAP** semua token ke SOL (via Jupiter)
3. Update state dengan total SOL returned
4. Hitung PnL akhir

**Keuntungan:**
- Proteksi modal maksimal saat stop loss
- Tidak ada sisa token yang tertahan
- Semua kembali ke SOL untuk deployment berikutnya

---

## 3. Prompt LLM - Alasan Perubahan

### Mengapa Prompt Harus Diubah?

**Role LLM Sebelumnya:**
- ❌ Trader & Analis Teknikal (berisiko tinggi halusinasi)
- ❌ Menghitung level entry/exit
- ❌ Memutuskan kapan entry berdasarkan feeling

**Role LLM Sekarang:**
- ✅ Quality Control & Narrator
- ✅ Analisis konteks pasar dan sentimen
- ✅ Validasi kualitas holder dan naratif token
- ✅ **TIDAK BOLEH** menghitung angka atau level teknikal

**Alasan Perubahan:**

1. **Mencegah Halusinasi**
   - LLM buruk dalam matematika dan koordinat harga
   - Sering "mengarang" level support/resistance
   - Tidak bisa membaca chart secara akurat

2. **Pemisahan Tugas yang Jelas**
   - **Hard Code**: ATH detection, Fib calculation, candle analysis
   - **LLM**: Holder quality assessment, narrative analysis, market sentiment

3. **Konsistensi Strategi**
   - Entry selalu di Fib 0.5-0.786 (hardcoded)
   - Exit selalu TP 2% atau SL candle close below range
   - LLM tidak boleh mengubah aturan ini

4. **Debugging Lebih Mudah**
   - Jika entry salah → cek kode teknikal, bukan prompt
   - Jika token scam lolos → cek hard rules, bukan LLM decision

**Contoh Prompt Baru:**
```
"Tugas Anda adalah menganalisis KUALITAS pemegang token dan NARATIF proyek.
JANGAN menghitung level harga atau menentukan timing entry.

Data teknis (ATH, Fibonacci, dll) sudah dihitung oleh sistem.
Fokus Anda pada:
1. Apakah top holders adalah smart money atau wallet fresh?
2. Apakah naratif token masuk akal atau sekadar hype?
3. Apakah ada red flag dalam distribusi token?

Output: Skor 1-10 + penjelasan singkat."
```

---

## 4. Struktur Hard Rules (13 Aturan Wajib)

### File: `tools/hardRules.js`

**A. Market & Liquidity:**
1. Market Cap ≥ $400K
2. TVL ≤ $100K
3. Volume 1m ≥ $1K
4. Total Global Fees ≥ 30 SOL
5. DLMM Fee Tier 1%-5%

**B. Security & Holder:**
6. Sniper % ≤ 15%
7. Bundler % ≤ 60%
8. Insider % ≤ 30%
9. Dev Status: Wajib "Sold All"
10. Dev Rug History ≤ 50%
11. Top 10 Holder: Max 3 wallet <$1 SOL
12. Fresh Wallet Check (umur <24 jam reject)
13. Rugcheck.xyz: Status wajib "Good"

**Logika:** AND logic → Jika SATU rule gagal = REJECT

---

## 5. Technical Analysis Flow

### File: `tools/technicals.js`

**Deteksi Setup:**
1. **ATH Detection** → Cari harga tertinggi dalam 100 candle terakhir
2. **Swing Low Detection** → Cari support sebelum breakout ATH
3. **Fibonacci Calculation** → Hitung level 0%, 38.2%, 50%, 61.8%, 78.6%, 100%
4. **Entry Zone** → Area antara Fib 50% - 78.6%
5. **Status Monitoring:**
   - `READY_TO_ENTRY`: Harga dalam zone entry
   - `PULLBACK_PENDING`: Harga di atas zone, menunggu pullback
   - `BELOW_RANGE`: Harga sudah jatuh di bawah zone (invalid)

**Timeframe:** 5 menit (sesuai kesepakatan)

---

## 6. Position Management Flow

### File: `tools/positionManager.js`

**Entry Conditions:**
- ✅ Breakout ATH sudah terjadi
- ✅ Pullback ke Fib zone (0.5 - 0.786)
- ✅ Status = READY_TO_ENTRY
- ✅ LLM validasi kualitas token

**Exit Conditions:**
- ✅ **Take Profit**: PnL ≥ 2%
- ✅ **Stop Loss**: Candle 5m CLOSE di bawah Fib 0.786
- ⚠️ Price di bawah range TAPI belum close candle → WAIT (tidak exit dulu)

**Monitoring Interval:** 5 menit (setiap candle close)

---

## 7. Testing & Dry Run

### Cara Menjalankan Dry Run:

1. **Setup Environment:**
```bash
cp .env.example .env
# Edit .env dengan API keys Anda
HELIUS_API_KEY=xxx
OPENROUTER_API_KEY=xxx
WALLET_PRIVATE_KEY=xxx
RPC_URL=https://api.mainnet-beta.solana.com
DRY_RUN=true
```

2. **Jalankan Bot:**
```bash
node index.js
```

3. **Test Screening Manual:**
```bash
node test/test-screening.js
```

4. **Test Fibonacci Strategy:**
```bash
node test/test-fib-strategy.js
```

**Mode DRY_RUN:**
- ✅ Mensimulasikan semua proses
- ✅ Logging lengkap setiap step
- ❌ TIDAK mengirim transaksi on-chain
- ❌ TIDAK deploy posisi nyata
- ❌ TIDAK swap token nyata

---

## 8. API yang Harus Disiapkan

| API | Purpose | Cost | Status |
|-----|---------|------|--------|
| **Helius** | OHLCV data, wallet balances | Free tier | ✅ WAJIB |
| **GMGN.ai** | Sniper/Bundler/Insider data | Free (scrape) | ✅ WAJIB |
| **RugCheck.xyz** | Token security validation | Free | ✅ WAJIB |
| **Jupiter** | Swap execution, price aggregation | Free | ✅ WAJIB |
| **Meteora** | DLMM pool interaction | Free (on-chain) | ✅ WAJIB |
| **OKX Web3** | Fallback data | Free | ⚪ OPSIONAL |
| **OpenRouter** | LLM access (DeepSeek-V3) | ~$1-2/bln | ✅ WAJIB |

**Rekomendasi LLM:**
- **Primary:** DeepSeek-V3 via OpenRouter ($0.14/1M tokens)
- **Fallback:** Google Gemini 1.5 Flash (free tier terbatas)

---

## 9. Perbedaan vs Meridian Original

| Aspek | Meridian Original | Hybrid Bot (Kita) |
|-------|------------------|-------------------|
| **Entry Decision** | LLM decide semua | Hard rules → LLM select → Technicals timing |
| **Security Filter** | OKX flags saja | 13 hard rules wajib |
| **Technical Analysis** | Tidak ada | Fibonacci + ATH + Swing Low |
| **Liquidity Type** | Dual-side (SOL+Token) | Single-side SOL (Bid-Ask) |
| **Exit Strategy** | LLM decide | Rule-based (TP 2%, SL candle close) |
| **Data Source** | Birdeye (paid) | Helius/DexScreener (free) |
| **Risk Level** | Tinggi (LLM halu) | Terkontrol (guardrailed) |

---

## 10. Checklist Sebelum Live Trading

- [ ] Dapatkan Helius API Key (https://helius.dev)
- [ ] Dapatkan OpenRouter API Key (https://openrouter.ai)
- [ ] Test dry run minimal 10 siklus screening
- [ ] Verifikasi deteksi ATH dan Fib level akurat
- [ ] Confirm auto-swap berfungsi di dry run
- [ ] Set DEFAULT_POSITION_SIZE_SOL di config.js
- [ ] Backup wallet private key di tempat aman
- [ ] Start dengan DRY_RUN=true minimal 1 minggu
- [ ] Monitor log untuk false positive/negative
- [ ] Adjust hard rules jika terlalu ketat/longgar

---

## 11. Troubleshooting Umum

**Problem:** "No candle data available"
- **Solusi:** Cek HELIUS_API_KEY valid, atau gunakan fallback DexScreener

**Problem:** "Pool not found" 
- **Solusi:** Pastikan pool_address format benar (base mint address)

**Problem:** "Swap failed"
- **Solusi:** Cek slippageBps (naikkan ke 300-500 untuk token volatil)

**Problem:** LLM tidak merespons
- **Solusi:** Cek OPENROUTER_API_KEY, pastikan credit cukup

---

## 12. Next Steps (Future Improvements)

1. **Order Block Detection** - Tambahkan pattern recognition untuk OB
2. **Multi-Timeframe Analysis** - Konfirmasi setup di 15m/1h
3. **Dynamic Position Sizing** - Adjust size berdasarkan volatility
4. **Trailing Stop Loss** - Geser SL saat profit berjalan
5. **Fee Compounding** - Reinvest fee otomatis
6. **Telegram Alerts** - Notifikasi real-time untuk entry/exit

---

**Catatan Penting:**
Dokumentasi ini dibuat untuk referensi internal tim development. Selalu test di dry run sebelum live trading. Bot ini melibatkan risiko finansial - gunakan hanya dana yang siap hilang.

**Version:** 1.0
**Last Updated:** 2024
**Status:** Ready for Dry Run Testing
