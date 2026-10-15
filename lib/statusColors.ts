// The app's status colour language, in one place.
//
// These hues are the whole vocabulary for "how bad is this?" - CSO spill
// states (Ongoing / Recent / Not discharging / Offline), the rainfall
// intensity bands on the chart, the bathing-water classification tiers, and
// the theme's error/success/warning roles in lib/m3-palette.ts all draw from
// here rather than each keeping their own copy. Two copies drift: a "Heavy"
// band ends up in one red while the "Ongoing" chip above it renders in
// another, and nothing in the code says which one is right.
//
// They are deliberately scheme-independent. A status colour is the signal, so
// the same reading has to look the same whichever theme you're in, and every
// place that carries one - chips, alert icons, chart threshold lines - has to
// agree on it.
//
// Shared with the sibling Paddlecheck app, which uses the same five hues for
// its RAG statuses. Keeping them identical is deliberate: the two apps get
// read side by side, and "amber" meaning two different colours between them
// would be worse than either choice on its own.
export const STATUS_COLORS = {
  red: "#B71C1C",
  amber: "#FF8F00",
  yellow: "#FBC02D",
  darkGreen: "#008000",
  lightGreen: "#4CBB17",
  grey: "#9E9E9E",
} as const;

// The label colour to put *on* each fill above.
//
// Because the hues are scheme-independent, so is their on-colour: a white
// glyph on the red reads the same in either theme. They are not all white,
// though - the amber, the yellow and the light green are light enough that
// white text sits near 2:1 on them, so those take a near-black drawn from the
// same hue instead. Ratios below are measured against the fill each pairs
// with.
export const ON_STATUS_COLORS = {
  red: "#FFFFFF", // 6.57:1
  amber: "#2B1700", // 7.49:1
  yellow: "#241A00", // 10.37:1
  darkGreen: "#FFFFFF", // 5.14:1
  lightGreen: "#0D2600", // 6.51:1
  grey: "#1F1F1F", // 6.15:1
} as const;

export type StatusColorName = keyof typeof STATUS_COLORS;
