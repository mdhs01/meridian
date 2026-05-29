# 🚀 PANDUAN INSTALASI & TESTING BOT MERIDIAN HYBRID
## Untuk Ubuntu 22.04 via MobaXterm

### PRASYARAT SISTEM
- Mini PC dengan Ubuntu 22.04 LTS
- Koneksi internet stabil
- Akses SSH via MobaXterm dari PC utama
- Minimal 2GB RAM, 10GB storage

---

## 📋 LANGKAH 1: INSTALASI DEPENDENCIES

### 1.1 Update Sistem
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Instal Node.js v20 (LTS)
```bash
# Download dan instal NodeSource setup script
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Instal Node.js
sudo apt install -y nodejs

# Verifikasi instalasi
node -v  # Harus menampilkan v20.x.x
npm -v   # Harus menampilkan 10.x.x atau lebih
```

### 1.3 Instal Git (jika belum ada)
```bash
sudo apt install -y git
git --version
```

### 1.4 Instal tmux (untuk session persistent)
```bash
sudo apt install -y tmux
```

---

## 📋 LANGKAH 2: SETUP PROYEK

### 2.1 Clone Repository (jika belum)
```bash
cd ~
git clone <URL_REPOSITORY_ANDA> meridian-bot
cd meridian-bot
```

### 2.2 Instal Dependencies NPM
```bash
npm install
```

### 2.3 Buat File .env
```bash
cp .env.example .env
nano .env
```

### 2.4 Isi File .env dengan Data Anda
```bash
# ── Wallet ───────────────────────────────────────
WALLET_PRIVATE_KEY=your_base58_private_key_here

# ── Solana RPC ───────────────────────────────────
RPC_URL=https://api.mainnet-beta.solana.com
# Atau gunakan RPC premium untuk live:
# RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# ── LLM Provider ─────────────────────────────────
OPENROUTER_API_KEY=sk-or-your_openrouter_key_here

# ── Optional APIs ────────────────────────────────
HELIUS_API_KEY=your_helius_api_key_here
LPAGENT_API_KEY=your_lpagent_api_key_here

# ── Telegram (Optional) ──────────────────────────
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# ── Mode Testing ─────────────────────────────────
DRY_RUN=true
LOG_LEVEL=info
```

**PENTING:** 
- Simpan dengan `Ctrl+O`, `Enter`, lalu `Ctrl+X` di nano
- Untuk Live Trading, ubah `DRY_RUN=false`

---

## 📋 LANGKAH 3: TEST MODUL INDIVIDUAL

### 3.1 Test Koneksi GeckoTerminal (OHLCV Data)
```bash
node test/test-gecko-feed.js
```
**Expected Output:** Data candle real-time tanpa error

### 3.2 Test Screening dengan Hard Rules
```bash
node test/test-screening.js
```
**Expected Output:** List pool yang lolos filter hard rules

### 3.3 Test Analisis Fibonacci
```bash
node test/test-fib-strategy.js
```
**Expected Output:** Deteksi ATH, Swing Low, dan level Fib untuk token sample

### 3.4 Test Agent Loop (LLM Integration)
```bash
node test/test-agent.js
```
**Expected Output:** LLM merespons dengan reasoning yang valid

---

## 📋 LANGKAH 4: JALANKAN BOT (DRY RUN MODE)

### 4.1 Mulai Session tmux (Recommended)
```bash
tmux new -s meridian
```
*Session akan tetap berjalan meski koneksi SSH terputus*

### 4.2 Jalankan Bot
```bash
node index.js
```

### 4.3 Monitor Log
Bot akan menampilkan:
- Status screening setiap 30 menit
- Position management setiap 10 menit
- Health check setiap 60 menit
- Notifikasi saat menemukan setup entry

### 4.4 Detach dari tmux
Tekan `Ctrl+B`, lalu `D`
*Bot tetap berjalan di background*

### 4.5 Re-attach ke tmux
```bash
tmux attach -t meridian
```

### 4.6 Stop Bot
```bash
Ctrl+C
```

---

## 📋 LANGKAH 5: MONITORING & TROUBLESHOOTING

### 5.1 Cek Log Files
```bash
# Lihat log terbaru
tail -f logs/bot.log

# Cari error spesifik
grep "ERROR" logs/bot.log | tail -20
```

### 5.2 Common Issues & Solutions

**Issue: "Cannot find module"**
```bash
npm install
```

**Issue: "OPENROUTER_API_KEY not set"**
- Pastikan file .env sudah dibuat dan diisi dengan benar
- Restart bot setelah edit .env

**Issue: "No candle data from GeckoTerminal"**
- Token mungkin terlalu baru atau tidak terdaftar di GeckoTerminal
- Bot akan otomatis fallback ke DexScreener

**Issue: "Insufficient SOL balance"**
- Pastikan wallet memiliki minimal 0.5 SOL untuk testing
- Dry run tetap butuh saldo untuk simulasi validasi

**Issue: Connection timeout**
- Ganti RPC_URL ke endpoint yang lebih cepat
- Gunakan Helius/QuickNode untuk production

### 5.3 Monitoring Resource
```bash
# Cek penggunaan RAM
htop

# Cek koneksi network
netstat -tuln | grep 3000
```

---

## 📋 LANGKAH 6: TRANSISI KE LIVE TRADING

### 6.1 Persiapan Live
1. Pastikan dry run stabil minimal 24 jam
2. Review semua log dan pastikan tidak ada error kritis
3. Siapkan wallet dengan saldo cukup (minimal 2 SOL recommended)

### 6.2 Ubah Mode ke LIVE
```bash
nano .env
# Ubah: DRY_RUN=false
# Simpan dan restart bot
```

### 6.3 Monitoring Ketat Live Trading
- Pantau log secara real-time: `tail -f logs/bot.log`
- Siapkan manual override jika terjadi anomaly
- Set limit loss harian di `user-config.json`

### 6.4 Emergency Stop
```bash
# Masuk ke tmux session
tmux attach -t meridian

# Stop bot
Ctrl+C

# Atau kill process
pkill -f "node index.js"
```

---

## 📋 TIPS MOBXTERM

### 1. Keep-Alive Connection
Di MobaXterm Settings:
- SSH → Advanced SSH settings
- Enable "SSH keepalive"

### 2. SFTP Browser
- Gunakan panel SFTP di kiri untuk upload/download file
- Drag & drop file .env atau config

### 3. Local Terminal
- Bisa jalankan command dari PC utama via MobaXterm terminal
- Semua session tmux tetap accessible

### 4. Macro Recording
- Record command sequence untuk deploy cepat
- Tools → Macro → Start recording

---

## 📋 CHECKLIST SEBELUM LIVE

- [ ] Semua test modul passed tanpa error
- [ ] Dry run berjalan stabil 24+ jam
- [ ] File .env sudah dikonfigurasi dengan benar
- [ ] Wallet memiliki saldo cukup (min 2 SOL)
- [ ] RPC URL sudah di-set ke endpoint reliable
- [ ] OpenRouter API key aktif dan memiliki kredit
- [ ] Telegram notification sudah ditest (opsional)
- [ ] Memahami cara emergency stop
- [ ] Sudah baca dokumentasi strategi Fib retracement
- [ ] Siap mental untuk risiko trading

---

## 📋 STRUKTUR FILE PENTING

```
/workspace/
├── .env                    # Konfigurasi rahasia (JANGAN commit!)
├── .env.example            # Template .env
├── config.js               # Konfigurasi utama bot
├── user-config.json        # Override konfigurasi user
├── index.js                # Entry point bot
├── agent.js                # LLM agent loop
├── tools/
│   ├── technicals.js       # Analisis Fib & ATH
│   ├── hardRules.js        # Filter keamanan token
│   ├── positionManager.js  # Entry/Exit logic
│   ├── screening.js        # Pool screening
│   └── dlmm.js             # Meteora DLMM interaction
├── test/
│   ├── test-gecko-feed.js  # Test OHLCV data
│   ├── test-screening.js   # Test hard rules
│   └── test-fib-strategy.js # Test fib analysis
└── logs/
    └── bot.log             # Log file bot
```

---

## 📋 SUPPORT & DOKUMENTASI

- README.md - Overview bot
- HYBRID_CHANGES.md - Detail perubahan hybrid
- IMPLEMENTATION_SUMMARY.md - Ringkasan implementasi
- READY_TO_TEST.md - Panduan testing

**Good Luck! Trade responsibly!** 🚀
