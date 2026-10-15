// Categorical palette, first 3 slots - validated all-pairs CVD-safe in both
// light and dark mode. Deliberately *not* the theme's primary teal: these
// identify one gauge from another, and a series colour that matches the
// interface's accent reads as "this one is selected" rather than "this one is
// Bewdley".
//
// Kept out of components/RainfallChart.tsx so the settings sheet's key can
// draw its swatches in the same colours without importing the chart - which
// would pull recharts back into the initial bundle.
export const SERIES_COLORS: Record<"light" | "dark", string[]> = {
  light: ["#2a78d6", "#eb6834", "#1baf7a"],
  dark: ["#3987e5", "#d95926", "#199e70"],
};
