import '@fontsource-variable/plus-jakarta-sans';
import './style.css';
import {
  addDays,
  dayOfMonth,
  diffDays,
  keyFromDate,
  monthOf,
  toLocalDate,
  weekStart,
  type DayKey,
} from './dates';
import { exampleHabits } from './example';
import {
  COLORS,
  MAX_NAME,
  buildExport,
  completionRate,
  formatStreak,
  moveHabit,
  parseImport,
  sanitiseHabit,
  streakOf,
  targetLabel,
  toggleDay,
  weekProgress,
  type Habit,
  type HabitColor,
} from './habits';
import { icons } from './icons';
import { loadJSON, loadString, saveJSON, saveString } from './storage';

const KEY = { data: 'habit-grid:data', theme: 'habit-grid:theme' };

interface Store {
  version: 1;
  habits: Habit[];
  weekStartsOn: 0 | 1;
}

const COLOR_NAMES: Record<HabitColor, string> = {
  violet: 'Violet',
  blue: 'Blue',
  teal: 'Teal',
  green: 'Green',
  amber: 'Amber',
  orange: 'Orange',
  rose: 'Rose',
  pink: 'Pink',
};

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- state ----------
let today: DayKey = keyFromDate(new Date());
let weekOffset = 0;
let yearWeeks = 53;

function loadStore(): Store {
  const raw = loadJSON(KEY.data);
  if (raw && typeof raw === 'object' && Array.isArray((raw as { habits?: unknown }).habits)) {
    const r = raw as { habits: unknown[]; weekStartsOn?: unknown };
    const habits = r.habits.map((h) => sanitiseHabit(h, newId, today)).filter((h): h is Habit => h !== null);
    return { version: 1, habits, weekStartsOn: r.weekStartsOn === 0 ? 0 : 1 };
  }
  // First visit: labelled example habits, regenerated relative to today until the first change.
  return { version: 1, habits: exampleHabits(today), weekStartsOn: 1 };
}

let store: Store = loadStore();
const persist = () => saveJSON(KEY.data, store);

const active = () => store.habits.filter((h) => !h.archived);
const archived = () => store.habits.filter((h) => h.archived);
const hasExample = () => store.habits.some((h) => h.example);

function updateHabit(id: string, change: (h: Habit) => Habit): void {
  store = { ...store, habits: store.habits.map((h) => (h.id === id ? change(h) : h)) };
  persist();
}

// ---------- elements ----------
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  todayLabel: $('today-label'),
  theme: $<HTMLButtonElement>('theme-btn'),
  weekRange: $('week-range'),
  boardHeading: $('board-heading'),
  exampleChip: $('example-chip'),
  prevWeek: $<HTMLButtonElement>('prev-week'),
  nextWeek: $<HTMLButtonElement>('next-week'),
  thisWeek: $<HTMLButtonElement>('this-week'),
  board: $<HTMLTableElement>('board'),
  boardHead: $('board-head'),
  boardBody: $('board-body'),
  empty: $('empty'),
  todayRing: document.getElementById('today-ring') as unknown as SVGCircleElement,
  todayCount: $('today-count'),
  todayNote: $('today-note'),
  weekRate: $('week-rate'),
  topStreak: $('top-streak'),
  topStreakName: $('top-streak-name'),
  yearTotal: $('year-total'),
  yearList: $('year-list'),
  archived: $<HTMLDetailsElement>('archived'),
  archivedSummary: $('archived-summary'),
  archivedList: $('archived-list'),
  habitDialog: $<HTMLDialogElement>('habit-dialog'),
  habitForm: $<HTMLFormElement>('habit-form'),
  habitTitle: $('habit-dialog-title'),
  nameError: $('name-error'),
  swatches: $('swatches'),
  editActions: $('edit-actions'),
  confirmDialog: $<HTMLDialogElement>('confirm-dialog'),
  confirmTitle: $('confirm-title'),
  confirmMessage: $('confirm-message'),
  confirmYes: $<HTMLButtonElement>('confirm-yes'),
  confirmNo: $<HTMLButtonElement>('confirm-no'),
  toast: $('toast'),
  importFile: $<HTMLInputElement>('import-file'),
};

function fillIcons(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-icon]')) {
    const name = node.dataset.icon as keyof typeof icons;
    if (icons[name] && !node.querySelector('svg')) node.insertAdjacentHTML('afterbegin', icons[name]);
  }
}
fillIcons();

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(icon: keyof typeof icons, label: string, className = 'icon-btn tiny'): HTMLButtonElement {
  const b = make('button', className);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.innerHTML = icons[icon];
  return b;
}

// ---------- formatting ----------
const fmt = {
  weekday: new Intl.DateTimeFormat('en', { weekday: 'short' }),
  long: new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }),
  header: new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  short: new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }),
  cell: new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  month: new Intl.DateTimeFormat('en', { month: 'short' }),
};
const fmtKey = (f: Intl.DateTimeFormat, key: DayKey) => f.format(toLocalDate(key));

// ---------- theme ----------
function effectiveTheme(): 'light' | 'dark' {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'light' || forced === 'dark') return forced;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function renderTheme(): void {
  const dark = effectiveTheme() === 'dark';
  el.theme.innerHTML = dark ? icons.sun : icons.moon;
  el.theme.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = dark ? '#0e1311' : '#f5f6f2';
    m.removeAttribute('media');
  });
}

function toggleTheme(): void {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  saveString(KEY.theme, next);
  renderTheme();
}

// ---------- board (this week) ----------
function shownWeekStart(): DayKey {
  return addDays(weekStart(today, store.weekStartsOn), weekOffset * 7);
}

function renderBoard(): void {
  const start = shownWeekStart();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  el.boardHeading.textContent = weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : `Week of ${fmtKey(fmt.short, start)}`;
  el.weekRange.textContent = `${fmtKey(fmt.short, days[0])} – ${fmtKey(fmt.short, days[6])}`;
  el.nextWeek.disabled = weekOffset >= 0;
  el.thisWeek.disabled = weekOffset === 0;
  el.exampleChip.hidden = !hasExample();

  const habits = active();
  el.board.hidden = habits.length === 0;
  el.empty.hidden = habits.length > 0;

  const headRow = make('tr');
  const corner = make('th', 'col-habit', 'Habit');
  corner.scope = 'col';
  headRow.append(corner);
  for (const day of days) {
    const th = make('th', 'col-day');
    th.scope = 'col';
    if (day === today) th.classList.add('is-today');
    const abbr = make('abbr', 'day-name', fmtKey(fmt.weekday, day));
    abbr.title = fmtKey(fmt.long, day);
    th.append(abbr, make('span', 'day-num', String(dayOfMonth(day))));
    headRow.append(th);
  }
  const weekTh = make('th', 'col-week', 'Week');
  weekTh.scope = 'col';
  headRow.append(weekTh);
  el.boardHead.replaceChildren(headRow);

  el.boardBody.replaceChildren();
  habits.forEach((habit, row) => {
    const tr = make('tr');
    tr.style.setProperty('--habit', `var(--c-${habit.color})`);
    const th = make('th', 'habit-cell');
    th.scope = 'row';
    const nameBtn = make('button', 'habit-name');
    nameBtn.type = 'button';
    nameBtn.title = `Edit ${habit.name}`;
    const dot = make('span', 'dot');
    dot.setAttribute('aria-hidden', 'true');
    const text = make('span', 'habit-text');
    text.append(make('span', 'habit-title', habit.name), make('span', 'habit-target', targetLabel(habit.target)));
    nameBtn.append(dot, text);
    nameBtn.addEventListener('click', () => openHabitDialog(habit.id));
    th.append(nameBtn);
    tr.append(th);

    const done = new Set(habit.done);
    days.forEach((day, col) => {
      const td = make('td');
      const b = make('button', 'toggle');
      b.type = 'button';
      const isDone = done.has(day);
      const future = diffDays(day, today) > 0;
      b.setAttribute('aria-pressed', String(isDone));
      b.setAttribute('aria-label', `${habit.name}, ${fmtKey(fmt.long, day)}${day === today ? ' (today)' : ''}`);
      b.dataset.row = String(row);
      b.dataset.col = String(col);
      b.dataset.habit = habit.id;
      b.dataset.day = day;
      if (day === today) b.classList.add('is-today');
      if (future) b.disabled = true;
      b.innerHTML = icons.check;
      b.addEventListener('click', () => toggle(habit.id, day));
      td.append(b);
      tr.append(td);
    });

    const progress = weekProgressFor(habit, start);
    const tdWeek = make('td', 'week-cell');
    const label = make('span', 'week-count', `${progress.count}/${progress.target}`);
    const bar = make('span', 'week-bar');
    bar.setAttribute('aria-hidden', 'true');
    const fill = make('span');
    fill.style.width = `${Math.min(100, (progress.count / progress.target) * 100)}%`;
    bar.append(fill);
    tdWeek.append(label, bar);
    if (progress.count >= progress.target) tdWeek.classList.add('met');
    const sr = make('span', 'visually-hidden', progress.count >= progress.target ? ' target reached' : ' done this week');
    tdWeek.append(sr);
    tr.append(tdWeek);
    el.boardBody.append(tr);
  });
}

function weekProgressFor(habit: Habit, start: DayKey): { count: number; target: number } {
  // weekProgress works on "the week containing day"; use the shown week's first day.
  const p = weekProgress(habit, start, store.weekStartsOn);
  return { count: p.count, target: p.target };
}

// ---------- summary ----------
function renderSummary(): void {
  const habits = active();
  const doneToday = habits.filter((h) => h.done.includes(today)).length;
  el.todayCount.textContent = `${doneToday} of ${habits.length}`;
  el.todayNote.textContent = habits.length === 0 ? 'no habits yet' : doneToday === habits.length ? 'all done today' : 'habits ticked today';
  const c = 2 * Math.PI * 50;
  el.todayRing.style.strokeDasharray = `${c}`;
  el.todayRing.style.strokeDashoffset = `${c * (1 - (habits.length ? doneToday / habits.length : 0))}`;

  let reached = 0;
  let wanted = 0;
  for (const h of habits) {
    const p = weekProgress(h, today, store.weekStartsOn);
    reached += Math.min(p.count, p.target);
    wanted += p.target;
  }
  el.weekRate.textContent = `${wanted ? Math.round((reached / wanted) * 100) : 0}%`;

  let top: { habit: Habit; current: number; unit: 'day' | 'week' } | null = null;
  for (const h of habits) {
    const s = streakOf(h, today, store.weekStartsOn);
    const score = s.unit === 'week' ? s.current * 7 : s.current;
    const topScore = top ? (top.unit === 'week' ? top.current * 7 : top.current) : 0;
    if (s.current > 0 && score > topScore) top = { habit: h, current: s.current, unit: s.unit };
  }
  el.topStreak.textContent = top ? formatStreak(top.current, top.unit) : '0 days';
  el.topStreakName.textContent = top ? top.habit.name : 'No streak yet';

  const since = addDays(today, -364);
  let total = 0;
  for (const h of habits) for (const d of h.done) if (diffDays(d, since) >= 0 && diffDays(today, d) >= 0) total += 1;
  el.yearTotal.textContent = total.toLocaleString('en');
}

// ---------- year grids ----------
const CELL = 11;
const GAP = 3;

function renderYear(): void {
  const habits = active();
  el.yearList.replaceChildren();
  const lastWeek = weekStart(today, store.weekStartsOn);
  const firstWeek = addDays(lastWeek, -(yearWeeks - 1) * 7);

  habits.forEach((habit, index) => {
    const li = make('li', 'card year-card');
    li.style.setProperty('--habit', `var(--c-${habit.color})`);
    const streak = streakOf(habit, today, store.weekStartsOn);
    const done = new Set(habit.done);

    // Left: name, stats, actions.
    const info = make('div', 'year-info');
    const title = make('div', 'year-title');
    const dot = make('span', 'dot');
    dot.setAttribute('aria-hidden', 'true');
    const h3 = make('h3', undefined, habit.name);
    title.append(dot, h3);
    const badge = make('span', 'badge', targetLabel(habit.target));

    const stats = make('dl', 'year-stats');
    const stat = (label: string, value: string, icon?: keyof typeof icons) => {
      const d = make('div');
      const dt = make('dt', undefined, label);
      const dd = make('dd');
      if (icon) {
        const i = make('span', 'stat-icon');
        i.innerHTML = icons[icon];
        dd.append(i);
      }
      dd.append(document.createTextNode(value));
      d.append(dt, dd);
      stats.append(d);
    };
    stat('Streak', formatStreak(streak.current, streak.unit), 'flame');
    stat('Best', formatStreak(streak.best, streak.unit), 'trophy');
    stat('Last 30 days', `${Math.round(completionRate(habit, today, 30) * 100)}%`);
    stat('Total', `${habit.done.filter((d) => diffDays(today, d) >= 0).length} days`);

    const actions = make('div', 'year-actions');
    const up = iconButton('up', `Move ${habit.name} up`);
    up.disabled = index === 0;
    up.addEventListener('click', () => move(habit.id, -1));
    const down = iconButton('down', `Move ${habit.name} down`);
    down.disabled = index === habits.length - 1;
    down.addEventListener('click', () => move(habit.id, 1));
    const edit = iconButton('pencil', `Edit ${habit.name}`);
    edit.addEventListener('click', () => openHabitDialog(habit.id));
    up.dataset.move = `${habit.id}:up`;
    down.dataset.move = `${habit.id}:down`;
    actions.append(up, down, edit);

    info.append(title, badge, stats, actions);

    // Right: the contribution grid.
    const wrap = make('div', 'year-grid-wrap');
    const months = make('div', 'months');
    months.setAttribute('aria-hidden', 'true');
    months.style.setProperty('--weeks', String(yearWeeks));
    let lastLabelCol = -10;
    let previousMonth = -1;
    for (let w = 0; w < yearWeeks; w += 1) {
      const first = addDays(firstWeek, w * 7);
      const month = monthOf(first);
      if (month !== previousMonth) {
        if (w - lastLabelCol >= 3 && (w > 0 || dayOfMonth(first) <= 7)) {
          const span = make('span', undefined, fmtKey(fmt.month, first));
          span.style.gridColumn = String(w + 1);
          months.append(span);
          lastLabelCol = w;
        }
        previousMonth = month;
      }
    }

    const body = make('div', 'year-body');
    const labels = make('div', 'weekday-labels');
    labels.setAttribute('aria-hidden', 'true');
    for (let r = 0; r < 7; r += 1) {
      labels.append(make('span', undefined, r % 2 === 0 ? fmtKey(fmt.weekday, addDays(firstWeek, r)) : ''));
    }
    const grid = make('div', 'year-grid');
    grid.style.setProperty('--weeks', String(yearWeeks));
    let count = 0;
    for (let w = 0; w < yearWeeks; w += 1) {
      for (let r = 0; r < 7; r += 1) {
        const day = addDays(firstWeek, w * 7 + r);
        const cell = make('span', 'cell');
        if (diffDays(day, today) > 0) cell.classList.add('future');
        else {
          const on = done.has(day);
          if (on) {
            cell.classList.add('on');
            count += 1;
          }
          if (day === today) cell.classList.add('today');
          cell.title = `${fmtKey(fmt.cell, day)}: ${on ? 'done' : 'not done'}`;
        }
        grid.append(cell);
      }
    }
    grid.setAttribute('role', 'img');
    grid.setAttribute(
      'aria-label',
      `${habit.name}: done on ${count} of the last ${diffDays(today, firstWeek) + 1} days, from ${fmtKey(fmt.short, firstWeek)} to today.`,
    );
    body.append(labels, grid);
    wrap.append(months, body);
    li.append(info, wrap);
    el.yearList.append(li);
  });
}

function measureYearWeeks(): number {
  const wrap = el.yearList.querySelector<HTMLElement>('.year-grid-wrap');
  if (!wrap) return yearWeeks;
  const available = wrap.clientWidth - 30; // weekday labels column
  return Math.max(8, Math.min(53, Math.floor((available + GAP) / (CELL + GAP))));
}

function fitYear(): void {
  const weeks = measureYearWeeks();
  if (weeks !== yearWeeks) {
    yearWeeks = weeks;
    renderYear();
  }
}

// ---------- archived ----------
function renderArchived(): void {
  const list = archived();
  el.archived.hidden = list.length === 0;
  el.archivedSummary.textContent = `Archived habits (${list.length})`;
  el.archivedList.replaceChildren();
  for (const habit of list) {
    const li = make('li');
    li.style.setProperty('--habit', `var(--c-${habit.color})`);
    const dot = make('span', 'dot');
    dot.setAttribute('aria-hidden', 'true');
    const name = make('span', 'archived-name', habit.name);
    const restore = make('button', 'ghost-btn small');
    restore.type = 'button';
    restore.innerHTML = `${icons.restore}<span>Restore</span>`;
    restore.setAttribute('aria-label', `Restore ${habit.name}`);
    restore.addEventListener('click', () => {
      updateHabit(habit.id, (h) => ({ ...h, archived: false }));
      render();
      toast(`Restored “${habit.name}”.`);
    });
    const del = make('button', 'ghost-btn small danger');
    del.type = 'button';
    del.innerHTML = `${icons.trash}<span>Delete</span>`;
    del.setAttribute('aria-label', `Delete ${habit.name}`);
    del.addEventListener('click', () => void deleteHabit(habit.id));
    li.append(dot, name, restore, del);
    el.archivedList.append(li);
  }
}

// ---------- render ----------
function render(): void {
  el.todayLabel.textContent = fmtKey(fmt.header, today);
  renderBoard();
  renderSummary();
  renderYear();
  renderArchived();
}

/** Re-renders and puts keyboard focus back on the equivalent control. */
function renderKeepingFocus(): void {
  const focused = document.activeElement as HTMLElement | null;
  const habitId = focused?.dataset.habit;
  const day = focused?.dataset.day;
  const moveKey = focused?.dataset.move;
  render();
  if (habitId && day) {
    el.boardBody.querySelector<HTMLElement>(`[data-habit="${CSS.escape(habitId)}"][data-day="${day}"]`)?.focus();
  } else if (moveKey) {
    const target = el.yearList.querySelector<HTMLButtonElement>(`[data-move="${CSS.escape(moveKey)}"]`);
    if (target && !target.disabled) target.focus();
    else el.yearList.querySelector<HTMLButtonElement>(`[data-move^="${CSS.escape(moveKey.split(':')[0])}:"]:not(:disabled)`)?.focus();
  }
}

// ---------- actions ----------
function toggle(id: string, day: DayKey): void {
  if (diffDays(day, today) > 0) return;
  updateHabit(id, (h) => toggleDay(h, day));
  renderKeepingFocus();
  const habit = store.habits.find((h) => h.id === id);
  if (habit && habit.done.includes(day)) {
    const cell = el.boardBody.querySelector<HTMLElement>(`[data-habit="${CSS.escape(id)}"][data-day="${day}"]`);
    cell?.classList.add('pop');
  }
}

function move(id: string, direction: -1 | 1): void {
  store = { ...store, habits: moveHabit(store.habits, id, direction) };
  persist();
  renderKeepingFocus();
}

async function deleteHabit(id: string): Promise<void> {
  const habit = store.habits.find((h) => h.id === id);
  if (!habit) return;
  const ok = await confirmAction(
    `Delete “${habit.name}”?`,
    `Its ${habit.done.length} check-ins will be removed from this browser. This cannot be undone. Archive it instead to keep its history.`,
    'Delete',
  );
  if (!ok) return;
  store = { ...store, habits: store.habits.filter((h) => h.id !== id) };
  persist();
  render();
  el.boardHeading.focus();
  toast(`Deleted “${habit.name}”.`);
}

function clearExample(): void {
  store = { ...store, habits: store.habits.filter((h) => !h.example) };
  persist();
  render();
  el.boardHeading.focus();
  toast(active().length === 0 ? 'Example data cleared. Add your first habit with “New habit”.' : 'Example data cleared.');
}

// ---------- toast ----------
let toastTimer: number | undefined;
function toast(message: string, action?: { label: string; run: () => void }): void {
  window.clearTimeout(toastTimer);
  el.toast.replaceChildren(make('span', undefined, message));
  if (action) {
    const b = make('button', 'toast-action', action.label);
    b.type = 'button';
    b.addEventListener('click', () => {
      action.run();
      hideToast();
    });
    el.toast.append(b);
  }
  el.toast.classList.add('show');
  toastTimer = window.setTimeout(hideToast, action ? 7000 : 4000);
}
function hideToast(): void {
  el.toast.classList.remove('show');
}

// ---------- confirm dialog ----------
function confirmAction(title: string, message: string, yesLabel: string): Promise<boolean> {
  el.confirmTitle.textContent = title;
  el.confirmMessage.textContent = message;
  el.confirmYes.textContent = yesLabel;
  const returnFocus = document.activeElement as HTMLElement | null;
  el.confirmDialog.showModal();
  el.confirmNo.focus();
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      el.confirmYes.removeEventListener('click', yes);
      el.confirmNo.removeEventListener('click', no);
      el.confirmDialog.removeEventListener('cancel', no);
      if (el.confirmDialog.open) el.confirmDialog.close();
      if (!value && returnFocus?.isConnected) returnFocus.focus();
      resolve(value);
    };
    const yes = () => finish(true);
    const no = () => finish(false);
    el.confirmYes.addEventListener('click', yes);
    el.confirmNo.addEventListener('click', no);
    el.confirmDialog.addEventListener('cancel', no);
  });
}

// ---------- habit dialog ----------
let editingId: string | null = null;

(function buildSwatches() {
  for (const color of COLORS) {
    const label = make('label', 'swatch');
    label.style.setProperty('--habit', `var(--c-${color})`);
    const input = make('input');
    input.type = 'radio';
    input.name = 'color';
    input.value = color;
    const mark = make('span', 'swatch-mark');
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = icons.check;
    label.append(input, mark, make('span', 'visually-hidden', COLOR_NAMES[color]));
    el.swatches.append(label);
  }
})();

function formField<T extends HTMLElement>(name: string): T {
  return el.habitForm.elements.namedItem(name) as unknown as T;
}

function openHabitDialog(id: string | null): void {
  editingId = id;
  const habit = id ? store.habits.find((h) => h.id === id) : undefined;
  el.habitTitle.textContent = habit ? 'Edit habit' : 'New habit';
  el.editActions.hidden = !habit;
  el.nameError.hidden = true;
  const name = formField<HTMLInputElement>('name');
  name.value = habit?.name ?? '';
  name.removeAttribute('aria-invalid');
  const used = new Set(active().map((h) => h.color));
  const color = habit?.color ?? COLORS.find((c) => !used.has(c)) ?? 'violet';
  for (const input of el.swatches.querySelectorAll<HTMLInputElement>('input')) input.checked = input.value === color;
  formField<HTMLSelectElement>('target').value = String(habit?.target ?? 7);
  const archiveBtn = $<HTMLButtonElement>('archive-btn');
  archiveBtn.lastChild!.textContent = 'Archive';
  el.habitDialog.showModal();
  name.focus();
}

el.habitForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = formField<HTMLInputElement>('name');
  const clean = name.value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  if (!clean) {
    el.nameError.hidden = false;
    name.setAttribute('aria-invalid', 'true');
    name.setAttribute('aria-describedby', 'name-error');
    name.focus();
    return;
  }
  const color = (new FormData(el.habitForm).get('color') as HabitColor | null) ?? 'violet';
  const target = Math.min(7, Math.max(1, Number(formField<HTMLSelectElement>('target').value) || 7));
  if (editingId) {
    updateHabit(editingId, (h) => ({ ...h, name: clean, color, target }));
    toast(`Saved “${clean}”.`);
  } else {
    const habit: Habit = { id: newId(), name: clean, color, target, createdAt: today, archived: false, done: [] };
    store = { ...store, habits: [...store.habits, habit] };
    persist();
    toast(`Added “${clean}”. Tick today when it is done.`);
  }
  el.habitDialog.close();
  render();
  const focusId = editingId ?? store.habits[store.habits.length - 1].id;
  el.boardBody.querySelector<HTMLElement>(`[data-habit="${CSS.escape(focusId)}"][data-day="${today}"]`)?.focus();
});

$('archive-btn').addEventListener('click', () => {
  if (!editingId) return;
  const id = editingId;
  const habit = store.habits.find((h) => h.id === id);
  updateHabit(id, (h) => ({ ...h, archived: true }));
  el.habitDialog.close();
  render();
  el.boardHeading.focus();
  toast(`Archived “${habit?.name ?? 'habit'}”.`, {
    label: 'Undo',
    run: () => {
      updateHabit(id, (h) => ({ ...h, archived: false }));
      render();
    },
  });
});

$('delete-btn').addEventListener('click', () => {
  if (!editingId) return;
  const id = editingId;
  el.habitDialog.close();
  void deleteHabit(id);
});

for (const button of document.querySelectorAll<HTMLButtonElement>('dialog [data-close]')) {
  button.addEventListener('click', () => button.closest('dialog')?.close());
}

// ---------- import / export ----------
function exportData(): void {
  const data = buildExport(store.habits, store.weekStartsOn, new Date());
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = make('a');
  a.href = url;
  a.download = `habit-grid-${today}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Exported ${data.habits.length} ${data.habits.length === 1 ? 'habit' : 'habits'}.`);
}

async function importFile(file: File): Promise<void> {
  if (file.size > 5_000_000) {
    toast('That file is too large to be a Habit Grid export.');
    return;
  }
  let parsed;
  try {
    parsed = parseImport(await file.text(), newId, today);
  } catch (error) {
    toast(error instanceof Error ? error.message : 'This file could not be read.');
    return;
  }
  const own = store.habits.filter((h) => !h.example);
  if (own.length > 0) {
    const ok = await confirmAction(
      'Replace your habits?',
      `Your ${own.length} ${own.length === 1 ? 'habit' : 'habits'} in this browser will be replaced by the ${parsed.habits.length} in “${file.name}”.`,
      'Replace',
    );
    if (!ok) return;
  }
  store = { version: 1, habits: parsed.habits, weekStartsOn: parsed.weekStartsOn };
  persist();
  weekOffset = 0;
  render();
  toast(`Imported ${parsed.habits.length} ${parsed.habits.length === 1 ? 'habit' : 'habits'}.`);
}

// ---------- events ----------
$('add-btn').addEventListener('click', () => openHabitDialog(null));
$('empty-add').addEventListener('click', () => openHabitDialog(null));
$('clear-example').addEventListener('click', clearExample);
$('export-btn').addEventListener('click', exportData);
$('import-btn').addEventListener('click', () => el.importFile.click());
el.importFile.addEventListener('change', () => {
  const file = el.importFile.files?.[0];
  el.importFile.value = '';
  if (file) void importFile(file);
});
el.theme.addEventListener('click', toggleTheme);
el.prevWeek.addEventListener('click', () => {
  weekOffset -= 1;
  renderBoard();
});
el.nextWeek.addEventListener('click', () => {
  weekOffset = Math.min(0, weekOffset + 1);
  renderBoard();
  if (weekOffset === 0) el.prevWeek.focus();
});
el.thisWeek.addEventListener('click', () => {
  weekOffset = 0;
  renderBoard();
  el.prevWeek.focus();
});

// Arrow keys move between day buttons of the week grid.
el.boardBody.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  if (!target.classList.contains('toggle')) return;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  const rows = active().length;
  const at = (r: number, c: number) =>
    el.boardBody.querySelector<HTMLButtonElement>(`.toggle[data-row="${r}"][data-col="${c}"]`);
  const focusFirstEnabled = (r: number, from: number, step: number) => {
    for (let c = from; c >= 0 && c < 7; c += step) {
      const b = at(r, c);
      if (b && !b.disabled) {
        b.focus();
        return;
      }
    }
  };
  let handled = true;
  switch (e.key) {
    case 'ArrowRight':
      focusFirstEnabled(row, col + 1, 1);
      break;
    case 'ArrowLeft':
      focusFirstEnabled(row, col - 1, -1);
      break;
    case 'ArrowDown':
      if (row + 1 < rows) at(row + 1, col)?.focus();
      break;
    case 'ArrowUp':
      if (row > 0) at(row - 1, col)?.focus();
      break;
    case 'Home':
      focusFirstEnabled(row, 0, 1);
      break;
    case 'End':
      focusFirstEnabled(row, 6, -1);
      break;
    default:
      handled = false;
  }
  if (handled) e.preventDefault();
});

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if (el.habitDialog.open || el.confirmDialog.open) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    openHabitDialog(null);
    return;
  }
  if (/^[1-9]$/.test(e.key)) {
    const habit = active()[Number(e.key) - 1];
    if (!habit) return;
    e.preventDefault();
    toggle(habit.id, today);
    const done = store.habits.find((h) => h.id === habit.id)?.done.includes(today);
    toast(`${habit.name}: ${done ? 'done today' : 'not done today'}.`);
  }
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderTheme);

window.addEventListener('storage', (e) => {
  if (e.key === KEY.data) {
    store = loadStore();
    render();
  }
});

// Roll over to a new day at midnight (or after the device wakes up).
function checkDay(): void {
  const now = keyFromDate(new Date());
  if (now !== today) {
    today = now;
    render();
  }
}
window.setInterval(checkDay, 30_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkDay();
});

// ---------- start ----------
const theme = loadString(KEY.theme);
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
renderTheme();
render();
fitYear();
if ('ResizeObserver' in window) {
  let frame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fitYear);
  }).observe(el.yearList);
}

