import type { TabKey } from './Sidebar';

const TAB_NAMES: Record<TabKey, string> = {
  overview: 'OVERVIEW',
  market: 'MARKET ANALYSIS',
  strategy: 'AI STRATEGY',
  history: 'TRADE HISTORY',
};

interface TopbarProps {
  tab: TabKey;
  running: boolean;
  onNotify: () => void;
}

export default function Topbar({ tab, running, onNotify }: TopbarProps) {
  const date = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return (
    <header className="topbar">
      <div className="crumb">
        WORKSPACE <span>/</span> {TAB_NAMES[tab]}
      </div>
      <div className="top-right">
        <span className="live">
          <i /> {running ? 'SIMULATION LIVE' : 'SIMULATION PAUSED'}
        </span>
        <span className="date">◷　{date}</span>
        <button className="icon-btn" aria-label="Notifications" onClick={onNotify}>
          ♧
        </button>
      </div>
    </header>
  );
}
