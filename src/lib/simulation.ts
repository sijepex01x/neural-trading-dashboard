/**
 * Seeded pseudo-random-walk market engine. ALL DATA IS SIMULATED — no network
 * calls, no API keys, no real prices.
 *
 * Determinism: every random stream derives from the engine seed via
 * mulberry32. `createEngine` history and `getCandles` use fresh streams
 * hashed from (seed, symbol, range), so two engines with the same seed
 * produce identical histories and candle series. Live ticks advance a single
 * persistent stream kept as `rngState` on the engine — Math.random is never
 * used in this file.
 */
import type {
  AssetConfig,
  AssetQuote,
  BollingerResult,
  Candle,
  MacdResult,
  RangeKey,
  SignalAction,
  SignalItem,
  StrategyId,
} from './types';

export const ASSETS: AssetConfig[] = [
  { symbol: 'BTC', name: 'Bitcoin', pair: 'BTC / USDT', icon: '₿', startPrice: 67420.5, vol: 0.0016, drift: 0.00002 },
  { symbol: 'ETH', name: 'Ethereum', pair: 'ETH / USDT', icon: 'Ξ', startPrice: 3521.8, vol: 0.0022, drift: 0.00001 },
  { symbol: 'SOL', name: 'Solana', pair: 'SOL / USDT', icon: '◎', startPrice: 184.22, vol: 0.0035, drift: -0.00001 },
  { symbol: 'BNB', name: 'BNB', pair: 'BNB / USDT', icon: '◆', startPrice: 612.84, vol: 0.002, drift: 0.00001 },
];

export const RANGES: Record<RangeKey, { candles: number; minutes: number }> = {
  '1H': { candles: 60, minutes: 1 },
  '4H': { candles: 48, minutes: 5 },
  '1D': { candles: 96, minutes: 15 },
  '1W': { candles: 112, minutes: 90 },
  '1M': { candles: 120, minutes: 360 },
};

export interface EngineState {
  seed: number;
  now: number;
  /** Live mulberry32 internal state (`a`); advanced by every tick. */
  rngState: number;
  prices: Record<string, number>;
  closes: Record<string, number[]>;
  series: Record<string, Partial<Record<RangeKey, Candle[]>>>;
}

/* ------------------------------------------------------------------ */
/* Seeded RNG: mulberry32                                             */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One mulberry32 step against the engine's persistent `rngState`. */
function nextRand(state: EngineState): number {
  const a = (state.rngState + 0x6d2b79f5) | 0;
  state.rngState = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** FNV-1a 32-bit hash: derives a distinct stream seed from a string key. */
function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Standard-normal sample via Box-Muller (consumes 2 uniform draws). */
function gaussianFrom(rng: () => number): number {
  let u1 = rng();
  while (u1 <= 0) u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function findAsset(symbol: string): AssetConfig {
  const asset = ASSETS.find((a) => a.symbol === symbol);
  if (!asset) throw new Error(`Unknown symbol: ${symbol}`);
  return asset;
}

/* ------------------------------------------------------------------ */
/* Engine lifecycle                                                   */
/* ------------------------------------------------------------------ */

export function createEngine(seed = 20261120): EngineState {
  const prices: Record<string, number> = {};
  const closes: Record<string, number[]> = {};
  for (const asset of ASSETS) {
    prices[asset.symbol] = asset.startPrice;
    // 200-point history ending exactly at the start price: walk backwards
    // from it with a per-asset seeded stream so history is deterministic.
    const rng = mulberry32(hashSeed(`${seed}:${asset.symbol}:history`));
    const hist: number[] = new Array<number>(200);
    hist[199] = asset.startPrice;
    for (let i = 198; i >= 0; i--) {
      hist[i] = hist[i + 1] / (1 + asset.drift + asset.vol * gaussianFrom(rng));
    }
    closes[asset.symbol] = hist;
  }
  return { seed, now: Date.now(), rngState: seed >>> 0, prices, closes, series: {} };
}

export function getCandles(state: EngineState, symbol: string, range: RangeKey): Candle[] {
  const cached = state.series[symbol]?.[range];
  if (cached) return cached;
  const asset = findAsset(symbol);
  const cfg = RANGES[range];
  // Deterministic stream for this (seed, symbol, range) triple.
  const rng = mulberry32(hashSeed(`${state.seed}:${symbol}:${range}`));
  const price = state.prices[symbol];
  const walk: number[] = new Array<number>(cfg.candles);
  walk[cfg.candles - 1] = price;
  for (let i = cfg.candles - 2; i >= 0; i--) {
    walk[i] = walk[i + 1] / (1 + asset.drift + asset.vol * gaussianFrom(rng));
  }
  const stepMs = cfg.minutes * 60_000;
  const candles: Candle[] = [];
  for (let i = 0; i < cfg.candles; i++) {
    const close = walk[i];
    const open =
      i > 0 ? walk[i - 1] : close / (1 + asset.drift + asset.vol * gaussianFrom(rng));
    candles.push({
      t: state.now - (cfg.candles - 1 - i) * stepMs,
      o: open,
      h: Math.max(open, close) * (1 + rng() * asset.vol * 0.5),
      l: Math.min(open, close) * (1 - rng() * asset.vol * 0.5),
      c: close,
      v: Math.round((50 + rng() * 950) * 100) / 100,
    });
  }
  if (!state.series[symbol]) state.series[symbol] = {};
  state.series[symbol][range] = candles;
  return candles;
}

export function tickEngine(state: EngineState): void {
  // ~8 simulated seconds per tick.
  state.now += 8000;
  for (const asset of ASSETS) {
    const next =
      state.prices[asset.symbol] *
      (1 + asset.drift + asset.vol * gaussianFrom(() => nextRand(state)));
    state.prices[asset.symbol] = next;
    const hist = state.closes[asset.symbol];
    hist.push(next);
    if (hist.length > 400) hist.shift();

    const ranges = state.series[asset.symbol];
    if (!ranges) continue;
    for (const key of Object.keys(ranges) as RangeKey[]) {
      const candles = ranges[key];
      if (!candles || candles.length === 0) continue;
      const cfg = RANGES[key];
      const stepMs = cfg.minutes * 60_000;
      let last = candles[candles.length - 1];
      // Roll a new candle whenever `now` passed the current candle's end.
      while (state.now >= last.t + stepMs) {
        candles.push({
          t: last.t + stepMs,
          o: last.c,
          h: Math.max(last.c, next),
          l: Math.min(last.c, next),
          c: next,
          v: Math.round(nextRand(state) * 10),
        });
        if (candles.length > cfg.candles) candles.shift();
        last = candles[candles.length - 1];
      }
      last.c = next;
      if (next > last.h) last.h = next;
      if (next < last.l) last.l = next;
      last.v += Math.round(nextRand(state) * 5);
    }
  }
}

export function getQuote(state: EngineState, symbol: string): AssetQuote {
  const asset = findAsset(symbol);
  const price = state.prices[symbol];
  const hist = state.closes[symbol];
  const prevClose = hist.length >= 2 ? hist[hist.length - 2] : asset.startPrice;
  const changePct = ((price - prevClose) / prevClose) * 100;
  return {
    symbol,
    name: asset.name,
    pair: asset.pair,
    icon: asset.icon,
    price,
    prevClose,
    changePct,
    history: hist.slice(-40),
  };
}

/* ------------------------------------------------------------------ */
/* Indicators                                                         */
/* ------------------------------------------------------------------ */

export function computeRSI(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  // Wilder smoothing over the remaining changes.
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  if (avgGain === 0) return 0;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** EMA series, seeded with the SMA of the first `period` values. */
function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let ema = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (i === period - 1) {
      ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
    } else {
      ema = values[i] * k + ema * (1 - k);
    }
    out.push(ema);
  }
  return out;
}

export function computeMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdResult {
  const zero: MacdResult = {
    macd: [],
    signal: [],
    histogram: [],
    lastMacd: 0,
    lastSignal: 0,
    lastHist: 0,
  };
  if (closes.length < slow + signalPeriod) return zero;
  const fastEma = emaSeries(closes, fast); // aligned to index fast-1..
  const slowEma = emaSeries(closes, slow); // aligned to index slow-1..
  const offset = slow - fast;
  const macdLine: number[] = [];
  for (let i = 0; i < slowEma.length; i++) {
    macdLine.push(fastEma[i + offset] - slowEma[i]);
  }
  const signalLine = emaSeries(macdLine, signalPeriod);
  const sigOffset = macdLine.length - signalLine.length;
  const histogram: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + sigOffset] - signalLine[i]);
  }
  return {
    macd: macdLine.slice(-40),
    signal: signalLine.slice(-40),
    histogram: histogram.slice(-40),
    lastMacd: macdLine[macdLine.length - 1],
    lastSignal: signalLine[signalLine.length - 1],
    lastHist: histogram[histogram.length - 1],
  };
}

export function computeBollinger(
  closes: number[],
  period = 20,
  mult = 2,
): BollingerResult | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const middle = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = middle + mult * sd;
  const lower = middle - mult * sd;
  return { upper, middle, lower, bandwidth: (upper - lower) / middle };
}

export function computeFearGreed(rsi: number, changePct: number, macdHist: number): number {
  // NOTE: macdHist must already be normalised to roughly -1..1 by the caller
  // (a raw MACD histogram is price-scaled, so callers divide it by price or
  // by a recent ATR-like scale before passing it in).
  const raw =
    50 + (rsi - 50) * 0.6 + clamp(changePct, -5, 5) * 4 + clamp(macdHist, -1, 1) * 5;
  return Math.round(clamp(raw, 0, 100));
}

/* ------------------------------------------------------------------ */
/* Signals                                                            */
/* ------------------------------------------------------------------ */

export function deriveSignal(
  symbol: string,
  rsi: number,
  macd: MacdResult,
  changePct: number,
  strategy: StrategyId,
  confidenceThreshold: number,
  now: number,
  id: number,
): SignalItem {
  let rsiScore = 0;
  if (rsi < 30) rsiScore = 2;
  else if (rsi > 70) rsiScore = -2;
  let macdScore = 0;
  if (macd.lastHist > 0) macdScore = 1;
  else if (macd.lastHist < 0) macdScore = -1;
  let chgScore = changePct > 0 ? 0.5 : -0.5;

  if (strategy === 'reversion') rsiScore = -rsiScore;
  if (strategy === 'scalper') macdScore *= 1.5;
  if (strategy === 'momentum') chgScore *= 2;

  const score = rsiScore + macdScore + chgScore;

  let action: SignalAction = 'HOLD';
  if (score >= 2.5) action = 'STRONG BUY';
  else if (score >= 1) action = 'BUY';
  else if (score <= -2.5) action = 'STRONG SELL';
  else if (score <= -1) action = 'SELL';

  const confidence = clamp(
    50 + Math.abs(score) * 12 + (strategy === 'scalper' ? 4 : 0),
    50,
    99,
  );

  // A BUY/SELL whose confidence sits below the operator's threshold is
  // softened one step instead of being published weak (STRONG BUY -> BUY,
  // BUY -> HOLD, and the SELL mirror).
  if (confidence < confidenceThreshold) {
    if (action === 'STRONG BUY') action = 'BUY';
    else if (action === 'BUY') action = 'HOLD';
    else if (action === 'STRONG SELL') action = 'SELL';
    else if (action === 'SELL') action = 'HOLD';
  }

  const drivers: string[] = [
    rsi < 30
      ? `RSI ${Math.round(rsi)} oversold`
      : rsi > 70
        ? `RSI ${Math.round(rsi)} overbought`
        : `RSI ${Math.round(rsi)} neutral`,
    macd.lastHist > 0
      ? 'MACD histogram positive'
      : macd.lastHist < 0
        ? 'MACD histogram negative'
        : 'MACD histogram flat',
    changePct >= 0 ? `momentum +${changePct.toFixed(2)}%` : `momentum ${changePct.toFixed(2)}%`,
  ];

  return { id, time: now, symbol, action, confidence, reason: drivers.join(' · ') };
}
