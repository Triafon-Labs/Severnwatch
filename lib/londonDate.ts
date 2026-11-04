// London calendar dates, for the citizen science samples. Kept apart from
// lib/time.ts, which holds a React hook: the water quality route imports
// these on the server, where a module that imports React hooks isn't
// allowed.
//
// The samples are dated in Worcester wall-clock time and taken roughly
// weekly, so their age reads in calendar days ("yesterday", "7 days ago")
// rather than in hours, and two samples a few hours either side of midnight
// count as different days the way a reader would expect.

const londonDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const londonDateParts = (ms: number) => {
  const parts = londonDateFormat.formatToParts(ms);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
};

// The UTC instant of a Europe/London wall-clock time - "28 Oct 2026, 11:45"
// as written in the SAS export - without a timezone library. Takes the
// wall-clock fields as if they were UTC, measures how far London's clock is
// from that guess, and corrects by it. A second pass covers a guess that
// lands on the other side of a clocks-change from the answer.
export const londonWallClockToUtcMs = (
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number
): number => {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = londonDateParts(guess);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += target - shown;
  }
  return guess;
};

// A day count that increments at London midnight, for calendar-day maths.
const londonDayNumber = (ms: number): number => {
  const p = londonDateParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day) / (24 * 60 * 60 * 1000);
};

// Whole London calendar days from `ms` to `now` - 0 for earlier today.
export const londonDaysAgo = (ms: number, now: Date | number): number =>
  londonDayNumber(typeof now === "number" ? now : now.getTime()) -
  londonDayNumber(ms);

export const formatDaysAgo = (days: number): string =>
  days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;

// "Tue 28 Oct" / "Tue 28 Oct 2026" / "Tue 28 Oct, 11:45", in London time.
export const formatLondonDate = (
  ms: number,
  options: {
    withYear?: boolean;
    withTime?: boolean;
    withWeekday?: boolean;
  } = {}
): string => {
  const { withYear = false, withTime = false, withWeekday = true } = options;
  const date = new Date(ms).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    ...(withWeekday && { weekday: "short" }),
    day: "numeric",
    month: "short",
    ...(withYear && { year: "numeric" }),
  });
  // en-GB puts a comma after the weekday ("Tue, 28 Oct"); the rest of the app
  // writes "Tue 28 Oct".
  const tidy = date.replace(",", "");
  if (!withTime) return tidy;
  const time = new Date(ms).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${tidy}, ${time}`;
};

// The first instant of each London calendar month in [minMs, maxMs], for
// month ticks along the sample history chart.
export const londonMonthStarts = (minMs: number, maxMs: number): number[] => {
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || minMs > maxMs)
    return [];
  const ticks: number[] = [];
  const start = londonDateParts(minMs);
  let year = start.year;
  let month = start.month;
  for (;;) {
    const ms = londonWallClockToUtcMs(year, month, 1, 0, 0);
    if (ms > maxMs) break;
    if (ms >= minMs) ticks.push(ms);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return ticks;
};
