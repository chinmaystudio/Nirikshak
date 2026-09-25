export function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export const NOW = new Date(2026, 8, 11, 10, 30); // 11 Sep 2026 10:30 IST — demo clock

export function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

export function money(n: number): string {
  if (n >= 1e7) return `₹ ${inr(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹ ${inr(n / 1e5)} L`;
  return `₹ ${inr(n)}`;
}

export const cr = (n: number) => `₹ ${inr(n)} Cr`;

export function fmtDate(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateShort(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function fmtDateCompact(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function fmtDateTime(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function daysUntil(d: string): number {
  const dt = new Date(d + 'T00:00:00');
  const now = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  return Math.round((dt.getTime() - now.getTime()) / 86400000);
}

export function daysLeftLabel(d: string): string {
  const n = daysUntil(d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 0) return `${Math.abs(n)}d overdue`;
  return `${n}d left`;
}

export function timeAgo(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const diff = NOW.getTime() - dt.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(dt);
}

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function downloadFile(name: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCSV(name: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  downloadFile(name, csv, 'text/csv;charset=utf-8');
}

export function initials(name: string): string {
  return name
    .replace(/(Pvt\.?|Ltd\.?|LLP|&)/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
