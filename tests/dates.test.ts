import { afterEach, describe, expect, it } from 'vitest';
import {
  addDays,
  dayNumber,
  diffDays,
  isValidKey,
  keyFromDate,
  keyFromNumber,
  toLocalDate,
  weekStart,
  weekday,
} from '../src/dates';

declare const process: { env: Record<string, string | undefined> };
const originalTZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTZ;
});

describe('day keys', () => {
  it('validates real calendar days only', () => {
    expect(isValidKey('2026-11-17')).toBe(true);
    expect(isValidKey('2028-02-29')).toBe(true);
    expect(isValidKey('2026-02-29')).toBe(false);
    expect(isValidKey('2026-13-01')).toBe(false);
    expect(isValidKey('2026-1-1')).toBe(false);
    expect(isValidKey(20261117)).toBe(false);
  });

  it('round-trips through day numbers', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(keyFromNumber(dayNumber('2026-11-17'))).toBe('2026-11-17');
  });

  it('adds days over month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-11-17', -365)).toBe('2025-11-17');
  });

  it('adds whole days across daylight-saving changes in the local zone', () => {
    // United States 2026: clocks go forward on 8 March and back on 1 November.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(2);
    expect(diffDays('2026-03-09', '2026-03-07')).toBe(2);
  });

  it('knows weekdays and week starts', () => {
    expect(weekday('2026-11-17')).toBe(2); // Tuesday
    expect(weekday('1970-01-01')).toBe(4); // Thursday
    expect(weekday('1969-12-28')).toBe(0); // Sunday, before the epoch
    expect(weekStart('2026-11-17', 1)).toBe('2026-11-16');
    expect(weekStart('2026-11-17', 0)).toBe('2026-11-15');
    expect(weekStart('2026-11-22', 1)).toBe('2026-11-16');
    expect(weekStart('2026-11-22', 0)).toBe('2026-11-22');
    // The week of the autumn clock change still starts on a Monday 7 days after the last.
    expect(weekStart('2026-11-01', 1)).toBe('2026-10-26');
    expect(diffDays(weekStart('2026-11-02', 1), weekStart('2026-11-01', 1))).toBe(7);
  });
});

describe('today in the local calendar', () => {
  it('uses the local date, not the UTC date', () => {
    process.env.TZ = 'America/New_York';
    // 23:30 on 17 November in New York is already 18 November in UTC.
    const lateEvening = new Date('2026-11-18T04:30:00Z');
    expect(lateEvening.toISOString().slice(0, 10)).toBe('2026-11-18');
    expect(keyFromDate(lateEvening)).toBe('2026-11-17');
  });

  it('handles the hours around a clock change', () => {
    process.env.TZ = 'America/New_York';
    expect(keyFromDate(new Date('2026-03-08T06:59:00Z'))).toBe('2026-03-08'); // 01:59 EST
    expect(keyFromDate(new Date('2026-03-08T07:00:00Z'))).toBe('2026-03-08'); // 03:00 EDT
    expect(keyFromDate(new Date('2026-11-01T05:30:00Z'))).toBe('2026-11-01'); // 01:30 EDT
    expect(keyFromDate(new Date('2026-11-01T06:30:00Z'))).toBe('2026-11-01'); // 01:30 EST, again
    expect(keyFromDate(new Date('2026-11-02T04:59:00Z'))).toBe('2026-11-01'); // 23:59 EST
    expect(keyFromDate(new Date('2026-11-02T05:00:00Z'))).toBe('2026-11-02'); // midnight
  });

  it('gives each zone its own today for the same instant', () => {
    const instant = new Date('2026-11-17T12:00:00Z');
    process.env.TZ = 'Pacific/Auckland';
    expect(keyFromDate(instant)).toBe('2026-11-18');
    process.env.TZ = 'Pacific/Honolulu';
    expect(keyFromDate(instant)).toBe('2026-11-17');
  });

  it('turns keys into local dates on the right day in any zone', () => {
    for (const tz of ['Pacific/Auckland', 'America/Los_Angeles', 'Europe/London', 'Asia/Kolkata']) {
      process.env.TZ = tz;
      for (const key of ['2026-03-08', '2026-03-29', '2026-11-01', '2026-10-25', '2026-04-05']) {
        expect(keyFromDate(toLocalDate(key))).toBe(key);
      }
    }
  });
});
