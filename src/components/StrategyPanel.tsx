import type { SignalAction, SignalItem, StrategyId } from '../lib/types';

export const STRATEGY_META: { id: StrategyId; name: string; description: string }[] = [
  { id: 'scalper', name: 'Neural Scalper', description: 'Adaptive momentum strategy' },
  { id: 'momentum', name: 'Momentum Rider', description: 'Trend-following rider' },
  { id: 'reversion', name: 'Mean Reversion', description: 'Buy dips, sell rips' },
];

export function signalActionClass(action: SignalAction): string {
  if (action === 'STRONG BUY' || action === 'BUY') return 'positive';
  if (action === 'STRONG SELL' || action === 'SELL') return 'negative';
  return 'muted';
}

export function signalActionLabel(action: SignalAction): string {
  return action;
}

interface StrategyPanelProps {
  strategy: StrategyId;
  onStrategyChange: (s: StrategyId) => void;
  risk: number;
  onRiskChange: (n: number) => void;
  confidence: number;
  onConfidenceChange: (n: number) => void;
  signal: SignalItem | null;
}

export default function StrategyPanel({
  strategy,
  onStrategyChange,
  risk,
  onRiskChange,
  confidence,
  onConfidenceChange,
  signal,
}: StrategyPanelProps) {
  const current = STRATEGY_META.find((s) => s.id === strategy) ?? STRATEGY_META[0];
  return (
    <section className="panel strategy-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">AUTONOMOUS SYSTEM</div>
          <h2>AI Strategy Control</h2>
        </div>
        <span className="badge">BETA</span>
      </div>
      <div className="strategy-picker" role="group" aria-label="AI strategy">
        {STRATEGY_META.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`strategy-option ${strategy === s.id ? 'selected' : ''}`}
            aria-pressed={strategy === s.id}
            onClick={() => onStrategyChange(s.id)}
          >
            {s.name}
            <span>{s.description}</span>
          </button>
        ))}
      </div>
      <div className="strategy-state">
        <div className="strategy-icon">✳</div>
        <div>
          {current.name.toUpperCase()}
          <span>{current.description}</span>
        </div>
        <span className="enabled">ENABLED</span>
      </div>
      <div className="control">
        <div>
          <label htmlFor="risk-range">RISK TOLERANCE</label>
          <b>{risk}%</b>
        </div>
        <input
          id="risk-range"
          type="range"
          min="5"
          max="90"
          value={risk}
          aria-label="Risk tolerance"
          onChange={(e) => onRiskChange(Number(e.target.value))}
        />
        <div className="range-label">
          <span>CONSERVATIVE</span>
          <span>AGGRESSIVE</span>
        </div>
      </div>
      <div className="control">
        <div>
          <label htmlFor="confidence-range">AI CONFIDENCE THRESHOLD</label>
          <b>{confidence}%</b>
        </div>
        <input
          id="confidence-range"
          type="range"
          min="50"
          max="99"
          value={confidence}
          aria-label="AI confidence threshold"
          onChange={(e) => onConfidenceChange(Number(e.target.value))}
        />
        <div className="range-label">
          <span>50%</span>
          <span>99%</span>
        </div>
      </div>
      <div className="signal">
        <span>◈　CURRENT AI SIGNAL</span>
        {signal ? (
          <>
            <b className={signalActionClass(signal.action)}>
              {signalActionLabel(signal.action)}
            </b>
            <small>Confidence score: {signal.confidence.toFixed(1)}% · Demo signal</small>
            <small>{signal.reason}</small>
          </>
        ) : (
          <>
            <b className="muted">NO SIGNAL</b>
            <small>Waiting for the next signal…</small>
          </>
        )}
      </div>
    </section>
  );
}
