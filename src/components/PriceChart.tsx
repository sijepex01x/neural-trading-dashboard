import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type RangeKey = '1H' | '4H' | '1D' | '1W' | '1M';

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
}

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RANGES: RangeKey[] = ['1H', '4H', '1D', '1W', '1M'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtTime(t: number): string {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtTimeSec(t: number): string {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Compact y-axis label: money() normally, 0 decimals for large values. */
function yLabel(v: number): string {
  return v >= 1000 ? '$' + Math.round(v).toLocaleString('en-US') : money(v);
}

function yDomain(candles: Candle[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.l < min) min = c.l;
    if (c.h > max) max = c.h;
  }
  if (!isFinite(min) || !isFinite(max)) return { min: 0, max: 1 };
  if (max === min) {
    max = min + 1;
    min = min - 1;
  }
  const pad = (max - min) * 0.06;
  return { min: min - pad, max: max + pad };
}

interface PriceChartProps {
  candles: Candle[];
  symbol: string;
  price: number;
  changePct: number;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
  showBollinger: boolean;
  onToggleBollinger: () => void;
  bollinger: BollingerResult | null;
}

interface Hover {
  index: number;
  x: number;
  y: number;
}

export default function PriceChart({
  candles,
  symbol,
  price,
  changePct,
  range,
  onRangeChange,
  showBollinger,
  onToggleBollinger,
  bollinger,
}: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<Hover | null>(null);

  // Resize: ResizeObserver + DPR cap 2 (DPR applied at draw time).
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Redraw on any prop change (candles, Bollinger state, hover, size).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length < 2 || size.w <= 0 || size.h <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = size.w;
    const h = size.h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const n = candles.length;
    const { min, max } = yDomain(candles);
    const volH = h * 0.18;
    const plotH = h - volH;
    const yOf = (v: number) => ((max - v) / (max - min)) * plotH;
    const xOf = (i: number) => (i / (n - 1)) * w;
    const closes = candles.map((c) => c.c);

    // Horizontal grid lines (5).
    ctx.strokeStyle = '#1c2b3b';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 1]);
    for (let g = 0; g < 5; g++) {
      const y = (g / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Bollinger bands — the single upper/lower values are the latest band
    // levels, drawn as horizontal reference levels with a translucent fill.
    if (showBollinger && bollinger) {
      const yU = yOf(bollinger.upper);
      const yL = yOf(bollinger.lower);
      ctx.fillStyle = 'rgba(72, 200, 213, 0.06)';
      ctx.fillRect(0, Math.min(yU, yL), w, Math.abs(yL - yU));
      ctx.strokeStyle = 'rgba(72, 200, 213, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      for (const y of [yU, yL]) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Volume bars along the bottom 18% of the plot.
    const maxV = Math.max(...candles.map((c) => c.v), 1);
    const barW = Math.max(1, (w / n) * 0.6);
    for (let i = 0; i < n; i++) {
      const c = candles[i];
      const bh = (c.v / maxV) * volH;
      ctx.fillStyle = c.c >= c.o ? 'rgba(82, 214, 189, 0.35)' : 'rgba(240, 166, 74, 0.35)';
      ctx.fillRect(xOf(i) - barW / 2, plotH + (volH - bh), barW, bh);
    }

    // Area fill under the close-price line (cyan gradient).
    const grad = ctx.createLinearGradient(0, 0, 0, plotH);
    grad.addColorStop(0, 'rgba(53, 201, 213, 0.22)');
    grad.addColorStop(1, 'rgba(53, 201, 213, 0)');
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(closes[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(closes[i]));
    ctx.lineTo(xOf(n - 1), plotH);
    ctx.lineTo(xOf(0), plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Close line (cyan, 1.7px).
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(closes[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(closes[i]));
    ctx.strokeStyle = '#48c8d5';
    ctx.lineWidth = 1.7;
    ctx.stroke();

    // AI trendline: least-squares linear regression over closes, dashed orange.
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += closes[i];
      sumXY += i * closes[i];
      sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(intercept));
    ctx.lineTo(xOf(n - 1), yOf(intercept + slope * (n - 1)));
    ctx.strokeStyle = '#e8a64b';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hover crosshair + dot on the price line.
    if (hover) {
      const i = hover.index;
      const hx = xOf(i);
      const hy = yOf(closes[i]);
      ctx.strokeStyle = 'rgba(220, 231, 241, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, plotH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, hy);
      ctx.lineTo(w, hy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#48c8d5';
      ctx.beginPath();
      ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0c141e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [candles, showBollinger, bollinger, hover, size]);

  const { min, max } = yDomain(candles);
  const yTicks = [0, 1, 2, 3, 4].map((i) => max - ((max - min) * i) / 4);
  const xTickIdx =
    candles.length >= 2
      ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.min(candles.length - 1, Math.round(f * (candles.length - 1))))
      : [];
  const xTicks = Array.from(new Set(xTickIdx));

  const setHoverFromEvent = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (candles.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const index = Math.max(0, Math.min(candles.length - 1, Math.round((x / rect.width) * (candles.length - 1))));
    setHover({ index, x, y });
  };

  const hoverCandle = hover ? candles[hover.index] : null;
  const changeClass = changePct >= 0 ? 'positive' : 'negative';
  const changeText = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;

  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">PRICE ACTION / {symbol}</div>
          <h2>
            {money(price)} <span className={`${changeClass} small-change`}>{changeText}</span>
          </h2>
        </div>
        <div className="ranges">
          {RANGES.map((r) => (
            <button key={r} onClick={() => onRangeChange(r)} className={range === r ? 'selected' : ''}>
              {r}
            </button>
          ))}
          <button type="button" aria-pressed={showBollinger} onClick={onToggleBollinger}>
            Bollinger bands
          </button>
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i /> BTC PRICE
        </span>
        <span>● AI TRENDLINE</span>
      </div>
      <div className="chart-area" ref={areaRef}>
        {candles.length < 2 ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#71869a', fontSize: 12 }}>
            No simulated data for this range yet.
          </div>
        ) : (
          <>
            <div className="y-labels">
              {yTicks.map((v, i) => (
                <span key={i}>{yLabel(v)}</span>
              ))}
            </div>
            <canvas
              ref={canvasRef}
              className="chart-canvas"
              style={{ width: '100%', height: '100%', display: 'block', touchAction: 'manipulation' }}
              onPointerMove={setHoverFromEvent}
              onPointerDown={setHoverFromEvent}
              onPointerLeave={() => setHover(null)}
            />
            {hover && hoverCandle && (
              <div
                className="chart-tooltip"
                style={{
                  position: 'absolute',
                  left: Math.min(Math.max(hover.x + 12, 4), Math.max(size.w - 150, 4)),
                  top: Math.max(hover.y - 12, 4),
                  background: '#101a26',
                  border: '1px solid #2c4a5a',
                  borderRadius: 5,
                  padding: '8px 10px',
                  font: "10px 'DM Mono', monospace",
                  color: '#dce7f1',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  zIndex: 2,
                }}
              >
                <div>{fmtTimeSec(hoverCandle.t)}</div>
                <div>
                  O {money(hoverCandle.o)} H {money(hoverCandle.h)}
                </div>
                <div>
                  L {money(hoverCandle.l)} C {money(hoverCandle.c)}
                </div>
                <div>Vol {hoverCandle.v.toLocaleString('en-US')}</div>
              </div>
            )}
          </>
        )}
      </div>
      {candles.length >= 2 && (
        <div className="x-labels">
          {xTicks.map((i) => (
            <span key={i}>{fmtTime(candles[i].t)}</span>
          ))}
        </div>
      )}
    </section>
  );
}
