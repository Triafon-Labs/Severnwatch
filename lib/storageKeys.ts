// Canonical names for everything this app puts in localStorage, so a key is
// only ever spelled out once. Two spellings of the same key is a bug that
// looks like "the setting doesn't stick".
export const STORAGE_KEYS = {
  // MUI reads and writes this one itself (see lib/ThemeContext.tsx), using its
  // own "light" | "dark" | "system" vocabulary.
  THEME_MODE: "themeMode",
  RAINFALL_RANGE: "rainfallRange",
  CSO_DATA: "severnwatch_csoData",
  RAINFALL_DATA: "severnwatch_rainfallData",
  WATER_QUALITY_DATA: "severnwatch_waterQualityData",
  SAMPLE_INDICATOR: "sampleHistoryIndicator",
  // The DISCLAIMER_VERSION last accepted in the first-run pop-up.
  DISCLAIMER_ACCEPTED: "disclaimerAccepted",
} as const;

// Set on <html> by the inline script in app/layout.tsx before first paint
// when the disclaimer hasn't been accepted, so globals.css can blur the app
// until DisclaimerDialog opens over it. Must match the selector there.
export const DISCLAIMER_PENDING_ATTR = "data-disclaimer-pending";
