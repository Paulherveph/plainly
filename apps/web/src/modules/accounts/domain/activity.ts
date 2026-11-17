/**
 * The account activity graph (a GitHub-style contribution calendar). Pure: no I/O, no clock reads.
 * An "action" is a document explained or a question asked.
 */

export type ActivityDay = { day: string; analyses: number; questions: number };

export type CalendarCell = { day: string; count: number; level: 0 | 1 | 2 | 3 | 4; future: boolean };

export type ActivityCalendar = {
  /** Columns of 7 days, Monday first. The last column holds today. */
  weeks: CalendarCell[][];
  /** First column index of each month that starts in the range, for the labels above the grid. */
  months: { index: number; month: number }[];
  total: number;
  analyses: number;
  questions: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
};

const WEEKS = 53;
const DAY_MS = 86_400_000;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Level 1-4 by share of the busiest day, so one heavy day does not wash out the rest. */
function levelOf(count: number, max: number): CalendarCell["level"] {
  if (count <= 0) return 0;
  const share = count / max;
  if (share > 0.75) return 4;
  if (share > 0.5) return 3;
  if (share > 0.25) return 2;
  return 1;
}

/** `today` is a UTC date (YYYY-MM-DD), the same calendar the database groups by. */
export function buildCalendar(days: ActivityDay[], today: string): ActivityCalendar {
  const counts = new Map(days.map((d) => [d.day, d.analyses + d.questions]));
  const end = new Date(`${today}T00:00:00Z`);
  // Monday-first weeks: go back to this week's Monday, then 52 more weeks.
  const mondayOffset = (end.getUTCDay() + 6) % 7;
  const start = new Date(end.getTime() - (mondayOffset + (WEEKS - 1) * 7) * DAY_MS);
  const max = Math.max(1, ...counts.values());

  const weeks: CalendarCell[][] = [];
  const months: ActivityCalendar["months"] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
      const day = iso(date);
      const future = date > end;
      const count = future ? 0 : (counts.get(day) ?? 0);
      week.push({ day, count, level: levelOf(count, max), future });
      if (date.getUTCDate() === 1 && !future) months.push({ index: w, month: date.getUTCMonth() });
    }
    weeks.push(week);
  }

  const cells = weeks.flat().filter((c) => !c.future);
  let longest = 0;
  let run = 0;
  for (const cell of cells) {
    run = cell.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // The current streak may end yesterday: today is not over yet.
  let current = 0;
  let i = cells.length - 1;
  if (cells[i]?.count === 0) i--; // today
  while (i >= 0 && (cells[i]?.count ?? 0) > 0) {
    current++;
    i--;
  }

  const inRange = days.filter((d) => d.day >= iso(start) && d.day <= today);
  return {
    weeks,
    months,
    total: cells.reduce((sum, c) => sum + c.count, 0),
    analyses: inRange.reduce((sum, d) => sum + d.analyses, 0),
    questions: inRange.reduce((sum, d) => sum + d.questions, 0),
    activeDays: cells.filter((c) => c.count > 0).length,
    currentStreak: current,
    longestStreak: longest,
  };
}
