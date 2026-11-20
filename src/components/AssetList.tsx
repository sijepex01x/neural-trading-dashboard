import { fmtPct, money } from '../lib/format';
import type { AssetQuote } from '../lib/types';
import Sparkline from './Sparkline';

interface AssetListProps {
  assets: AssetQuote[];
  selected: string;
  onSelect: (symbol: string) => void;
  onViewAll: () => void;
}

export default function AssetList({ assets, selected, onSelect, onViewAll }: AssetListProps) {
  return (
    <section className="panel market-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">MARKET INTELLIGENCE</div>
          <h2>Asset Performance</h2>
        </div>
        <button className="text-btn" onClick={onViewAll}>
          VIEW ALL ↗
        </button>
      </div>
      <div className="asset-list">
        {assets.map((a) => (
          <button
            key={a.symbol}
            className="asset"
            aria-pressed={selected === a.symbol}
            onClick={() => onSelect(a.symbol)}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <div className="coin">{a.icon}</div>
            <div className="asset-name">
              {a.name}
              <span>{a.pair}</span>
            </div>
            <Sparkline values={a.history} up={a.changePct >= 0} />
            <div className="asset-price">
              {money(a.price)}
              <span className={a.changePct >= 0 ? 'positive' : 'negative'}>
                {fmtPct(a.changePct)}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="market-note">
        <span className="pulse" /> MARKET FEED CONNECTED <small>SIMULATED DATA</small>
      </div>
    </section>
  );
}
