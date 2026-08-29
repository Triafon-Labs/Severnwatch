// Time formatting shared across the app. Everything here works in
// Europe/London rather than the runtime's local zone: the data is all
// UK-gauge data, and a reader in another timezone still wants to know what
// time it was at Worcester when the reading was taken.

// How old a reading is, in words. "min", never "mins" or "minutes", so the
// freshness caption in the app bar reads the same as the ones under the cards.
export const getRelativeTimeString = (
  date: string | Date | undefined | null
): string => {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const diffMins = Math.floor((Date.now() - dateObj.getTime()) / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24)
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
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
