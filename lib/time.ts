import { useEffect, useState } from "react";

// Time formatting shared across the app. Everything here works in
// Europe/London rather than the runtime's local zone: the data is all
// UK-gauge data, and a reader in another timezone still wants to know what
// time it was at Worcester when the reading was taken.

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

// Ticks once a minute so anything displaying data age stays accurate for as
// long as the component stays mounted, even without a refetch. Also catches
// up the moment the page is shown again: a backgrounded phone freezes the
// interval, and without this the clock would resume from wherever it stopped.
export const useNowTicking = (intervalMs: number = 60 * 1000): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, intervalMs);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs]);
  return now;
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
