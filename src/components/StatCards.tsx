import { money } from '../lib/format';
import Sparkline from './Sparkline';

interface StatCardsProps {
  portfolio: number;
  pnl: number;
  pnlPct: number;
  wins: number;
  losses: number;
  winRate: number;
  activePositions: number;
  maxPositions: number;
  sparkValues: number[];
  positionFill: number;
}

export default function StatCards({
  portfolio,
  pnl,
  pnlPct,
  wins,
  losses,
  winRate,
  activePositions,
  maxPositions,
  sparkValues,
  positionFill,
}: StatCardsProps) {
  const pnlText = `${pnl >= 0 ? '+' : ''}${money(pnl)}`;
  const pctText = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`;
  const pnlClass = pnl >= 0 ? 'positive' : 'negative';
  const pctClass = pnlPct >= 0 ? 'positive' : 'negative';

  // Mini-bars: normalize the first 12 spark values to 15–100% heights.
  const barInput = sparkValues.slice(0, 12);
  const barMin = barInput.length > 0 ? Math.min(...barInput) : 0;
  const barMax = barInput.length > 0 ? Math.max(...barInput) : 0;
  const barHeights = barInput.map((v) =>
    barMax === barMin ? 50 : 15 + ((v - barMin) / (barMax - barMin)) * 85,
  );

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-head">
          TOTAL PORTFOLIO <span>↗</span>
        </div>
        <strong>{money(portfolio)}</strong>
        <div className={`stat-foot ${pctClass}`}>
          {pnlPct >= 0 ? '↗' : '↘'} {pctText} <small>vs last 30 days</small>
        </div>
        <Sparkline values={sparkValues} up={pnlPct >= 0} />
      </div>
      <div className="stat">
        <div className="stat-head">
          TOTAL P&amp;L <span>◉</span>
        </div>
        <strong className={pnlClass}>{pnlText}</strong>
        <div className={`stat-foot ${pctClass}`}>
          {pnlPct >= 0 ? '↗' : '↘'} {pctText} <small>net performance</small>
        </div>
        <Sparkline values={sparkValues} up={pnl >= 0} />
      </div>
      <div className="stat">
        <div className="stat-head">
          WIN RATE <span>⌁</span>
        </div>
        <strong>
          {winRate.toFixed(1)}
          <span className="unit">%</span>
        </strong>
        <div className="stat-foot">
          <span className="muted">
            {wins} wins / {wins + losses} trades
          </span>
        </div>
        <div className="mini-bars">
          {barHeights.map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="stat">
        <div className="stat-head">
          ACTIVE POSITIONS <span>▦</span>
        </div>
        <strong>
          {String(activePositions).padStart(2, '0')}
          <span className="unit"> / {String(maxPositions).padStart(2, '0')}</span>
        </strong>
        <div className="stat-foot">
          <span className="muted">{activePositions} open</span>
        </div>
        <div className="position-dots">
          {Array.from({ length: maxPositions }, (_, i) => (
            <i
              key={i}
              style={i < positionFill ? { background: '#4dcdb8' } : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
