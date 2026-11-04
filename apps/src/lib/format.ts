// Display helpers: times, initials, avatar colors.

const WEEKDAYS = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const two = (n: number) => String(n).padStart(2, '0');

/** Full local date and time, for tooltips: "14:05 · 04/11/2026". */
export function fullTime(ms: number): string {
  const d = new Date(ms);
  return `${clockTime(ms)} · ${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** HH:mm today, "Hôm qua", weekday this week, else dd/MM. */
export function shortTime(ms: number, now = Date.now()): string {
  if (!ms) return '';
  const d = new Date(ms);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (ms >= startOfToday) return `${two(d.getHours())}:${two(d.getMinutes())}`;
  if (ms >= startOfToday - 86_400_000) return 'Hôm qua';
  if (ms >= startOfToday - 6 * 86_400_000) return WEEKDAYS[d.getDay()]!;
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}`;
}

/** HH:mm, always (rows under a day header). */
export const clockTime = (ms: number) => {
  const d = new Date(ms);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** "Hôm nay" / "Hôm qua" / dd/MM/yyyy for date dividers. */
export function dayLabel(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const t = new Date(now);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, t)) return 'Hôm nay';
  if (sameDay(d, new Date(now - 86_400_000))) return 'Hôm qua';
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Relative "last seen" from an epoch value (ms or s). */
export function lastSeenLabel(value: number, now = Date.now()): string {
  if (!value) return '';
  const ms = value < 10_000_000_000 ? value * 1000 : value;
  const minutes = Math.max(0, Math.round((now - ms) / 60_000));
  if (minutes < 2) return 'Vừa truy cập';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

/** Post time: "Vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", then dd/MM/yyyy. */
export function agoLabel(ms: number, now = Date.now()): string {
  if (!ms) return '';
  const minutes = Math.floor(Math.max(0, now - ms) / 60_000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  const d = new Date(ms);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts.length > 1 ? parts.at(-2)! : parts[0]!;
  const last = parts.at(-1)!;
  return (parts.length > 1 ? first[0]! + last[0]! : last.slice(0, 2)).toUpperCase();
}

const AVATAR_COLORS = ['#BE123C', '#1D4ED8', '#7C3AED', '#15803D', '#B45309', '#0E7490', '#BE185D', '#4338CA'];

export function colorFor(key: string): string {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}
