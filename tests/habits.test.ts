import { afterEach, describe, expect, it } from 'vitest';
import { addDays, keyFromDate, type DayKey } from '../src/dates';
import { exampleHabits } from '../src/example';
import {
  buildExport,
  completionRate,
  countInWeek,
  dailyStreak,
  moveHabit,
  parseImport,
  sanitiseHabit,
  streakOf,
  targetLabel,
  toggleDay,
  weekProgress,
  weeklyStreak,
  type Habit,
} from '../src/habits';

declare const process: { env: Record<string, string | undefined> };
const originalTZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTZ;
});

/** Consecutive keys from `start`, `count` days. */
const run = (start: DayKey, count: number) => Array.from({ length: count }, (_, i) => addDays(start, i));
const habit = (done: DayKey[], target = 7, extra: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  name: 'Test',
  color: 'green',
  target,
  createdAt: '2026-01-01',
  archived: false,
  done: [...done].sort(),
  ...extra,
});
let counter = 0;
const nextId = () => `gen-${(counter += 1)}`;

describe('daily streaks', () => {
  const today = '2026-11-17';

  it('counts consecutive days ending today', () => {
    expect(dailyStreak(new Set(run('2026-11-10', 8)), today)).toEqual({ current: 8, best: 8 });
  });

  it('stays alive until today is over', () => {
    expect(dailyStreak(new Set(run('2026-11-10', 7)), today).current).toBe(7);
  });

  it('breaks after a missed day and keeps the best run', () => {
    const done = new Set([...run('2026-10-01', 12), ...run('2026-11-14', 2)]);
    expect(dailyStreak(done, today)).toEqual({ current: 0, best: 12 });
  });

  it('runs straight through the spring and autumn clock changes', () => {
    process.env.TZ = 'America/New_York';
    expect(dailyStreak(new Set(run('2026-03-05', 7)), '2026-03-11').current).toBe(7);
    expect(dailyStreak(new Set(run('2026-10-28', 7)), '2026-11-03').current).toBe(7);
    process.env.TZ = 'Europe/Berlin';
    expect(dailyStreak(new Set(run('2026-03-26', 7)), '2026-04-01').current).toBe(7);
  });

  it('gives the same answer in every time zone (history is calendar days)', () => {
    const done = new Set([...run('2026-10-25', 10), ...run('2026-11-12', 6)]);
    const results = ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Tokyo', 'America/Sao_Paulo'].map((tz) => {
      process.env.TZ = tz;
      return dailyStreak(done, today);
    });
    for (const r of results) expect(r).toEqual({ current: 6, best: 10 });
  });

  it('ignores days in the future and handles an empty history', () => {
    expect(dailyStreak(new Set(['2026-11-18', '2026-11-19']), today)).toEqual({ current: 0, best: 0 });
    expect(dailyStreak(new Set(), today)).toEqual({ current: 0, best: 0 });
  });

  it('follows the local calendar when today comes from a clock', () => {
    process.env.TZ = 'America/New_York';
    const done = new Set(run('2026-11-10', 8)); // through 17 November
    // 23:30 on the 17th in New York: still the 17th, the streak includes today.
    expect(dailyStreak(done, keyFromDate(new Date('2026-11-18T04:30:00Z'))).current).toBe(8);
    // In Tokyo that same instant is the 18th: today not done yet, the streak is still alive.
    process.env.TZ = 'Asia/Tokyo';
    expect(dailyStreak(done, keyFromDate(new Date('2026-11-18T04:30:00Z'))).current).toBe(8);
    // A day later in Tokyo it has lapsed.
    expect(dailyStreak(done, keyFromDate(new Date('2026-11-19T04:30:00Z'))).current).toBe(0);
  });
});

describe('weekly targets', () => {
  // Weeks starting Monday: 26 Oct, 2 Nov, 9 Nov, 16 Nov (today Tue 17 Nov 2026).
  const today = '2026-11-17';
  const threeAWeek = new Set([
    '2026-10-26', '2026-10-28', '2026-10-30', // week of 26 Oct: 3
    '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-07', // week of 2 Nov: 4 (crosses US clock change)
    '2026-11-09', '2026-11-11', '2026-11-13', // week of 9 Nov: 3
    '2026-11-16', // this week: 1 so far
  ]);

  it('counts done days per week', () => {
    expect(countInWeek(threeAWeek, '2026-11-02')).toBe(4);
    expect(countInWeek(threeAWeek, '2026-11-16')).toBe(1);
  });

  it('does not break the streak while the current week is still in progress', () => {
    expect(weeklyStreak(threeAWeek, 3, today, 1)).toEqual({ current: 3, best: 3 });
  });

  it('counts the current week once its target is reached', () => {
    const done = new Set([...threeAWeek, '2026-11-17', '2026-11-18']);
    expect(weeklyStreak(done, 3, '2026-11-18', 1)).toEqual({ current: 4, best: 4 });
  });

  it('breaks on a week that missed the target', () => {
    const done = new Set([...threeAWeek].filter((d) => d !== '2026-11-11'));
    expect(weeklyStreak(done, 3, today, 1)).toEqual({ current: 0, best: 2 });
  });

  it('a higher target is harder to keep', () => {
    expect(weeklyStreak(threeAWeek, 4, today, 1)).toEqual({ current: 0, best: 1 });
  });

  it('depends on where the week starts', () => {
    // With Sunday starts, the weeks are 25 Oct–31 Oct (3), 1–7 Nov (4), 8–14 Nov (3), 15–21 Nov (1).
    expect(weeklyStreak(threeAWeek, 3, today, 0).current).toBe(3);
    // Moving 2 Nov's check-in to Sunday 1 Nov changes nothing for Sunday weeks but breaks a Monday week.
    const shifted = new Set([...threeAWeek].filter((d) => d !== '2026-11-02').concat('2026-11-01'));
    expect(weeklyStreak(shifted, 4, today, 0)).toMatchObject({ current: 0 });
    expect(countInWeek(shifted, '2026-11-01')).toBe(4);
    expect(countInWeek(shifted, '2026-11-02')).toBe(3);
  });

  it('reports this week’s progress against the target', () => {
    expect(weekProgress(habit([...threeAWeek], 3), today, 1)).toEqual({ count: 1, target: 3, met: false });
    expect(weekProgress(habit(['2026-11-16', '2026-11-17']), today, 1)).toEqual({ count: 2, target: 7, met: false });
  });

  it('chooses days or weeks by the habit’s target', () => {
    expect(streakOf(habit([...threeAWeek], 3), today, 1)).toEqual({ current: 3, best: 3, unit: 'week' });
    expect(streakOf(habit(run('2026-11-15', 3)), today, 1)).toEqual({ current: 3, best: 3, unit: 'day' });
  });

  it('labels targets', () => {
    expect(targetLabel(7)).toBe('Every day');
    expect(targetLabel(3)).toBe('3× a week');
    expect(targetLabel(1)).toBe('Once a week');
  });
});

describe('editing history', () => {
  it('toggles a day on and off, keeping the list sorted and unique', () => {
    let h = habit(['2026-11-10', '2026-11-12']);
    h = toggleDay(h, '2026-11-11');
    expect(h.done).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    h = toggleDay(h, '2026-11-10');
    expect(h.done).toEqual(['2026-11-11', '2026-11-12']);
  });

  it('measures the recent completion rate', () => {
    const today = '2026-11-17';
    expect(completionRate(habit(run('2026-10-19', 30)), today, 30)).toBe(1);
    expect(completionRate(habit(run('2026-11-03', 15)), today, 30)).toBe(0.5);
    // A habit created 10 days ago is measured over its own 10 days.
    expect(completionRate(habit(run('2026-11-08', 10), 7, { createdAt: '2026-11-08' }), today, 30)).toBe(1);
  });

  it('moves habits among the active ones, skipping archived habits', () => {
    const list = [
      habit([], 7, { id: 'a' }),
      habit([], 7, { id: 'x', archived: true }),
      habit([], 7, { id: 'b' }),
      habit([], 7, { id: 'c' }),
    ];
    expect(moveHabit(list, 'b', -1).map((h) => h.id)).toEqual(['b', 'x', 'a', 'c']);
    expect(moveHabit(list, 'a', -1)).toBe(list);
    expect(moveHabit(list, 'c', 1)).toBe(list);
  });
});

describe('import and export', () => {
  const today = '2026-11-17';

  it('round-trips an export without the example flag', () => {
    const h = habit(['2026-11-16'], 3, { example: true });
    const file = buildExport([h], 1, new Date('2026-11-17T10:00:00Z'));
    const parsed = parseImport(JSON.stringify(file), nextId, today);
    expect(parsed.habits).toEqual([{ ...h, example: undefined }].map(({ example: _e, ...rest }) => rest));
    expect(parsed.weekStartsOn).toBe(1);
  });

  it('cleans up imported data', () => {
    const parsed = parseImport(
      JSON.stringify({
        habits: [
          { id: 'same', name: '  Stretch   daily ', color: 'mauve', target: 12, done: ['2026-02-30', '2026-11-02', '2026-11-01', '2026-11-02', 5] },
          { id: 'same', name: 'Water', target: 0 },
          { name: '' },
          'nonsense',
        ],
        weekStartsOn: 0,
      }),
      nextId,
      today,
    );
    expect(parsed.weekStartsOn).toBe(0);
    expect(parsed.habits).toHaveLength(2);
    expect(parsed.habits[0]).toMatchObject({
      id: 'same',
      name: 'Stretch daily',
      color: 'violet',
      target: 7,
      done: ['2026-11-01', '2026-11-02'],
      createdAt: '2026-11-01',
    });
    expect(parsed.habits[1].id).not.toBe('same');
    expect(parsed.habits[1].target).toBe(1);
  });

  it('rejects files that are not habit data', () => {
    expect(() => parseImport('{not json', nextId, today)).toThrow('not valid JSON');
    expect(() => parseImport('{"hello":1}', nextId, today)).toThrow('list of habits');
    expect(() => parseImport('{"habits":[{"name":""}]}', nextId, today)).toThrow('No valid habits');
    expect(parseImport('{"habits":[]}', nextId, today).habits).toEqual([]);
  });

  it('sanitises a stored habit', () => {
    expect(sanitiseHabit(null, nextId, today)).toBeNull();
    expect(sanitiseHabit({ name: 'A', id: 'bad id with spaces' }, nextId, today)?.id).toMatch(/^gen-/);
  });
});

describe('example data', () => {
  it('is deterministic, labelled and ends today with live streaks', () => {
    const today = '2026-11-17';
    const a = exampleHabits(today);
    expect(exampleHabits(today)).toEqual(a);
    expect(a.every((h) => h.example && h.done.every((d) => d <= today))).toBe(true);
    const walk = a.find((h) => h.id === 'ex-walk')!;
    const read = a.find((h) => h.id === 'ex-read')!;
    expect(streakOf(walk, today, 1).current).toBe(23);
    expect(streakOf(read, today, 1).current).toBe(9);
    expect(read.done.includes(today)).toBe(false);
    expect(a.filter((h) => h.done.includes(today)).length).toBe(2);
  });
});
