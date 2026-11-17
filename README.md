# Habit Grid

Track your daily habits on one grid. Tick today, catch up on a day you forgot, and watch a year of history fill
in for every habit.

- **This week board**: every active habit against the seven days of the week. Tick or untick any day up to
  today; browse earlier weeks. Arrow keys move around the grid.
- **Weekly targets**: a habit can be "every day" or "N times a week" (1–6). Weekly habits keep a streak in
  weeks: a week counts once its target is reached, and the current week never breaks a streak while it is still
  in progress.
- **Streaks**: current and best streak per habit (days for daily habits, weeks for weekly ones). A daily streak
  stays alive until the end of today.
- **A year per habit**: a contribution-style grid of the last 53 weeks (fewer on narrow screens) with month
  labels, plus the last 30 days' completion and total days.
- **Manage**: colours, reorder (move up and down), edit, archive and restore, delete.
- **Export and import** all habits as a JSON file (import validates and cleans the file first).
- **Keyboard**: <kbd>N</kbd> new habit, <kbd>1</kbd>–<kbd>9</kbd> tick a habit for today, arrow keys,
  <kbd>Home</kbd> and <kbd>End</kbd> in the week grid.
- Light and dark themes (follows the system, with a remembered toggle), responsive down to 360 px,
  reduced-motion aware.

On first visit the app shows clearly labelled **example habits** with a year of generated history
("Example data · Clear"); one click removes them. Everything is stored in `localStorage` in this browser
only. Nothing is sent anywhere.

## Dates, time zones and daylight saving

A habit is done on a calendar day, not at an instant, so history is stored as `YYYY-MM-DD` day keys. Only "what
day is it now" uses the local clock; all other date arithmetic maps day keys to whole UTC day numbers, so daylight
saving changes and travel between time zones can never shift, merge or split stored days. The unit tests run the
date and streak logic in several zones (New York, Auckland, Honolulu, Tokyo, Berlin, …) and across the 2026
clock changes.

## Run

```sh
npm ci
npm run dev      # development server
npm test         # unit tests (dates, streaks, weekly targets, import)
npm run build    # type-check and build to dist/
```

Requires Node 22.12 or later.

## Data and licences

- No external data. The example habits and their history are generated in the browser from a fixed seed and
  are labelled as example data.
- Font: [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans) by Tokotype, SIL Open Font License
  1.1, bundled via `@fontsource-variable/plus-jakarta-sans`.
- Icons are drawn for this app.

## Licence

MIT, see [LICENSE](LICENSE).
