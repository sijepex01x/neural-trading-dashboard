/** Number / date formatting helpers for the dashboard. All data is simulated. */

export function money(n: number, digits = 2): string {
  return (
    '$' +
    n.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

export function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function fmtTime(ts: number): string {
  // id-ID locale, 24h. Some ICU datasets render the id-ID time separator as
  // '.', so normalise it to ':' to guarantee the HH:MM:SS shape.
  return new Date(ts)
    .toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(/\./g, ':');
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) +
    ' ' +
    fmtTime(ts)
  );
}

function trimCompact(v: number): string {
  // 2 decimals, trailing zeros stripped: 12.80 -> '12.8', 1.28 -> '1.28'.
  return parseFloat(v.toFixed(2)).toString();
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return sign + trimCompact(abs / 1e9) + 'B';
  if (abs >= 1e6) return sign + trimCompact(abs / 1e6) + 'M';
  if (abs >= 1e3) return sign + trimCompact(abs / 1e3) + 'K';
  return fmtNum(n);
}
