import { format } from "date-fns";

// "Data as of" freshness indicator, shared across data cards.
export const formatAsOf = (iso: string): string =>
  `Data as of ${format(new Date(iso), "HH:mm, d MMM")}`;
