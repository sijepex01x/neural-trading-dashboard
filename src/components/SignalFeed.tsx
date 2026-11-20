import { fmtTime } from '../lib/format';
import type { SignalItem } from '../lib/types';
import { signalActionClass, signalActionLabel } from './StrategyPanel';

interface SignalFeedProps {
  signals: SignalItem[];
}

export default function SignalFeed({ signals }: SignalFeedProps) {
  const ordered = [...signals].reverse();
  return (
    <section className="panel signal-feed">
      <div className="panel-head">
        <div>
          <div className="eyebrow">AI SIGNALS / DEMO</div>
          <h2>Live AI Signal Feed</h2>
        </div>
        <span className="tiny-live">
          <i /> LIVE
        </span>
      </div>
      {ordered.length === 0 ? (
        <p className="muted">Waiting for the next signal…</p>
      ) : (
        <ul className="signal-list">
          {ordered.map((s) => (
            <li key={s.id} className="signal-item">
              <span className="signal-time">{fmtTime(s.time)}</span>
              <span className="signal-symbol">{s.symbol}</span>
              <span className={`signal-badge ${signalActionClass(s.action)}`}>
                {signalActionLabel(s.action)}
              </span>
              <span className="signal-confidence">{s.confidence.toFixed(1)}%</span>
              <span className="signal-reason">{s.reason}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="market-note">
        Demo signals derived from simulated RSI/MACD — not financial advice.
      </div>
    </section>
  );
}
