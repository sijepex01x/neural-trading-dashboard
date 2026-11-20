# TEST REPORT — NEURAL TRADING INTELLIGENCE dashboard

- **Date:** Friday, 20 November 2026 (WIB, UTC+7)
- **Project dir:** `/home/hatch/workspace/neural-trading-dashboard/`
- **Tester:** worker D (testing + test report). No files under `src/` were edited.
- **Environment:** Node v24.22.1, npm 10.9.4, Vite 8.3.8 (rolldown), React 19, TypeScript (via `tsc -b`).
  No system Chromium/Firefox. Playwright was installed during this run (see §3):
  `playwright` 1.65.1 as a devDependency + Chromium Headless Shell 159.0.8154.6
  in `~/.cache/ms-playwright/`. No network calls to real market APIs anywhere;
  all data is simulated.
- **Files created by this run (allowed: `scripts/` only, plus this report):**
  - `scripts/logic-smoke.ts` — §5 logic assertions (esbuild-bundled to `/tmp/nti-logic-smoke.mjs`)
  - `scripts/browser-smoke.mjs` — §3 Playwright smoke test (spawns its own preview on port 4174)
  - `package.json` / `package-lock.json` — `playwright@^1.65.1` added to devDependencies
    (left installed, as instructed for temp dev deps)
  - Screenshots: `/tmp/nti-820.png` (820×2847, 663,773 B), `/tmp/nti-390.png` (390×3159, 488,718 B)

---

## 1) Static gates — PASS

### 1a. `npx tsc --noEmit`
- **Command:** `npx tsc --noEmit` (from project dir)
- **Observed output:** (no output) `tsc exit: 0`
- **Result:** PASS

### 1b. `npm run build`
- **Command:** `npm run build`
- **Observed output (trimmed):**
  ```
  > neural-trading-dashboard@1.0.0 build
  > tsc -b && vite build
  vite v8.3.8 building client environment for production...
  ✓ 30 modules transformed.
  dist/index.html                   0.52 kB │ gzip:  0.34 kB
  dist/assets/index-Cze03twa.css   17.59 kB │ gzip:  4.72 kB
  dist/assets/index-7etxYspz.js   268.88 kB │ gzip: 83.74 kB
  ✓ built in 364ms
  build exit: 0
  ```
- **Result:** PASS — asset hashes identical to the pre-existing build
  (`index-7etxYspz.js`, `index-Cze03twa.css`).

### 1c. Engine test
- **Command:**
  `npx -y esbuild scripts/engine-test.ts --bundle --platform=node --format=esm --outfile=/tmp/nti-engine-test.mjs && node /tmp/nti-engine-test.mjs`
- **Observed output:**
  ```
  PASS (a) createEngine determinism
  PASS (b) getCandles counts, ordering, OHLC invariants, last close == price
  PASS (c) tickEngine changes prices, grows closes, rolls cached series
  PASS (d) RSI in [0,100], rising > 60, falling < 40
  PASS (e) MACD rising lastHist > 0
  PASS (f) Bollinger upper > middle > lower
  PASS (g) deriveSignal action/confidence valid, threshold softening works
  PASS (h) format.money/fmtPct/fmtCompact
  ALL ENGINE TESTS PASSED
  ```
  Exit 0.
- **Result:** PASS (8/8)

---

## 2) Preview + HTTP — PASS

Preview started with `nohup npm run preview -- --port 4173 --strictPort`
(log `/tmp/nti-preview.log`), served, then killed after the checks
(verified no listener left on 4173/4174 afterwards).

| Check | Command / observation | Result |
|---|---|---|
| Root 200 + `#root` + JS path | `curl -s http://localhost:4173/` → 200; body contains `<div id="root">` and `src="/assets/index-7etxYspz.js"` (filename read from `dist/index.html`, not hardcoded) | PASS |
| JS bundle 200 | `curl -s -o /dev/null -w "%{http_code} %{size_download}" http://localhost:4173/assets/index-7etxYspz.js` → `js:200 size:268889` | PASS |
| CSS asset 200 | `curl ... /assets/index-Cze03twa.css` → `css:200 size:17594` | PASS |
| External URLs in dist CSS | Only `https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap` — the allowed Google Fonts `@import` (`src/style.css:1`; system-font fallback `font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif` in `src/style.css:2`) | PASS |
| External URLs in dist JS | Only `http://www.w3.org/...` namespace strings and `https://react.dev/errors/` — no market-API hosts | PASS |
| `fetch(` / `XMLHttpRequest` / `api.` in dist JS | Exactly **one** `fetch(` match: Vite's modulepreload polyfill (`fetch(e.href, n)` for the app's own JS module) — **not** a market-API call. Zero `XMLHttpRequest`, zero `api.` matches. `grep -rn 'fetch(\|XMLHttpRequest\|axios' src/` → no matches in source. | PASS |

**Environmental note (not a fail):** this VM's proxy blocks `fonts.googleapis.com`
(`net::ERR_TUNNEL_CONNECTION_FAILED`; the font stylesheet fails to load in the
browser test too — see §3). The app renders correctly on its system-font
fallback; see the 390px screenshot verification in §3.

---

## 3) Real browser render (Playwright Chromium) — FAIL (1 item: 7c)

### 3.0 Install saga (recorded honestly)
- `npx -y playwright@latest install chromium --with-deps` — **hung**: the process
  sat in `apt-get update` for ~15 minutes with no progress (observed via `ps`:
  `apt-get update` + `_apt` http/https helpers, no output). Killed.
- `npx -y playwright@latest install chromium` (plain) — **succeeded**, exit 0:
  FFmpeg v1013 + Chrome Headless Shell 159.0.8154.6 downloaded to
  `~/.cache/ms-playwright/` (`chromium-1255`, `chromium_headless_shell-1255`,
  `ffmpeg-1013`).
- First smoke run failed immediately: `Cannot find package 'playwright'` —
  `npx install` downloads browsers only, not the npm package. Fixed by
  `npm i -D playwright@latest` (1.65.1, left installed; see header).
- Second smoke run failed on a **test-script selector bug** (mine, not the app):
  `getByRole('button', { name: 'Overview', exact: true })` timed out because
  the accessible name is `◈ Overview` (glyph included, `src/components/Sidebar.tsx:30-35`).
  Fixed to non-exact match. A stale preview on port 4174 from that aborted run
  also had to be killed (killing `npm` does not kill the vite child — the script
  now spawns detached and kills the process group).
- **Final script:** `scripts/browser-smoke.mjs` — spawns its own preview on port
  4174, drives Chromium at 1440×900, then 820px and 390px. Run 3 times total
  after fixes; the final run's full log is at `/tmp/nti-browser-smoke-final.log`.

### 3.1 Final run results (`node scripts/browser-smoke.mjs`, exit 1 — 20/21 checks pass)

```
PASS (1)   boot skeleton clears, Market Overview h1 visible
PASS (2a)  Market Analysis tab shows 'Market Indicators'
PASS (2b)  AI Strategy tab shows 'Live AI Signal Feed'
PASS (2c)  Trade History tab shows 'Trade History' + filters
PASS (2d)  back to Overview tab, Market Overview h1 visible
PASS (3)   range 1D selected, chart canvas visible
PASS (3b)  1D range button has selected state
PASS (4)   risk slider moves — 35 -> 55
PASS (5)   SIMULATE BUY $100 -> open position row with CLOSE button
PASS (5b)  position persisted to localStorage (nti-demo-v1)
PASS (6)   reload: open position persists from localStorage
PASS (7a)  CLOSE shows notice with realized P&L — "Closed BUY position BTC — realized P&L +$0.07 (simulated)"
INFO       TOTAL P&L before close: +$108.36 | after close: +$108.36 (continuity expected: close converts
           unrealized -> realized 1:1, App.tsx:288-295)
PASS (7b)  CLOSE removes the open position row
INFO       first history row (time-desc sort; seed trades are stamped later in the day, so they sort first):
           BTC / USDT BUY $67,420.50 0.024 $1,618.09 14:32:08 +$42.18 CLOSED
FAIL (7c)  OUR trade ($100.00) shows as CLOSED after close —
           BTC / USDT BUY $67,375.29 0.001484 $100.00 08:48:48 — OPEN
PASS (8)   reload: trade history persists from localStorage — 7 rows (5 seed + closed trade)
PASS (9a)  RESET DEMO clears open positions
PASS (9b)  RESET DEMO restores $25,000.00 portfolio — $25,000.00
PASS (820px) no horizontal overflow — scrollWidth=820 innerWidth=820
INFO       screenshot saved: /tmp/nti-820.png
PASS (390px) no horizontal overflow — scrollWidth=390 innerWidth=390
INFO       screenshot saved: /tmp/nti-390.png
INFO       Google Fonts load failures (environmental, VM proxy blocks fonts.googleapis.com): 4
PASS (10a) zero console errors (excl. blocked Google Fonts) — none (4 resource-load echoes of the blocked font stylesheet)
PASS (10b) zero page errors — none
PASS (10c) zero failed requests (excl. blocked Google Fonts) — none
1 BROWSER SMOKE TEST(S) FAILED
```

- **(7c) reproduced twice** (08:48:07 run and 08:48:48 run, same stale `OPEN` row).
  See **BUG-1** below — a real app bug, not a test artifact.
- **Methodology note:** in the first full run, (7c) checked only the *first*
  history row and passed trivially on a seed trade (seed trades are stamped
  13:20–14:32, later than the test's morning trades, so they sort first under
  time-desc). The assertion was strengthened to match our own `$100.00` trade
  row; that is what exposed BUG-1. The weak first-run (7c) PASS is retracted.
- **(10a) classification:** the 4 console errors are all
  `Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED` — the console
  echo of the 4 blocked Google Fonts stylesheet requests (one per page load).
  The script attributes `Failed to load resource` console errors to the font
  failure only up to the font-failure count (4 == 4); any other console error
  text would still fail the gate. No other console errors occurred.
- **Screenshots:** `/tmp/nti-820.png` (820×2847) and `/tmp/nti-390.png`
  (390×3159). The 390px screenshot was viewed: single-column layout, all
  panels legible, "Demo reset to initial state." notice, portfolio $25,000.00,
  TOTAL P&L +$108.36, chart with AI trendline, trade form with amount 100 —
  renders correctly. It also shows BUG-2 (strategy picker text runs together).

**Section 3 result:** FAIL — one item (7c) fails on a genuine app bug.

---

## 4) Responsive CSS static check — PASS

`src/style.css` (46 lines, one rule per line):

| Check | Observation | Result |
|---|---|---|
| Breakpoints 1050 / 820 / 650 / 390px | `@media(max-width:1050px)` line 42; `@media(max-width:820px)` line 43; `@media(max-width:650px)` line 44; `@media(max-width:390px)` line 45 (plus `@media(min-width:1051px)` desktop grid, line 9) | PASS |
| No fixed `width:` > 360px on layout containers | Largest fixed widths: `.sidebar{width:238px}` (line 7), `.content{max-width:1500px}` (max-width, not fixed), `.boot-block{width:min(680px,86vw)}` (viewport-capped), `body{min-width:320px}`. No fixed `width:` above 360px anywhere. | PASS |
| Touch targets ≥ 44px in the ≤650px block (line 44) | `.sidebar .nav{min-height:44px}`; `.ranges button{min-height:44px}`; `.trade-buttons button` 44px (global rule, line 7 block); `.trade-form select/input` 44px (global); `.filters .filter-group button{min-height:44px}`; `.icon-btn{min-height:44px}`; `.strategy-picker button{min-height:44px}` (global) | PASS |

Notes (not failures): `.ranges button` base is 32px and `.filter-group button`
base is 36px — both are raised to 44px only inside the ≤650px block, so at
651–1050px they are below the 44px guideline. `.text-btn` (incl. the CLOSE
position button) is 32px at all widths — see OBS-3.

---

## 5) Interaction logic check (node, no browser) — PASS

- **Script:** `scripts/logic-smoke.ts` (bundled with esbuild to
  `/tmp/nti-logic-smoke.mjs`).
- **Command:**
  `npx -y esbuild scripts/logic-smoke.ts --bundle --platform=node --format=esm --outfile=/tmp/nti-logic-smoke.mjs && node /tmp/nti-logic-smoke.mjs`
- **Formulas replicated from `src/App.tsx`** (read lines 240–460):
  - `executeTrade` — `src/App.tsx:376-410`: `qty = value / price` (line 385);
    BUY `cash -= value`, SELL `cash += value` (line 409).
  - `closePosition` — `src/App.tsx:412-460`: realized = BUY
    `(price - entryPrice) * qty` else `(entryPrice - price) * qty`
    (lines 418-420); BUY close `cash += qty * price`, SELL close
    `cash -= qty * price` (lines 427-429).
  - `equity` — `src/App.tsx:274-280`: `cash + Σ(BUY ? qty*price : -qty*price)`.
  - `unrealizedPnl` — `src/App.tsx:264-273`.
  - `INITIAL_CASH` — `src/App.tsx:31`: 25000.
  - `RANGES` — `src/lib/simulation.ts:31-34`: `1H = 60` candles, `1D = 96`.
- **Observed output (BTC price at run time $67,420.50):**
  ```
  PASS (1a) BUY cash 25000 - 100 = 24900 — cash=24900
  PASS (1b) BUY qty = 100/price — qty=0.0014832283949243925 price=$67,420.50
  PASS (1c) BUY equity unchanged at open — equity=25000
  PASS (1d) BUY unrealized P&L = 0 at open
  PASS (2a) SELL-short cash 25000 + 100 = 25100 — cash=25100
  PASS (2b) SELL equity unchanged at open — equity=25000
  PASS (3a) BUY close realized = (exit-entry)*qty = +$10 — realized=$10.00
  PASS (3b) BUY close cash = 25000 + realized — cash=$25,010.00
  PASS (3c) SELL close realized = (entry-exit)*qty = -$10 — realized=$-10.00
  PASS (3d) SELL close cash = 25000 + realized — cash=$24,990.00
  PASS (4a) RANGES 1H = 60 candles — got 60
  PASS (4b) RANGES 1D = 96 candles — got 96
  PASS (4c) getCandles 1H=60 vs 1D=96 — 1H=60 1D=96
  PASS (4d) range switch changes candle count
  ALL LOGIC SMOKE TESTS PASSED
  ```
  Exit 0.
- **Result:** PASS (14/14)

---

## Bug list

### BUG-1 (major) — Closing a position restored from localStorage leaves its trade OPEN forever; its realized P&L is never recorded
- **Files/lines:** `src/App.tsx:192` (`openTradeIds = useRef(new Map())`),
  `src/App.tsx:402` (`openTradeIds.current.set(positionId, tradeId)` in
  `executeTrade`), `src/App.tsx:421-422` (`openTradeIds.current.get(positionId)`
  in `closePosition`), `src/App.tsx:444-453` (original trade marked CLOSED
  only if `tradeId !== undefined`, otherwise `prev` unchanged),
  `src/App.tsx:89-...` (`loadPersisted` restores `positions`/`trades` but never
  rebuilds the map).
- **Reproduction (Playwright, twice):** SIMULATE BUY $100 → reload → CLOSE.
  Notice correctly says `Closed BUY position BTC — realized P&L +$0.07
  (simulated)` and the position row disappears, but Trade History still shows
  the original trade as `BTC / USDT BUY $67,375.29 0.001484 $100.00 08:48:48 —
  OPEN`. History ends with 7 rows: 5 seed + the stale OPEN original + the
  closing-leg CLOSED row (pnl null, note 'Closed position').
- **Consequences:** (a) stale OPEN row in history after every reload-then-close;
  (b) the realized P&L is never added to `realizedPnl` (`src/App.tsx:288-295`
  sums only CLOSED trades with non-null pnl), so TOTAL P&L loses that amount
  after the close and the trade never counts toward win rate; (c) the closing
  leg's `pnl: null` design (comment at `src/App.tsx:438-441`, correct for the
  no-reload path) means nothing records the realized value in this path.
- **Why the no-reload path works:** in a single session the in-memory map has
  the id, so the original trade is marked CLOSED with pnl. Only the
  reload-restore path is broken.
- **Suggested fix (for the coordinator, not applied):** rebuild `openTradeIds`
  when restoring persisted state (match each OPEN trade to its position by
  symbol/side/entryPrice/qty, or persist the map / derive the trade id from
  the position id), or mark the OPEN trade CLOSED by matching fields in
  `closePosition` when the map misses.

### BUG-2 (minor, visual) — Strategy picker buttons render name + description concatenated
- **Files/lines:** `src/components/StrategyPanel.tsx:55-64`
  (`{s.name}<span>{s.description}</span>` with no separator) and
  `src/style.css:34` (no rule for `.strategy-picker button span` — no
  `display:block`, margin, or color).
- **Observed:** in the 390px screenshot the buttons read
  `Neural ScalperAdaptive momentum strategy`,
  `Momentum RiderTrend-following rider`, `Mean ReversionBuy dips, sell rips`.
- **Suggested fix:** style the inner span (e.g. `display:block; margin-top:2px;
  color:#71889a; font-size:10px`) or insert a separator.

### OBS-3 (minor) — CLOSE position button is a 32px touch target at all widths
- `src/components/TradePanel.tsx:148-156` uses class `text-btn`;
  `src/style.css:7` sets `.text-btn{...min-height:32px...}` with no ≥44px
  override in the ≤650px block. Below the 44px touch-target bar on mobile.

### OBS-4 (minor, cosmetic) — Seed trades sort above same-day user trades
- `src/App.tsx:51-55` stamps seed trades at fixed afternoon times (13:20–14:32
  today); Trade History sorts time-desc (`src/components/TradeHistory.tsx:22-23,51-60`),
  so a trade made in the morning appears below the seeds. Cosmetic only.

### OBS-5 (note, not a bug) — TOTAL P&L does not change when a position is closed
- By design: `pnl = realizedPnl + unrealizedPnl` (`src/App.tsx:288-295`), so a
  close converts unrealized into realized 1:1. Observed `+$108.36` before and
  after close. The browser test therefore asserts the close via the notice
  and the history row, not via the TOTAL P&L stat.

### OBS-6 (environmental, not a bug) — Google Fonts blocked in this VM
- `fonts.googleapis.com` returns `net::ERR_TUNNEL_CONNECTION_FAILED` from this
  VM's proxy (4 failures, one per page load). The app falls back to system
  fonts and renders correctly. The parent should re-verify font loading live
  in a browser outside this VM.

---

---

## Re-test after fixes (coordinator, Fri 20 Nov 2026 ~15:55 WIB)

BUG-1, BUG-2 and OBS-3 were fixed (see "Fixes applied" below) and the full
suite was re-run.

### Fixes applied
- **BUG-1:** `src/lib/types.ts` — `Trade` gained optional `positionId?: number`.
  `src/App.tsx` — `executeTrade` stores `positionId` on the opening trade;
  `closePosition` now resolves the opening trade via the in-memory map, else
  the persisted `positionId`, else a field match (symbol/side/qty/price) for
  legacy persisted state. The trade is therefore marked CLOSED with its
  realized P&L even after a reload.
- **BUG-2:** `src/style.css` — added `.strategy-picker .strategy-option span`
  (`display:block`, muted color, 10px) + selected-state span color; picker
  buttons now show name and description on separate lines.
- **OBS-3:** `src/style.css` — `.table-wrap .text-btn` gets `min-height:44px`
  inside the ≤650px block (CLOSE button is now a 44px touch target on mobile).

### Re-run results
- `npm run build` — exit 0 (`tsc -b` + vite build, 30 modules,
  `dist/assets/index-z3CuByA4.js` 269.06 kB / gzip 83.80 kB,
  `dist/assets/index-IbdKTSjY.css` 17.84 kB / gzip 4.76 kB). Note: the first
  re-run attempt failed `tsc` on a typo in the fix itself
  (`t.entryPrice` — Trade has `price`, not `entryPrice`); the smoke test in
  that run executed against the stale pre-fix `dist/` and failed (7c) again
  as expected. The typo was corrected, the build went green, and the smoke
  test was re-run against the fresh build.
- `node scripts/browser-smoke.mjs` (exit 0) — **21/21 checks PASS**, log
  `/tmp/nti-browser-smoke-rerun2.log`. Decisive line:
  `PASS (7c) OUR trade ($100.00) shows as CLOSED after close — BTC / USDT BUY
  $67,375.29 0.001484 $100.00 08:50:54 +$0.07 CLOSED`. All other checks pass
  as before (tabs, 1D range, risk slider, BUY, reload persistence, CLOSE
  notice, RESET DEMO, no overflow at 820px/390px, zero console/page errors
  excluding the VM-blocked Google Fonts stylesheet).
- Engine test re-run — 8/8 `ALL ENGINE TESTS PASSED`.
- Logic smoke re-run — `ALL LOGIC SMOKE TESTS PASSED`.
- Preview + curl (new hashes) — `/` 200, JS `index-z3CuByA4.js` 200
  (269,065 B), CSS `index-IbdKTSjY.css` 200 (17,841 B). Preview stopped
  afterwards; port 4173 verified free.

## Summary

| Section | Result |
|---|---|
| 1) Static gates (tsc, build, engine test) | PASS |
| 2) Preview + HTTP (200s, assets, no market-API calls) | PASS |
| 3) Real browser render (Playwright Chromium) | **PASS — 21/21 after BUG-1 fix** (was FAIL on item 7c before the fix) |
| 4) Responsive CSS static check | PASS |
| 5) Interaction logic check (node) | PASS (14/14) |

**FINAL STATUS: PASS** — every listed test ran and passed after the fixes.
The one genuine bug found in live browser testing (BUG-1, close-after-reload
leaving the trade OPEN) was fixed and re-verified in the same Playwright
suite (21/21). BUG-2 and OBS-3 were fixed alongside. Remaining known
non-blockers: Google Fonts is blocked by this VM's proxy (system-font
fallback verified working); seed trades carry fixed afternoon timestamps
(OBS-4, cosmetic).
