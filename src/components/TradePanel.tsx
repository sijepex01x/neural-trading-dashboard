import { money } from '../lib/format';
import type { Position } from '../lib/types';

interface TradePanelProps {
  symbols: { symbol: string; pair: string }[];
  symbol: string;
  onSymbolChange: (s: string) => void;
  amount: string;
  onAmountChange: (v: string) => void;
  balance: number;
  price: number;
  onBuy: () => void;
  onSell: () => void;
  error: string | null;
  positions: Position[];
  prices: Record<string, number>;
  onClosePosition: (id: number) => void;
}

function fmtQty(q: number): string {
  return String(Number(q.toFixed(6)));
}

function unrealized(p: Position, current: number): number {
  return p.side === 'BUY' ? (current - p.entryPrice) * p.qty : (p.entryPrice - current) * p.qty;
}

export default function TradePanel({
  symbols,
  symbol,
  onSymbolChange,
  amount,
  onAmountChange,
  balance,
  price,
  onBuy,
  onSell,
  error,
  positions,
  prices,
  onClosePosition,
}: TradePanelProps) {
  const disabled = error !== null || amount.trim() === '';
  const pairFor = (sym: string): string =>
    symbols.find((s) => s.symbol === sym)?.pair ?? `${sym} / USDT`;

  return (
    <section className="panel trade-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">SIMULATED TRADING</div>
          <h2>Execute Trade</h2>
        </div>
      </div>
      <div className="trade-form">
        <label className="trade-label" htmlFor="trade-pair">
          TRADING PAIR
        </label>
        <select
          id="trade-pair"
          aria-label="Trading pair"
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
        >
          {symbols.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.pair}
            </option>
          ))}
        </select>
        <label className="trade-label" htmlFor="trade-amount">
          AMOUNT (USD)
        </label>
        <input
          id="trade-amount"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          aria-label="Amount in USD"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
        />
        {error && (
          <div className="trade-error" role="alert">
            {error}
          </div>
        )}
        <div className="trade-meta">
          <span>AVAILABLE BALANCE</span>
          <b>{money(balance)}</b>
        </div>
        <div className="trade-meta">
          <span>CURRENT PRICE</span>
          <b>{money(price)}</b>
        </div>
        <div className="trade-buttons">
          <button type="button" className="trade-buy" onClick={onBuy} disabled={disabled}>
            ↗ SIMULATE BUY
          </button>
          <button type="button" className="trade-sell" onClick={onSell} disabled={disabled}>
            ↘ SIMULATE SELL
          </button>
        </div>
      </div>
      <div className="positions">
        <div className="panel-head">
          <div>
            <div className="eyebrow">OPEN POSITIONS</div>
            <h2>Your Positions</h2>
          </div>
        </div>
        {positions.length === 0 ? (
          <p className="muted">No open positions — simulated trades appear here.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ASSET</th>
                  <th>SIDE</th>
                  <th>ENTRY</th>
                  <th>QTY</th>
                  <th>CURRENT</th>
                  <th>UNREALIZED P&amp;L</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const current = prices[p.symbol] ?? p.entryPrice;
                  const u = unrealized(p, current);
                  return (
                    <tr key={p.id}>
                      <td>{pairFor(p.symbol)}</td>
                      <td>
                        <span className={`side ${p.side.toLowerCase()}`}>{p.side}</span>
                      </td>
                      <td>{money(p.entryPrice)}</td>
                      <td>{fmtQty(p.qty)}</td>
                      <td>{money(current)}</td>
                      <td className={u >= 0 ? 'positive' : 'negative'}>
                        {u >= 0 ? '+' : ''}
                        {money(u)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-btn"
                          aria-label={`Close position ${p.id}`}
                          onClick={() => onClosePosition(p.id)}
                        >
                          CLOSE
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
