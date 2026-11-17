/**
 * Calendar days as "YYYY-MM-DD" keys.
 *
 * A habit is done on a calendar day, not at an instant, so history is stored as day keys. The
 * only time-zone-dependent step is turning "now" into today's key (local calendar). All other
 * arithmetic maps keys to whole UTC day numbers, where every day is exactly 24 hours: daylight
 * saving changes and travelling across time zones can never shift, merge or split stored days.
 */

export type DayKey = string;

const MS_PER_DAY = 86_400_000;
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's key (or any instant's key) in the local calendar. */
export function keyFromDate(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${String(y).padStart(4, '0')}-${m}-${d}`;
}

export function isValidKey(key: unknown): key is DayKey {
  if (typeof key !== 'string') return false;
  const m = KEY_RE.exec(key);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Whole days since 1970-01-01 (independent of the time zone). */
export function dayNumber(key: DayKey): number {
  const m = KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid day key: ${key}`);
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY);
}

export function keyFromNumber(n: number): DayKey {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(key: DayKey, days: number): DayKey {
  return keyFromNumber(dayNumber(key) + days);
}

export function diffDays(later: DayKey, earlier: DayKey): number {
  return dayNumber(later) - dayNumber(earlier);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(key: DayKey): number {
  // 1970-01-01 was a Thursday (4).
  return (((dayNumber(key) + 4) % 7) + 7) % 7;
}

/** First day of the week containing `key`; weeks start on Sunday (0) or Monday (1). */
export function weekStart(key: DayKey, weekStartsOn: 0 | 1): DayKey {
  const offset = (weekday(key) - weekStartsOn + 7) % 7;
  return addDays(key, -offset);
}

/** A calendar Date at local noon for formatting with Intl (noon avoids any DST edge). */
export function toLocalDate(key: DayKey): Date {
  const n = dayNumber(key);
  const utc = new Date(n * MS_PER_DAY);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12);
}

export function monthOf(key: DayKey): number {
  return Number(key.slice(5, 7)) - 1;
}

export function dayOfMonth(key: DayKey): number {
  return Number(key.slice(8, 10));
}
