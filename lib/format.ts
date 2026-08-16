export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
};

// "Data as of" freshness indicator, shared across the data cards.
//
// Formatted in Europe/London rather than through date-fns' `format`, which
// works in the runtime's local zone. That mattered in two places: the app bar
// quotes its own fetch time in London (see lib/time.ts), so on any host not
// set to UK time the two lines disagreed by the offset - and this string is
// rendered during SSR as well as on the client, so a server in UTC and a
// browser in BST produced different text for the same timestamp.
const AS_OF_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  hourCycle: "h23",
  day: "numeric",
  month: "short",
});

export const formatAsOf = (iso: string): string => {
  const parts = AS_OF_FORMAT.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `Data as of ${get("hour")}:${get("minute")}, ${get("day")} ${get("month")}`;
};
