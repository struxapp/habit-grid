import { addDays, weekday, type DayKey } from './dates';
import type { Habit, HabitColor } from './habits';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Plan {
  id: string;
  name: string;
  color: HabitColor;
  target: number;
  ageDays: number;
  /** Chance of doing it on a given day, early on and lately (people get better). */
  early: number;
  late: number;
  /** Recent days kept unbroken so the example shows a live streak. */
  streak: number;
  doneToday: boolean;
  /** Preferred weekdays for weekly habits (0 = Sunday). */
  days?: number[];
}

const PLANS: Plan[] = [
  { id: 'ex-walk', name: 'Morning walk', color: 'green', target: 7, ageDays: 364, early: 0.55, late: 0.88, streak: 23, doneToday: true },
  { id: 'ex-read', name: 'Read 20 pages', color: 'violet', target: 7, ageDays: 300, early: 0.5, late: 0.82, streak: 9, doneToday: false },
  { id: 'ex-gym', name: 'Strength training', color: 'orange', target: 3, ageDays: 240, early: 0.6, late: 0.9, streak: 0, doneToday: true, days: [1, 3, 5, 6] },
  { id: 'ex-guitar', name: 'Practise guitar', color: 'blue', target: 4, ageDays: 150, early: 0.45, late: 0.75, streak: 0, doneToday: false, days: [0, 2, 3, 4, 6] },
  { id: 'ex-screens', name: 'No screens after 22:00', color: 'teal', target: 7, ageDays: 90, early: 0.4, late: 0.7, streak: 4, doneToday: false },
];

/** Example habits with about a year of history ending today. Deterministic for a given day. */
export function exampleHabits(today: DayKey): Habit[] {
  const rand = mulberry32(42_2026);
  return PLANS.map((plan) => {
    const done: DayKey[] = [];
    for (let back = plan.ageDays; back >= 1; back -= 1) {
      const key = addDays(today, -back);
      const progress = 1 - back / plan.ageDays;
      let chance = plan.early + (plan.late - plan.early) * progress;
      if (plan.days) chance = plan.days.includes(weekday(key)) ? chance : 0.08;
      const inStreak = back <= plan.streak - (plan.doneToday ? 1 : 0);
      const brokeStreak = back === plan.streak + (plan.doneToday ? 0 : 1) && plan.streak > 0;
      if (inStreak || (!brokeStreak && rand() < chance)) done.push(key);
    }
    if (plan.doneToday) done.push(today);
    return {
      id: plan.id,
      name: plan.name,
      color: plan.color,
      target: plan.target,
      createdAt: addDays(today, -plan.ageDays),
      archived: false,
      done,
      example: true,
    };
  });
}
