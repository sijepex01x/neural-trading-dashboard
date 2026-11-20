export type Side = 'BUY' | 'SELL';
export type RangeKey = '1H' | '4H' | '1D' | '1W' | '1M';
export type StrategyId = 'scalper' | 'momentum' | 'reversion';
export type SignalAction = 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }
export interface AssetConfig { symbol: string; name: string; pair: string; icon: string; startPrice: number; vol: number; drift: number }
export interface AssetQuote { symbol: string; name: string; pair: string; icon: string; price: number; prevClose: number; changePct: number; history: number[] }
export interface Position { id: number; symbol: string; pair: string; side: Side; entryPrice: number; qty: number; openedAt: number }
export interface Trade { id: number; pair: string; symbol: string; side: Side; price: number; qty: number; amountUsd: number; time: number; pnl: number | null; status: 'OPEN' | 'CLOSED'; note?: string; positionId?: number }
export interface SignalItem { id: number; time: number; symbol: string; action: SignalAction; confidence: number; reason: string }
export interface MacdResult { macd: number[]; signal: number[]; histogram: number[]; lastMacd: number; lastSignal: number; lastHist: number }
export interface BollingerResult { upper: number; middle: number; lower: number; bandwidth: number }
