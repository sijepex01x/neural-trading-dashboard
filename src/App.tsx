import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtTime, money } from './lib/format';
import {
  ASSETS,
  computeBollinger,
  computeFearGreed,
  computeMACD,
  computeRSI,
  createEngine,
  deriveSignal,
  getCandles,
  getQuote,
  tickEngine,
} from './lib/simulation';
import type { EngineState } from './lib/simulation';
import type { Position, RangeKey, Side, SignalItem, StrategyId, Trade } from './lib/types';
import Sidebar from './components/Sidebar';
import type { TabKey } from './components/Sidebar';
import Topbar from './components/Topbar';
import StatCards from './components/StatCards';
import AssetList from './components/AssetList';
import StrategyPanel, { STRATEGY_META } from './components/StrategyPanel';
import TradePanel from './components/TradePanel';
import SignalFeed from './components/SignalFeed';
import TradeHistory from './components/TradeHistory';
import NeuralOrb from './components/NeuralOrb';
import PriceChart from './components/PriceChart';
import IndicatorsPanel from './components/IndicatorsPanel';

const STORAGE_KEY = 'nti-demo-v1';
const INITIAL_CASH = 25000;
const MAX_POSITIONS = 8;

const TAB_TITLES: Record<TabKey, string> = {
  overview: 'Market Overview',
  market: 'Market Analysis',
  strategy: 'AI Strategy',
  history: 'Trade History',
};

interface SeedTradeInput {
  pair: string;
  side: Side;
  price: number;
  qty: number;
  time: string;
  pnl: number;
}

const SEED_TRADES: SeedTradeInput[] = [
  { pair: 'BTC / USDT', side: 'BUY', price: 67420.5, qty: 0.024, time: '14:32:08', pnl: 42.18 },
  { pair: 'ETH / USDT', side: 'SELL', price: 3521.8, qty: 0.42, time: '14:18:41', pnl: 18.64 },
  { pair: 'SOL / USDT', side: 'BUY', price: 184.22, qty: 8.5, time: '13:56:12', pnl: 31.2 },
  { pair: 'BTC / USDT', side: 'SELL', price: 67110.2, qty: 0.018, time: '13:41:09', pnl: -8.42 },
  { pair: 'ETH / USDT', side: 'BUY', price: 3488.4, qty: 0.31, time: '13:20:33', pnl: 24.76 },
];

function seedTrades(): Trade[] {
  const today = new Date();
  return SEED_TRADES.map((t, i) => {
    const [h, m, s] = t.time.split(':').map(Number);
    const at = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, s);
    const symbol = t.pair.split(' / ')[0];
    return {
      id: i + 1,
      symbol,
      pair: t.pair,
      side: t.side,
      price: t.price,
      qty: t.qty,
      amountUsd: t.price * t.qty,
      time: at.getTime(),
      pnl: t.pnl,
      status: 'CLOSED',
    };
  });
}

interface PersistedDemo {
  cash: number;
  positions: Position[];
  trades: Trade[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function loadPersisted(): PersistedDemo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const cash = parsed.cash;
    const positions = parsed.positions;
    const trades = parsed.trades;
    if (typeof cash !== 'number' || !Number.isFinite(cash)) return null;
    if (!Array.isArray(positions) || !Array.isArray(trades)) return null;
    const validPositions = positions.filter(
      (p): p is Position =>
        isRecord(p) &&
        typeof p.id === 'number' &&
        typeof p.symbol === 'string' &&
        typeof p.pair === 'string' &&
        (p.side === 'BUY' || p.side === 'SELL') &&
        typeof p.entryPrice === 'number' &&
        typeof p.qty === 'number' &&
        typeof p.openedAt === 'number',
    );
    const validTrades = trades.filter(
      (t): t is Trade =>
        isRecord(t) &&
        typeof t.id === 'number' &&
        typeof t.symbol === 'string' &&
        typeof t.pair === 'string' &&
        (t.side === 'BUY' || t.side === 'SELL') &&
        typeof t.price === 'number' &&
        typeof t.qty === 'number' &&
        typeof t.amountUsd === 'number' &&
        typeof t.time === 'number' &&
        (typeof t.pnl === 'number' || t.pnl === null) &&
        (t.status === 'OPEN' || t.status === 'CLOSED'),
    );
    return { cash, positions: validPositions, trades: validTrades };
  } catch {
    return null;
  }
}

/**
 * Toy deterministic backtest over the close series (simulated only):
 * momentum = trend-following on the previous 1-step return,
 * scalper = mean-reversion of the previous 1-step return,
 * reversion = contrarian against the trailing 5-close mean.
 */
function backtestStrategy(
  closes: number[],
  strategy: StrategyId,
): { winRate: number; totalReturn: number } {
  const window = 5;
  if (closes.length <= window) return { winRate: 0, totalReturn: 0 };
  let wins = 0;
  let n = 0;
  let total = 0;
  for (let i = window; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    const r = curr / prev - 1;
    const mean =
      closes.slice(i - window, i).reduce((s, v) => s + v, 0) / window;
    let signal = 0;
    if (strategy === 'momentum') signal = prev > closes[i - 2] ? 1 : -1;
    else if (strategy === 'scalper') signal = prev > closes[i - 2] ? -1 : 1;
    else signal = prev > mean ? -1 : 1;
    const step = signal * r;
    total += step;
    n += 1;
    if (step > 0) wins += 1;
  }
  return { winRate: n > 0 ? (wins / n) * 100 : 0, totalReturn: total * 100 };
}

export default function App() {
  // Engine created exactly once (lazy init).
  const engineRef = useRef<EngineState | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createEngine();
  }
  const engine = engineRef.current as EngineState;

  const [initial] = useState<PersistedDemo | null>(loadPersisted);
  const [tab, setTab] = useState<TabKey>('overview');
  const [range, setRange] = useState<RangeKey>('1H');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [strategy, setStrategy] = useState<StrategyId>('scalper');
  const [risk, setRisk] = useState(35);
  const [confidence, setConfidence] = useState(72);
  const [running, setRunning] = useState(true);
  const [showBollinger, setShowBollinger] = useState(false);
  const [cash, setCash] = useState(initial?.cash ?? INITIAL_CASH);
  const [positions, setPositions] = useState<Position[]>(initial?.positions ?? []);
  const [trades, setTrades] = useState<Trade[]>(initial?.trades ?? seedTrades());
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [amount, setAmount] = useState('100');
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [booted, setBooted] = useState(false);
  const [tick, setTick] = useState(0);

  const idRef = useRef(Date.now());
  const openTradeIds = useRef(new Map<number, number>());

  const nextId = (): number => {
    idRef.current += 1;
    return idRef.current;
  };

  // Boot skeleton: show briefly on first paint.
  useEffect(() => {
    const id = setTimeout(() => setBooted(true), 600);
    return () => clearTimeout(id);
  }, []);

  // Engine tick every 2s while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const eng = engineRef.current;
      if (eng) tickEngine(eng);
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, [running]);

  // Persist demo state.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cash, positions, trades }));
    } catch {
      // Storage unavailable (private mode, quota) — demo keeps running in memory.
    }
  }, [cash, positions, trades]);

  // Notice auto-clear after 4s.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  // ---- Derived market data (recomputed every tick) ----
  const quotes = useMemo(
    () => ASSETS.map((a) => getQuote(engine, a.symbol)),
    [engine, tick],
  );
  const selectedQuote = useMemo(
    () => quotes.find((q) => q.symbol === selectedSymbol) ?? quotes[0],
    [quotes, selectedSymbol],
  );
  const candles = useMemo(
    () => getCandles(engine, selectedSymbol, range),
    [engine, selectedSymbol, range, tick],
  );
  const closes = useMemo(() => candles.map((c) => c.c), [candles]);
  const rsi = useMemo(() => computeRSI(closes), [closes]);
  const macd = useMemo(() => computeMACD(closes), [closes]);
  const bollinger = useMemo(() => computeBollinger(closes), [closes]);
  // MACD histogram is in price units; normalize to percent-scale for the gauge.
  const gauge = useMemo(
    () =>
      computeFearGreed(
        rsi,
        selectedQuote.changePct,
        (macd.lastHist / selectedQuote.price) * 100,
      ),
    [rsi, selectedQuote, macd],
  );

  const prices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of quotes) map[q.symbol] = q.price;
    return map;
  }, [quotes]);

  // ---- Derived portfolio math ----
  const unrealizedPnl = useMemo(
    () =>
      positions.reduce((sum, p) => {
        const price = prices[p.symbol] ?? p.entryPrice;
        return (
          sum +
          (p.side === 'BUY'
            ? (price - p.entryPrice) * p.qty
            : (p.entryPrice - price) * p.qty)
        );
      }, 0),
    [positions, prices],
  );
  const equity = useMemo(() => {
    const positionsValue = positions.reduce((sum, p) => {
      const price = prices[p.symbol] ?? p.entryPrice;
      return sum + (p.side === 'BUY' ? p.qty * price : -p.qty * price);
    }, 0);
    return cash + positionsValue;
  }, [cash, positions, prices]);
  const realizedPnl = useMemo(
    () =>
      trades
        .filter((t) => t.status === 'CLOSED' && t.pnl !== null)
        .reduce((s, t) => s + (t.pnl ?? 0), 0),
    [trades],
  );
  const pnl = realizedPnl + unrealizedPnl;
  const pnlPct = (pnl / INITIAL_CASH) * 100;
  const { wins, losses } = useMemo(() => {
    let w = 0;
    let l = 0;
    for (const t of trades) {
      if (t.status !== 'CLOSED' || t.pnl === null) continue;
      if (t.pnl > 0) w += 1;
      else if (t.pnl < 0) l += 1;
    }
    return { wins: w, losses: l };
  }, [trades]);
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
  const sparkValues = useMemo(() => closes.slice(-34), [closes]);
  const sync = 98.2 + Math.sin(tick) * 0.4;

  // ---- Signal derivation (every tick) ----
  const derivedSignal = useMemo(
    () =>
      deriveSignal(
        selectedSymbol,
        rsi,
        macd,
        selectedQuote.changePct,
        strategy,
        confidence,
        Date.now(),
        Date.now(),
      ),
    [selectedSymbol, rsi, macd, selectedQuote, strategy, confidence, tick],
  );

  useEffect(() => {
    setSignals((prev) => {
      // Dedupe by id (guards StrictMode double-effect in dev).
      if (prev.some((s) => s.id === derivedSignal.id)) return prev;
      const last = prev[prev.length - 1];
      if (
        prev.length === 0 ||
        last.action !== derivedSignal.action ||
        tick % 12 === 0
      ) {
        return [...prev, derivedSignal].slice(-8);
      }
      return prev;
    });
  }, [derivedSignal, tick]);

  const backtests = useMemo(
    () =>
      (['scalper', 'momentum', 'reversion'] as StrategyId[]).map((id) => ({
        id,
        ...backtestStrategy(closes, id),
      })),
    [closes],
  );

  // ---- Trading ----
  const pairForSymbol = (sym: string): string =>
    ASSETS.find((a) => a.symbol === sym)?.pair ?? `${sym} / USDT`;

  const validateAmount = (raw: string): string | null => {
    const value = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(value)) return 'Enter an amount in USD.';
    if (value <= 0) return 'Amount must be greater than $0.';
    if (value < 10) return 'Minimum simulated order is $10.';
    if (value > cash) return 'Amount exceeds available cash (simulated margin).';
    return null;
  };

  const handleAmountChange = (v: string) => {
    setAmount(v);
    setTradeError(v.trim() === '' ? null : validateAmount(v));
  };

  const executeTrade = (side: Side) => {
    const err = validateAmount(amount);
    if (err) {
      setTradeError(err);
      return;
    }
    const value = Number(amount);
    const price = selectedQuote.price;
    const qty = value / price;
    const now = Date.now();
    const positionId = nextId();
    const tradeId = nextId();
    const position: Position = {
      id: positionId,
      symbol: selectedSymbol,
      pair: selectedQuote.pair,
      side,
      entryPrice: price,
      qty,
      openedAt: now,
    };
    const trade: Trade = {
      id: tradeId,
      symbol: selectedSymbol,
      pair: selectedQuote.pair,
      side,
      price,
      qty,
      amountUsd: value,
      time: now,
      pnl: null,
      status: 'OPEN',
      // Durable link to its position: survives reload via localStorage,
      // unlike the in-memory openTradeIds map.
      positionId,
    };
    openTradeIds.current.set(positionId, tradeId);
    setPositions((prev) => [...prev, position]);
    setTrades((prev) => [trade, ...prev]);
    // BUY pays cash; SELL (short) receives the proceeds as margin cash.
    setCash((c) => (side === 'BUY' ? c - value : c + value));
    setTradeError(null);
    setNotice(
      `Simulated ${side} ${Number(qty.toFixed(6))} ${selectedSymbol} @ ${money(price)} — $${value.toFixed(2)}`,
    );
  };

  const closePosition = (positionId: number) => {
    const position = positions.find((p) => p.id === positionId);
    if (!position) return;
    const price = prices[position.symbol] ?? position.entryPrice;
    const realized =
      position.side === 'BUY'
        ? (price - position.entryPrice) * position.qty
        : (position.entryPrice - price) * position.qty;
    // Resolve the opening trade for this position. The in-memory map covers
    // the same-session path; the persisted positionId on the trade covers
    // reloads; the field match covers legacy persisted state written before
    // positionId existed. Without this, a close after reload left the trade
    // OPEN forever and its realized P&L unrecorded.
    const tradeId =
      openTradeIds.current.get(positionId) ??
      trades.find((t) => t.positionId === positionId && t.status === 'OPEN')
        ?.id ??
      trades.find(
        (t) =>
          t.status === 'OPEN' &&
          t.symbol === position.symbol &&
          t.side === position.side &&
          t.qty === position.qty &&
          t.price === position.entryPrice,
      )?.id;
    openTradeIds.current.delete(positionId);
    // BUY close: cash += qty * exit price. SELL close: buy back, cash -= qty * exit price.
    setCash((c) =>
      c + (position.side === 'BUY' ? position.qty * price : -position.qty * price),
    );
    setPositions((prev) => prev.filter((p) => p.id !== positionId));
    const closingTrade: Trade = {
      id: nextId(),
      symbol: position.symbol,
      pair: pairForSymbol(position.symbol),
      side: position.side,
      price,
      qty: position.qty,
      amountUsd: position.qty * price,
      time: Date.now(),
      // pnl stays null on the closing leg: the realized P&L is recorded once,
      // on the original OPEN trade marked CLOSED below. Counting it here too
      // would double-count every close in totals and win rate.
      pnl: null,
      status: 'CLOSED',
      note: 'Closed position',
    };
    setTrades((prev) => {
      const updated =
        tradeId === undefined
          ? prev
          : prev.map((t) =>
              t.id === tradeId
                ? { ...t, status: 'CLOSED' as const, pnl: realized }
                : t,
            );
      return [closingTrade, ...updated];
    });
    setNotice(
      `Closed ${position.side} position ${position.symbol} — realized P&L ${realized >= 0 ? '+' : ''}${money(realized)} (simulated)`,
    );
  };

  const resetDemo = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors; in-memory state is still reset below.
    }
    openTradeIds.current.clear();
    setCash(INITIAL_CASH);
    setPositions([]);
    setTrades(seedTrades());
    setSignals([]);
    setAmount('100');
    setTradeError(null);
    setNotice('Demo reset to initial state.');
  };

  const clearHistory = () => {
    setTrades([]);
    setNotice('Trade history cleared (simulated).');
  };

  const latestSignal = signals[signals.length - 1] ?? null;

  if (!booted) {
    return (
      <div className="boot-skeleton">
        <div className="boot-block" />
        <div className="boot-block" />
        <div className="boot-block" />
        <p>Booting NEURAL core…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        tab={tab}
        onTab={setTab}
        onSettings={() => setNotice('Demo settings — not connected to a live exchange.')}
      />
      <main className="main">
        <Topbar tab={tab} running={running} onNotify={() => setNotice('No new notifications.')} />
        <div className="content">
          <div className="heading">
            <div>
              <div className="eyebrow">NEURAL NETWORK / CONTROL CENTER</div>
              <h1>{TAB_TITLES[tab]}</h1>
              <p>Real-time intelligence. Adaptive strategy. Data-driven decisions.</p>
            </div>
            <div className="actions">
              <span className="demo-tag">● DEMO MODE</span>
              <button
                className={`run-btn ${running ? '' : 'paused'}`}
                onClick={() => setRunning((r) => !r)}
              >
                {running ? 'Ⅱ　PAUSE ENGINE' : '▶　RESUME ENGINE'}
              </button>
            </div>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}

          {tab === 'overview' && (
            <>
              <StatCards
                portfolio={equity}
                pnl={pnl}
                pnlPct={pnlPct}
                wins={wins}
                losses={losses}
                winRate={winRate}
                activePositions={positions.length}
                maxPositions={MAX_POSITIONS}
                sparkValues={sparkValues}
                positionFill={positions.length}
              />
              <div className="grid-main view-overview">
                <section className="panel neural-panel">
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">CORE VISUALIZATION</div>
                      <h2>Neural Activity Map</h2>
                    </div>
                    <span className="tiny-live">
                      <i /> ACTIVE
                    </span>
                  </div>
                  <div className="orb-wrap">
                    <NeuralOrb running={running} sync={sync} />
                    <div className="orb-center">
                      <div className="orb-number">
                        {sync.toFixed(1)}
                        <small>%</small>
                      </div>
                      <span>NETWORK SYNC</span>
                    </div>
                    <div className="orb-label left">
                      NEURAL
                      <br />
                      DENSITY <b>0.847</b>
                    </div>
                    <div className="orb-label right">
                      ACTIVE NODES
                      <br />
                      <b>12,840</b>
                    </div>
                  </div>
                  <div className="neural-foot">
                    <div>
                      <span>PROCESSING</span>
                      <b>1.28 TB/s</b>
                    </div>
                    <div>
                      <span>LATENCY</span>
                      <b>12.4 ms</b>
                    </div>
                    <div>
                      <span>MODEL STATUS</span>
                      <b className="positive">OPTIMAL</b>
                    </div>
                  </div>
                </section>
                <AssetList
                  assets={quotes}
                  selected={selectedSymbol}
                  onSelect={setSelectedSymbol}
                  onViewAll={() => setTab('market')}
                />
                <PriceChart
                  candles={candles}
                  symbol={selectedSymbol}
                  price={selectedQuote.price}
                  changePct={selectedQuote.changePct}
                  range={range}
                  onRangeChange={setRange}
                  showBollinger={showBollinger}
                  onToggleBollinger={() => setShowBollinger((v) => !v)}
                  bollinger={bollinger}
                />
                <StrategyPanel
                  strategy={strategy}
                  onStrategyChange={setStrategy}
                  risk={risk}
                  onRiskChange={setRisk}
                  confidence={confidence}
                  onConfidenceChange={setConfidence}
                  signal={latestSignal}
                />
                <TradePanel
                  symbols={ASSETS.map((a) => ({ symbol: a.symbol, pair: a.pair }))}
                  symbol={selectedSymbol}
                  onSymbolChange={setSelectedSymbol}
                  amount={amount}
                  onAmountChange={handleAmountChange}
                  balance={cash}
                  price={selectedQuote.price}
                  onBuy={() => executeTrade('BUY')}
                  onSell={() => executeTrade('SELL')}
                  error={tradeError}
                  positions={positions}
                  prices={prices}
                  onClosePosition={closePosition}
                />
                <section className="panel history-panel">
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">EXECUTION LOG</div>
                      <h2>Recent Transactions</h2>
                    </div>
                    <button className="text-btn" onClick={() => setTab('history')}>
                      FULL HISTORY ↗
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ASSET</th>
                          <th>SIDE</th>
                          <th>PRICE</th>
                          <th>TIME</th>
                          <th>DEMO P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.slice(0, 5).map((t) => (
                          <tr key={t.id}>
                            <td>{t.pair}</td>
                            <td>
                              <span className={`side ${t.side.toLowerCase()}`}>{t.side}</span>
                            </td>
                            <td>{money(t.price)}</td>
                            <td>{fmtTime(t.time)}</td>
                            <td
                              className={
                                t.pnl === null
                                  ? 'muted'
                                  : t.pnl >= 0
                                    ? 'positive'
                                    : 'negative'
                              }
                            >
                              {t.pnl === null
                                ? '—'
                                : `${t.pnl >= 0 ? '+' : ''}${money(t.pnl)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )}

          {tab === 'market' && (
            <div className="grid-main view-market">
              <PriceChart
                candles={candles}
                symbol={selectedSymbol}
                price={selectedQuote.price}
                changePct={selectedQuote.changePct}
                range={range}
                onRangeChange={setRange}
                showBollinger={showBollinger}
                onToggleBollinger={() => setShowBollinger((v) => !v)}
                bollinger={bollinger}
              />
              <IndicatorsPanel
                symbol={selectedSymbol}
                rsi={rsi}
                macd={macd}
                bollinger={bollinger}
                gauge={gauge}
                changePct={selectedQuote.changePct}
              />
              <AssetList
                assets={quotes}
                selected={selectedSymbol}
                onSelect={setSelectedSymbol}
                onViewAll={() => setTab('market')}
              />
            </div>
          )}

          {tab === 'strategy' && (
            <div className="grid-main view-strategy">
              <StrategyPanel
                strategy={strategy}
                onStrategyChange={setStrategy}
                risk={risk}
                onRiskChange={setRisk}
                confidence={confidence}
                onConfidenceChange={setConfidence}
                signal={latestSignal}
              />
              <SignalFeed signals={signals} />
              <section className="panel backtest-panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">SIMULATED BACKTEST</div>
                    <h2>Strategy Performance (Simulated)</h2>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>STRATEGY</th>
                        <th>WIN RATE</th>
                        <th>TOTAL RETURN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtests.map((b) => (
                        <tr key={b.id}>
                          <td>
                            {STRATEGY_META.find((s) => s.id === b.id)?.name ?? b.id}
                          </td>
                          <td>{b.winRate.toFixed(1)}%</td>
                          <td className={b.totalReturn >= 0 ? 'positive' : 'negative'}>
                            {b.totalReturn >= 0 ? '+' : ''}
                            {b.totalReturn.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="market-note">SIMULATED BACKTEST — NOT FINANCIAL ADVICE</div>
              </section>
            </div>
          )}

          {tab === 'history' && (
            <>
              <div className="positions-summary">
                <span>
                  OPEN POSITIONS: {positions.length} / {MAX_POSITIONS}
                </span>
                <span className="muted">
                  Unrealized P&amp;L: {unrealizedPnl >= 0 ? '+' : ''}
                  {money(unrealizedPnl)}
                </span>
              </div>
              <TradeHistory trades={trades} onClear={clearHistory} />
            </>
          )}

          <footer>
            <span>© 2026 NEURAL TRADING INTELLIGENCE</span>
            <span>
              <strong>SIMULATED DATA — NOT FINANCIAL ADVICE</strong>
            </span>
            <button className="text-btn" onClick={resetDemo}>
              RESET DEMO
            </button>
            <span>BUILD 1.0.4 ● SYSTEM ONLINE</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
