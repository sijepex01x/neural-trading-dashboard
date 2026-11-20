import { useMemo, useState } from 'react';
import { fmtDateTime, fmtTime, money } from '../lib/format';
import type { Trade } from '../lib/types';

type SideFilter = 'ALL' | 'BUY' | 'SELL';
type SortKey = 'time' | 'price' | 'pnl' | 'amountUsd';
type SortDir = 'asc' | 'desc';

interface TradeHistoryProps {
  trades: Trade[];
  onClear: () => void;
}

function fmtQty(q: number): string {
  return String(Number(q.toFixed(6)));
}

export default function TradeHistory({ trades, onClear }: TradeHistoryProps) {
  const [sideFilter, setSideFilter] = useState<SideFilter>('ALL');
  const [pairFilter, setPairFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [confirmClear, setConfirmClear] = useState(false);

  const pairs = useMemo(
    () => Array.from(new Set(trades.map((t) => t.pair))),
    [trades],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trades.filter((t) => {
      if (sideFilter !== 'ALL' && t.side !== sideFilter) return false;
      if (pairFilter !== 'ALL' && t.pair !== pairFilter) return false;
      if (
        q &&
        !(
          t.pair.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.side.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [trades, sideFilter, pairFilter, search]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = sortKey === 'pnl' ? (a.pnl ?? 0) : a[sortKey];
      const bv = sortKey === 'pnl' ? (b.pnl ?? 0) : b[sortKey];
      return (av - bv) * dir;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortIndicator = (key: SortKey): string =>
    sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const exportCsv = () => {
    const header = ['Asset', 'Side', 'Price', 'Qty', 'Amount USD', 'Time', 'Demo P&L', 'Status'];
    const escape = (v: string): string =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = sorted.map((t) =>
      [
        t.pair,
        t.side,
        t.price.toFixed(2),
        fmtQty(t.qty),
        t.amountUsd.toFixed(2),
        fmtDateTime(t.time),
        t.pnl === null ? '' : t.pnl.toFixed(2),
        t.status,
      ]
        .map(escape)
        .join(','),
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neural-trading-history.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (confirmClear) {
      setConfirmClear(false);
      onClear();
    } else {
      setConfirmClear(true);
    }
  };

  return (
    <section className="panel history-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">EXECUTION LOG</div>
          <h2>Trade History</h2>
        </div>
      </div>
      <div className="filters">
        <div className="filter-group" role="group" aria-label="Filter by side">
          {(['ALL', 'BUY', 'SELL'] as SideFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              className={sideFilter === s ? 'selected' : ''}
              aria-pressed={sideFilter === s}
              onClick={() => setSideFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          aria-label="Filter by pair"
          value={pairFilter}
          onChange={(e) => setPairFilter(e.target.value)}
        >
          <option value="ALL">All pairs</option>
          {pairs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Search trades"
          placeholder="Search trades…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="text-btn" onClick={exportCsv}>
          EXPORT CSV ↓
        </button>
        <button type="button" className="text-btn" onClick={handleClear}>
          {confirmClear ? 'Click again to confirm' : 'Clear history'}
        </button>
      </div>
      <p className="muted">
        Showing {sorted.length} of {trades.length} trades
      </p>
      {sorted.length === 0 ? (
        <p className="muted">No trades match the current filters.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ASSET</th>
                <th>SIDE</th>
                <th>
                  <button type="button" onClick={() => toggleSort('price')}>
                    PRICE{sortIndicator('price')}
                  </button>
                </th>
                <th>QTY</th>
                <th>
                  <button type="button" onClick={() => toggleSort('amountUsd')}>
                    AMOUNT USD{sortIndicator('amountUsd')}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort('time')}>
                    TIME{sortIndicator('time')}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort('pnl')}>
                    DEMO P&amp;L{sortIndicator('pnl')}
                  </button>
                </th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td>{t.pair}</td>
                  <td>
                    <span className={`side ${t.side.toLowerCase()}`}>{t.side}</span>
                  </td>
                  <td>{money(t.price)}</td>
                  <td>{fmtQty(t.qty)}</td>
                  <td>{money(t.amountUsd)}</td>
                  <td>{fmtTime(t.time)}</td>
                  <td className={t.pnl === null ? 'muted' : t.pnl >= 0 ? 'positive' : 'negative'}>
                    {t.pnl === null ? '—' : `${t.pnl >= 0 ? '+' : ''}${money(t.pnl)}`}
                  </td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
