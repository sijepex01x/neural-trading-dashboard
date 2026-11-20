export interface MacdResult {
  macd: number[];
  signal: number[];
  histogram: number[];
  lastMacd: number;
  lastSignal: number;
  lastHist: number;
}

import type { CSSProperties } from 'react';

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
}

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function gaugeLabel(v: number): string {
  if (v <= 24) return 'Extreme Fear';
  if (v <= 44) return 'Fear';
  if (v <= 55) return 'Neutral';
  if (v <= 74) return 'Greed';
  return 'Extreme Greed';
}

interface IndicatorsPanelProps {
  symbol: string;
  rsi: number;
  macd: MacdResult;
  bollinger: BollingerResult | null;
  gauge: number;
  changePct: number;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  font: "11px 'DM Mono', monospace",
  color: '#b5c6d3',
  padding: '3px 0',
};

const blockTitle: CSSProperties = {
  font: "9px 'DM Mono', monospace",
  letterSpacing: '1px',
  color: '#8498aa',
  margin: '16px 0 8px',
};

export default function IndicatorsPanel({ symbol, rsi, macd, bollinger, gauge, changePct }: IndicatorsPanelProps) {
  const rsiLabel = rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL';
  const rsiClass = rsi > 70 ? 'negative' : rsi < 30 ? 'positive' : 'muted';
  const rsiClamped = Math.min(100, Math.max(0, rsi));
  const gaugeClamped = Math.min(100, Math.max(0, gauge));
  const hist = macd.histogram.slice(-24);
  const maxHist = Math.max(...hist.map((v) => Math.abs(v)), 1e-9);

  return (
    <section className="panel indicators-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TECHNICAL INDICATORS / SIMULATED</div>
          <h2>Market Indicators</h2>
        </div>
        <span className="demo-tag">SIMULATED</span>
      </div>
      <div style={{ font: "10px 'DM Mono', monospace", color: '#71869a', marginTop: 10 }}>
        {symbol} · <span className={changePct >= 0 ? 'positive' : 'negative'}>{changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%</span>
      </div>

      {/* RSI */}
      <div style={blockTitle}>RSI (14)</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong style={{ fontSize: 22, fontWeight: 500 }}>{rsi.toFixed(1)}</strong>
        <span className={rsiClass} style={{ font: "10px 'DM Mono', monospace" }}>{rsiLabel}</span>
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 5, background: '#1a2835', marginTop: 8, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%', background: 'rgba(82, 214, 189, 0.25)' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '30%', background: 'rgba(229, 155, 115, 0.25)' }} />
        <div
          style={{
            position: 'absolute',
            left: `${rsiClamped}%`,
            top: -2,
            bottom: -2,
            width: 3,
            background: '#5cdae2',
            transform: 'translateX(-50%)',
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', font: "8px 'DM Mono', monospace", color: '#62788b', marginTop: 4 }}>
        <span>0 OVERSOLD</span>
        <span>50</span>
        <span>OVERBOUGHT 100</span>
      </div>

      {/* MACD */}
      <div style={blockTitle}>MACD</div>
      <div style={rowStyle}>
        <span>MACD</span>
        <span>{macd.lastMacd.toFixed(4)}</span>
      </div>
      <div style={rowStyle}>
        <span>Signal</span>
        <span>{macd.lastSignal.toFixed(4)}</span>
      </div>
      <div style={rowStyle}>
        <span>Histogram</span>
        <span className={macd.lastHist >= 0 ? 'positive' : 'negative'}>{macd.lastHist.toFixed(4)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48, marginTop: 8 }}>
        {hist.map((v, i) => (
          <div
            key={i}
            title={v.toFixed(4)}
            style={{
              flex: 1,
              height: `${Math.max(4, (Math.abs(v) / maxHist) * 100)}%`,
              background: v >= 0 ? '#52d6bd' : '#f0a64a',
              borderRadius: '2px 2px 0 0',
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      {/* Bollinger Bands */}
      <div style={blockTitle}>BOLLINGER BANDS (20, 2σ)</div>
      {bollinger ? (
        <>
          <div style={rowStyle}>
            <span>Upper</span>
            <span>{money(bollinger.upper)}</span>
          </div>
          <div style={rowStyle}>
            <span>Middle</span>
            <span>{money(bollinger.middle)}</span>
          </div>
          <div style={rowStyle}>
            <span>Lower</span>
            <span>{money(bollinger.lower)}</span>
          </div>
          <div style={rowStyle}>
            <span>Bandwidth</span>
            <span>{(bollinger.bandwidth * 100).toFixed(2)}%</span>
          </div>
        </>
      ) : (
        <div style={{ color: '#71869a', fontSize: 11 }}>warming up…</div>
      )}

      {/* Fear & Greed style gauge */}
      <div style={blockTitle}>SIMULATED SENTIMENT</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong style={{ fontSize: 22, fontWeight: 500 }}>{Math.round(gaugeClamped)}</strong>
        <span style={{ font: "10px 'DM Mono', monospace", color: '#b5c6d3' }}>{gaugeLabel(gaugeClamped)}</span>
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 5, marginTop: 8, background: 'linear-gradient(90deg, #e06a5a, #e8a64b, #e8d44b, #52d6bd, #2fbf9a)' }}>
        <div
          style={{
            position: 'absolute',
            left: `${gaugeClamped}%`,
            top: -3,
            bottom: -3,
            width: 3,
            background: '#dce7f1',
            transform: 'translateX(-50%)',
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', font: "8px 'DM Mono', monospace", color: '#62788b', marginTop: 4 }}>
        <span>EXTREME FEAR</span>
        <span>NEUTRAL</span>
        <span>EXTREME GREED</span>
      </div>
    </section>
  );
}
