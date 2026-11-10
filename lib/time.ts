// Time formatting shared across the app. Everything here works in
// Europe/London rather than the runtime's local zone: the data is all
// UK-gauge data, and a reader in another timezone still wants to know what
// time it was at Worcester when the reading was taken.
//
// No React in here: the water quality route imports these on the server.
// The ticking-clock hook lives in lib/useNowTicking.ts for that reason, as
// in Paddlecheck.

// How old a reading is, in words. "min", never "mins" or "minutes", so the
// freshness caption in the app bar reads the same as the ones under the cards.
export const getRelativeTimeString = (
  date: string | Date | undefined | null,
  now: Date = new Date()
): string => {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const diffMins = Math.floor((now.getTime() - dateObj.getTime()) / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24)
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
};

// How long ago a reading was taken, as a compact duration - "45 min ago",
// "2h 15m ago", "1d 3h ago". Unlike getRelativeTimeString above, which rounds
// to the hour once past 60 minutes, this keeps the minutes: a gauge that is
// 1h 50m behind is a different story from one that is 1h behind. Shared with
// Paddlecheck, so the two apps' "As of" captions read the same.
export const formatDataAge = (latestTs: number, now: Date): string => {
  const ageMinutes = Math.round((now.getTime() - latestTs) / (60 * 1000));
  if (ageMinutes < 1) return "just now";
  if (ageMinutes < 60) return `${ageMinutes} min ago`;
  const hours = Math.floor(ageMinutes / 60);
  const minutes = ageMinutes % 60;
  if (hours < 24) {
    const duration = minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
    return `${duration} ago`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  const duration = remHours === 0 ? `${days}d` : `${days}d ${remHours}h`;
  return `${duration} ago`;
};

// "HH:MM" in Europe/London, regardless of the runtime's local timezone.
export const getLondonHHMM = (date: Date = new Date()): string =>
  date.toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

// A timestamp's Europe/London wall-clock parts, without pulling in a timezone
// library - used to align the rainfall chart's x-axis ticks to clean local
// times and to build its tick and tooltip labels.
const londonDateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  hourCycle: "h23",
});

export const londonParts = (ms: number) => {
  const parts = londonDateTimeFormat.formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: get("minute"),
  };
};

export const formatTimeTick = (ms: number): string => {
  const { weekday, hour, minute } = londonParts(ms);
  return `${weekday} ${String(hour).padStart(2, "0")}:${minute}`;
};

// --- Calendar dates, for the citizen science samples ---
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
  return withTime ? `${tidy}, ${getLondonHHMM(new Date(ms))}` : tidy;
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
