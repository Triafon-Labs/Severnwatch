import { format } from "date-fns";

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
};

// "Data as of" freshness indicator, shared across data cards.
export const formatAsOf = (iso: string): string =>
  `Data as of ${format(new Date(iso), "HH:mm, d MMM")}`;
