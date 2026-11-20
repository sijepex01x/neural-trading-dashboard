export type TabKey = 'overview' | 'market' | 'strategy' | 'history';

interface SidebarProps {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  onSettings: () => void;
}

const TABS: { key: TabKey; label: string; glyph: string }[] = [
  { key: 'overview', label: 'Overview', glyph: '◈' },
  { key: 'market', label: 'Market Analysis', glyph: '⌁' },
  { key: 'strategy', label: 'AI Strategy', glyph: '✳' },
  { key: 'history', label: 'Trade History', glyph: '▤' },
];

export default function Sidebar({ tab, onTab, onSettings }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandmark">N</div>
        <div>
          NEURAL<span>TRADING INTELLIGENCE</span>
        </div>
      </div>
      <div className="nav-label">WORKSPACE</div>
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onTab(t.key)}
          className={`nav ${tab === t.key ? 'active' : ''}`}
          aria-pressed={tab === t.key}
        >
          <b>{t.glyph}</b>
          {t.label}
          {t.key === 'overview' && <i />}
        </button>
      ))}
      <div className="nav-label second">SYSTEM</div>
      <button className="nav" onClick={onSettings}>
        ⚙　Settings
      </button>
      <div className="side-bottom">
        <div className="status">
          <span className="pulse" /> SYSTEM NOMINAL
        </div>
        <small>
          NEURAL CORE v1.0.4
          <br />
          DEMO ENVIRONMENT
        </small>
        <div className="profile">
          <div className="avatar">AI</div>
          <div>
            Operator<span>Free workspace</span>
          </div>
          <b>•••</b>
        </div>
      </div>
    </aside>
  );
}
