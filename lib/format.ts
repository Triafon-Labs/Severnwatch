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

// Formats an outfall's subtitle, preventing double bracketing when waypointName contains parentheses
export const formatOutfallSubtitle = (
  watercourse: string,
  waypointName: string
): string => {
  const cleanWaypoint = waypointName.replace(/\s*\(([^)]+)\)/g, " - $1");
  return `${watercourse} (${cleanWaypoint})`;
};

// Formats raw ALL-CAPS or unformatted watercourse names into clean Title Case UK English.
export const formatWatercourse = (raw: string | null | undefined): string => {
  if (!raw) return "Unknown watercourse";
  let s = raw.trim();
  if (!s) return "Unknown watercourse";

  // Check if string is all/mostly uppercase
  if (s === s.toUpperCase()) {
    s = s
      .replace(/\bTRIB OF\b/g, "Tributary of")
      .replace(/\bTRIBUTARY OF THE\b/g, "Tributary of")
      .replace(/\bTRIBUTARY OF\b/g, "Tributary of")
      .replace(
        /\bWORCESTER AND BIRMINGHAM CANAL\b/g,
        "Worcester & Birmingham Canal"
      )
      .replace(/\bCONF\b/g, "conf.")
      .replace(/\bBK\b/g, "Brook")
      .replace(/\bR\b/g, "River");

    // Title case words, preserving "&"
    s = s
      .toLowerCase()
      .replace(/(?:^|\s|-|\/|\()\w/g, (match) => match.toUpperCase());

    // Restore prepositions/abbreviations
    s = s
      .replace(/\bOf\b/g, "of")
      .replace(/\bTo\b/g, "to")
      .replace(/\bAnd\b/g, "&")
      .replace(/\bConf\.\b/g, "conf.");
  }
  return s;
};
