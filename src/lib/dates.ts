// "Today" and month boundaries are computed in Europe/Warsaw: Workers run in UTC, so 00:30 on 1 Nov in Poland
// is still 31 Oct on the server. A per-user timezone setting is parked post-MVP (see roadmap).

const TIME_ZONE = "Europe/Warsaw";

const dateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Warsaw as YYYY-MM-DD. */
export function todayInWarsaw(now: Date = new Date()): string {
  const parts = Object.fromEntries(dateParts.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** First day of the month containing the given YYYY-MM-DD date. */
export function monthStartOf(date: string): string {
  return `${date.slice(0, 8)}01`;
}

export function currentMonthStart(now: Date = new Date()): string {
  return monthStartOf(todayInWarsaw(now));
}

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30). */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const monthNames = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" });

/** "październik 2026" for a YYYY-MM-DD date. */
export function formatMonthLabel(date: string): string {
  return monthNames.format(new Date(`${monthStartOf(date)}T00:00:00Z`));
}

/** Years accepted in `?month=` (and offered by the month picker). */
export const MIN_MONTH_YEAR = 2000;
export const MAX_MONTH_YEAR = 2100;

/** `YYYY-MM` from a query string as the first day of that month (`YYYY-MM-01`); null when it is not a real month in 2000-2100. */
export function parseMonthParam(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < MIN_MONTH_YEAR || year > MAX_MONTH_YEAR || month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

/** `YYYY-MM` for a month start, the form used in URLs. */
export function monthParam(monthStart: string): string {
  return monthStart.slice(0, 7);
}

/** The month `delta` months from the one starting at `monthStart` (negative = earlier), as `YYYY-MM-01`. */
export function shiftMonth(monthStart: string, delta: number): string {
  const date = new Date(`${monthStart}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 8) + "01";
}

export function nextMonthStart(monthStart: string): string {
  return shiftMonth(monthStart, 1);
}
