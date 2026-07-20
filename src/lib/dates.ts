// Calendar dates are stored as `@db.Date` (no time component). Prisma returns
// them as JS Dates at UTC midnight, and <input type="date"> gives us
// "YYYY-MM-DD" strings. To avoid timezone drift we treat the date key
// ("YYYY-MM-DD") as the single source of truth everywhere and only convert
// to a Date (at UTC midnight) at the database boundary.

export type DateKey = string; // "YYYY-MM-DD"

/** Normalize a Date or string to a "YYYY-MM-DD" key (UTC). */
export function toDateKey(value: Date | string): DateKey {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

/** Convert a "YYYY-MM-DD" key to a Date at UTC midnight (DB boundary). */
export function dateKeyToUTC(key: DateKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** True when the string is a valid "YYYY-MM-DD" calendar date. */
export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(`${key}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && toDateKey(d) === key;
}

/** Today's date key in the resort's local timezone (Philippines, UTC+8). */
export function todayKey(timeZone = "Asia/Manila"): DateKey {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel(year: number, month0: number): string {
  return `${MONTHS[month0]} ${year}`;
}

/** A single cell in the month grid. */
export type MonthCell = {
  key: DateKey;
  day: number;
  inMonth: boolean;
};

/**
 * Build a 6-row × 7-col grid (Sunday-first) covering the given month,
 * padded with the trailing/leading days of adjacent months.
 */
export function buildMonthGrid(year: number, month0: number): MonthCell[] {
  const firstOfMonth = new Date(Date.UTC(year, month0, 1));
  const startWeekday = firstOfMonth.getUTCDay(); // 0 = Sunday
  const gridStart = new Date(Date.UTC(year, month0, 1 - startWeekday));

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    cells.push({
      key: toDateKey(d),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month0,
    });
  }
  return cells;
}

/** Human-friendly long date, e.g. "Mon, Jul 20, 2026". */
export function formatLongDate(key: DateKey): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateKeyToUTC(key));
}
