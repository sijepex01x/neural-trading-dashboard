# NEURAL Trading Intelligence — Demo Dashboard

Dashboard simulasi trading futuristik berbasis React + TypeScript + Vite. Semua data
adalah **SIMULASI** — bukan harga pasar aktual, bukan saran finansial.

## Fitur

- **Neural Particle Sphere** (Canvas 2D, tanpa library 3D): rotasi berbasis delta-time,
  DPR-aware, pause saat tab tersembunyi / engine di-pause, hormat `prefers-reduced-motion`,
  parallax tilt mengikuti mouse, core glow, garis koneksi antar partikel, jumlah partikel
  dibatasi luas canvas.
- **Market engine simulasi** (`src/lib/simulation.ts`): seeded pseudo-random walk
  (mulberry32, tanpa `Math.random`) untuk BTC / ETH / SOL / BNB, deret OHLC per rentang
  1H / 4H / 1D / 1W / 1M, RSI (14), MACD (12/26/9), Bollinger Bands (20, 2σ), dan
  gauge sentimen Fear/Greed — semuanya dihitung dari data simulasi.
- **Price chart** (Canvas): garis harga + area fill, volume bar, trendline AI (regresi
  linear), toggle Bollinger Bands, crosshair + tooltip (O/H/L/C, volume, waktu),
  label sumbu-Y otomatis mengikuti harga, tombol rentang 1H–1M yang semuanya bekerja.
- **Market Analysis**: panel indikator (RSI dengan zona overbought/oversold, MACD +
  histogram, Bollinger, gauge sentimen) + daftar aset yang bisa dipilih.
- **AI Strategy**: tiga strategi (Neural Scalper / Momentum Rider / Mean Reversion),
  slider risiko (5–90%) dan confidence threshold (50–99%), pause/resume engine,
  feed sinyal AI live (diturunkan dari RSI/MACD, berlabel demo), dan tabel backtest
  simulasi per strategi.
- **Simulated trading**: pilih pair, input jumlah USD (divalidasi, tidak boleh melebihi
  saldo simulasi), tombol BUY/SELL membuka posisi, tabel posisi dengan unrealized P&L
  live + tombol CLOSE, saldo dan ekuitas terhitung nyata dari kas + posisi + riwayat.
- **Trade History**: filter (side, pair, pencarian), kolom bisa di-sort, export CSV
  (download sisi klien), clear history dua langkah.
- **Statistik live**: nilai portofolio, total P&L, win rate, posisi aktif — semuanya
  dihitung dari state simulasi dan berubah saat trading terjadi.
- **Persistensi demo**: kas, posisi, dan riwayat tersimpan di `localStorage`
  (kunci `nti-demo-v1`); tombol **RESET DEMO** mengembalikan keadaan awal.
- **Responsif**: grid 3 kolom desktop, 2 kolom tablet, 1 kolom mobile; sidebar menjadi
  nav horizontal di layar kecil; target sentuh ≥ 44px; tidak ada overflow horizontal
  pada lebar 360px.
- **Aksesibilitas & polish**: transisi ringan antar tab/panel, `:focus-visible`,
  `aria-label`/`aria-pressed` pada kontrol, boot skeleton singkat, nol error konsol,
  nol error TypeScript (strict).

## Menjalankan

Persyaratan: Node.js 20.19+ atau 22.12+.

```bash
npm install
npm run dev      # server dev Vite, buka alamat yang ditampilkan
```

## Build production

```bash
npm run build    # tsc -b (strict) + vite build → folder dist/
npm run preview  # sajikan hasil build, buka alamat yang ditampilkan
```

## Pengujian

Lihat [TEST-REPORT.md](./TEST-REPORT.md) untuk hasil pengujian aktual (build,
preview + curl, uji engine, smoke test browser, dan pemeriksaan responsif).
Jangan menyatakan PASS sebelum semua pengujian di laporan tersebut benar-benar
berjalan dan lolos.

## Struktur folder

```
index.html
package.json
tsconfig.json
vite.config.ts
TEST-REPORT.md
src/
  main.tsx                 entry point React
  style.css                tema visual + responsive (satu stylesheet)
  vite-env.d.ts            referensi tipe vite/client
  App.tsx                  komposisi view + seluruh shared state (engine,
                           portofolio, trading, sinyal, persistensi)
  lib/
    types.ts               tipe bersama (Side, Candle, Position, Trade, ...)
    format.ts              format uang / persen / waktu
    simulation.ts          market engine simulasi + indikator + sinyal
  components/
    NeuralOrb.tsx          particle sphere (Canvas)
    Sparkline.tsx          sparkline SVG dari array nilai
    StatCards.tsx          4 kartu statistik
    AssetList.tsx          daftar aset + pilih pair
    PriceChart.tsx         grafik harga (Canvas) + tooltip + Bollinger
    IndicatorsPanel.tsx    RSI / MACD / Bollinger / gauge sentimen
    StrategyPanel.tsx      pilih strategi + slider risiko/confidence + sinyal
    TradePanel.tsx         form order + tabel posisi terbuka
    SignalFeed.tsx         feed sinyal AI
    TradeHistory.tsx       tabel riwayat + filter/sort/CSV/clear
    Sidebar.tsx            navigasi + status sistem
    Topbar.tsx             breadcrumb + badge live + tanggal
scripts/
  engine-test.ts           uji unit engine simulasi (dijalankan via esbuild)
```

## Catatan keamanan dan kejujuran data

Semua harga, sinyal AI, portofolio, transaksi, P&L, indikator, dan performa dalam
proyek ini adalah **DATA DEMO / SIMULASI**. Tombol BUY/SELL hanya mengubah state
simulasi di memori browser (dan `localStorage`); tidak ada koneksi exchange, wallet,
API trading, API key, atau eksekusi order sungguhan. Tidak ada network call ke
sumber data pasar — satu-satunya permintaan eksternal adalah `@import` Google Fonts
di `style.css`, dan aplikasi tetap bekerja offline berkat font fallback sistem.
Tulisan "SIMULATED DATA — NOT FINANCIAL ADVICE" tampil di footer dan di dekat
harga/sinyal.

## Bugs found & fixed

- **Tab navigasi tidak mengganti konten** — keempat tab merender grid yang sama dan
  hanya judul berubah. Diperbaiki: tiap tab kini merender view sendiri (Overview /
  Market Analysis / AI Strategy / Trade History).
- **Label sumbu-Y grafik hardcoded** (68.000 / 67.500 / …) sementara harga bergerak,
  dan data grafik mengabaikan rentang yang dipilih. Diperbaiki: grafik Canvas dengan
  deret OHLC per rentang dari engine simulasi dan label sumbu otomatis dari min/max.
- **Trading tidak mengubah apa pun** — P&L acak, jumlah tetap, saldo/portofolio/
  win-rate statis. Diperbaiki: kas, posisi, ekuitas, realized/unrealized P&L, dan
  win rate semuanya dihitung dari state; CLOSE merealisasikan P&L.
- **Double-count realized P&L saat CLOSE** (ditemukan saat integrasi): closing leg
  dan trade pembuka sama-sama mencatat realized P&L, sehingga total dan win rate
  terhitung dua kali. Diperbaiki: closing leg mencatat `pnl: null`; realized P&L
  hanya tercatat sekali pada trade pembuka yang ditandai CLOSED.
- **Close-after-reload membiarkan trade tetap OPEN** (BUG-1, ditemukan worker
  pengujian via Playwright, lalu diperbaiki + diuji ulang 21/21): `openTradeIds`
  hanya ada di memori, jadi setelah reload `closePosition` tidak menemukan trade
  pembuka dan realized P&L tidak pernah tercatat. Diperbaiki: `Trade` kini
  membawa `positionId` yang bertahan di `localStorage`; close menyelesaikan
  trade lewat map memori, `positionId` persisten, atau pencocokan field
  (untuk state lama).
- **Tombol strategy picker menempel** (BUG-2): nama dan deskripsi strategi
  tampil menyatu. Diperbaiki: span deskripsi kini `display:block` dengan warna
  redup.
- **Tombol CLOSE 32px** (OBS-3): target sentuh di bawah 44px di mobile.
  Diperbaiki: `.table-wrap .text-btn` menjadi 44px pada lebar ≤ 650px.
- **`@types/react` / `@types/react-dom` hilang** dari starter sehingga `tsc`
  gagal. Ditambahkan sebagai devDependencies.
- **`src/vite-env.d.ts` hilang** sehingga impor `./style.css` di `main.tsx` tidak
  bisa dicek tipenya. Ditambahkan (`/// <reference types="vite/client" />`).
- **Asumsi bandwidth Bollinger tidak konsisten** antara panel indikator dan engine —
  diverifikasi: engine mengembalikan fraksi `(upper − lower) / middle` dan panel
  mengalikannya 100 menjadi persen. Tidak ada perubahan kode yang diperlukan.
- **Orb animasi boros & kaku** — tanpa delta-time, tanpa DPR handling saat resize,
  tanpa pause. Diperbaiki: delta-time, ResizeObserver, pause saat hidden/di-pause,
  `prefers-reduced-motion`, dan batas partikel menurut luas canvas.
- **Form trading tanpa validasi** (tanpa input jumlah, tanpa batas saldo).
  Diperbaiki: input jumlah + validasi (angka, > 0, ≥ $10, ≤ saldo simulasi).
