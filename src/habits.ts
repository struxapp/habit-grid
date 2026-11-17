import { addDays, dayNumber, diffDays, isValidKey, weekStart, type DayKey } from './dates';

export const COLORS = ['violet', 'blue', 'teal', 'green', 'amber', 'orange', 'rose', 'pink'] as const;
export type HabitColor = (typeof COLORS)[number];

export interface Habit {
  id: string;
  name: string;
  color: HabitColor;
  /** Times per week; 7 means every day. */
  target: number;
  createdAt: DayKey;
  archived: boolean;
  /** Days the habit was done, sorted ascending, unique. */
  done: DayKey[];
  example?: boolean;
}

export interface Streak {
  current: number;
  best: number;
  unit: 'day' | 'week';
}

export const MAX_NAME = 60;

export function isDaily(habit: Pick<Habit, 'target'>): boolean {
  return habit.target >= 7;
}

export function targetLabel(target: number): string {
  if (target >= 7) return 'Every day';
  return target === 1 ? 'Once a week' : `${target}× a week`;
}

/** Adds or removes a day, keeping `done` sorted and unique. */
export function toggleDay(habit: Habit, key: DayKey): Habit {
  const set = new Set(habit.done);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return { ...habit, done: [...set].sort() };
}

/** Number of done days in the week that starts on `startKey`. */
export function countInWeek(done: ReadonlySet<DayKey>, startKey: DayKey): number {
  let count = 0;
  for (let i = 0; i < 7; i += 1) if (done.has(addDays(startKey, i))) count += 1;
  return count;
}

/**
 * Daily streak: consecutive done days ending today. If today is not done yet the streak that
 * ended yesterday is still current (the day is not over). Best: the longest run ever.
 */
export function dailyStreak(done: ReadonlySet<DayKey>, today: DayKey): { current: number; best: number } {
  let cursor = done.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (done.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  const days = [...done].filter((k) => diffDays(today, k) >= 0).sort();
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const key of days) {
    const n = dayNumber(key);
    run = previous !== null && n === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = n;
  }
  return { current, best: Math.max(best, current) };
}

/**
 * Weekly streak for a "N times a week" habit: consecutive weeks that reached the target.
 * The current week counts once it reaches the target; until then it does not break the streak.
 */
export function weeklyStreak(
  done: ReadonlySet<DayKey>,
  target: number,
  today: DayKey,
  weekStartsOn: 0 | 1,
): { current: number; best: number } {
  const thisWeek = weekStart(today, weekStartsOn);
  const met = (start: DayKey) => countInWeek(done, start) >= target;

  let current = 0;
  let cursor = met(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  while (met(cursor)) {
    current += 1;
    cursor = addDays(cursor, -7);
  }

  const past = [...done].filter((k) => diffDays(today, k) >= 0).sort();
  let best = 0;
  if (past.length > 0) {
    let run = 0;
    for (let start = weekStart(past[0], weekStartsOn); diffDays(thisWeek, start) >= 0; start = addDays(start, 7)) {
      if (met(start)) {
        run += 1;
        best = Math.max(best, run);
      } else if (start !== thisWeek) {
        run = 0;
      }
    }
  }
  return { current, best: Math.max(best, current) };
}

export function streakOf(habit: Habit, today: DayKey, weekStartsOn: 0 | 1): Streak {
  const done = new Set(habit.done);
  if (isDaily(habit)) return { ...dailyStreak(done, today), unit: 'day' };
  return { ...weeklyStreak(done, habit.target, today, weekStartsOn), unit: 'week' };
}

/** Progress this week: done days so far versus the weekly target (7 for daily habits). */
export function weekProgress(
  habit: Habit,
  today: DayKey,
  weekStartsOn: 0 | 1,
): { count: number; target: number; met: boolean } {
  const count = countInWeek(new Set(habit.done), weekStart(today, weekStartsOn));
  const target = Math.min(7, habit.target);
  return { count, target, met: count >= target };
}

/** Share of days done over the last `days` days (daily habits) or weeks meeting target. */
export function completionRate(habit: Habit, today: DayKey, days = 30): number {
  const done = new Set(habit.done);
  const firstDay = habit.createdAt && diffDays(today, habit.createdAt) < days - 1 ? habit.createdAt : addDays(today, -(days - 1));
  const span = Math.max(1, diffDays(today, firstDay) + 1);
  let count = 0;
  for (let i = 0; i < span; i += 1) if (done.has(addDays(today, -i))) count += 1;
  const expected = isDaily(habit) ? span : (span / 7) * habit.target;
  return Math.min(1, count / Math.max(1, expected));
}

export function formatStreak(n: number, unit: 'day' | 'week'): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

// ---------- validation, import and export ----------

export interface ExportFile {
  app: 'habit-grid';
  version: 1;
  exportedAt: string;
  weekStartsOn: 0 | 1;
  habits: Habit[];
}

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
}

/** Validates one habit from storage or an import file; returns null if it is unusable. */
export function sanitiseHabit(raw: unknown, fallbackId: () => string, today: DayKey): Habit | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = cleanName(r.name);
  if (!name) return null;
  const color = COLORS.includes(r.color as HabitColor) ? (r.color as HabitColor) : 'violet';
  const target =
    typeof r.target === 'number' && Number.isFinite(r.target) ? Math.min(7, Math.max(1, Math.round(r.target))) : 7;
  const doneRaw = Array.isArray(r.done) ? r.done : [];
  const done = [...new Set(doneRaw.filter(isValidKey))].sort();
  const createdAt = isValidKey(r.createdAt) ? r.createdAt : (done[0] ?? today);
  const id = typeof r.id === 'string' && /^[\w-]{1,64}$/.test(r.id) ? r.id : fallbackId();
  const habit: Habit = { id, name, color, target, createdAt, archived: r.archived === true, done };
  if (r.example === true) habit.example = true;
  return habit;
}

/** Parses an export file. Throws an Error with a readable message if the file is not usable. */
export function parseImport(text: string, fallbackId: () => string, today: DayKey): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!data || typeof data !== 'object') throw new Error('This file does not contain Habit Grid data.');
  const r = data as Record<string, unknown>;
  const list = Array.isArray(r.habits) ? r.habits : Array.isArray(data) ? (data as unknown[]) : null;
  if (!list) throw new Error('This file does not contain a list of habits.');
  const habits: Habit[] = [];
  const ids = new Set<string>();
  for (const item of list) {
    const habit = sanitiseHabit(item, fallbackId, today);
    if (!habit) continue;
    if (ids.has(habit.id)) habit.id = fallbackId();
    ids.add(habit.id);
    habits.push(habit);
  }
  if (habits.length === 0 && list.length > 0) throw new Error('No valid habits were found in this file.');
  return {
    app: 'habit-grid',
    version: 1,
    exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : new Date().toISOString(),
    weekStartsOn: r.weekStartsOn === 0 ? 0 : 1,
    habits,
  };
}

export function buildExport(habits: Habit[], weekStartsOn: 0 | 1, now: Date): ExportFile {
  return {
    app: 'habit-grid',
    version: 1,
    exportedAt: now.toISOString(),
    weekStartsOn,
    habits: habits.map(({ example: _example, ...h }) => ({ ...h, done: [...h.done] })),
  };
}

/** Moves the habit with `id` one place up (-1) or down (+1) among the active habits. */
export function moveHabit(habits: Habit[], id: string, direction: -1 | 1): Habit[] {
  const active = habits.filter((h) => !h.archived);
  const index = active.findIndex((h) => h.id === id);
  const swapWith = index + direction;
  if (index < 0 || swapWith < 0 || swapWith >= active.length) return habits;
  const a = habits.indexOf(active[index]);
  const b = habits.indexOf(active[swapWith]);
  const next = [...habits];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
