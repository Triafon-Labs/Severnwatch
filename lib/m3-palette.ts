import { STATUS_COLORS } from "./statusColors";

// M3 tonal colour tokens derived from seed #006C7F - the teal Severnwatch has
// used for `primary` since the start, kept exactly rather than rounded to
// Material's nearest baseline teal (#006874). The seed sits at hue ~189, so
// the whole tonal ramp below is generated around that hue: primary at tone 40
// in the light scheme and tone 80 in the dark one, containers at 90/30, with
// the neutral and neutral-variant ramps carrying a matching low-chroma tint so
// the surfaces read as the same family rather than as grey with a teal accent
// dropped on top.
//
// The sibling Paddlecheck app runs the identical token structure off a blue
// seed. The structure is what's shared; the hue is what makes this a sibling
// rather than a reskin.
export const m3Light = {
  primary: "#006C7F",
  onPrimary: "#FFFFFF",
  primaryContainer: "#A6EDFB",
  onPrimaryContainer: "#001F26",
  secondary: "#49626A",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#CCE7F0",
  onSecondaryContainer: "#051F26",
  // The original page background, which is already tone 99 on this hue.
  surface: "#F5FAFB",
  onSurface: "#191C1E",
  surfaceVariant: "#DBE4E7",
  onSurfaceVariant: "#3F484B",
  surfaceContainerLowest: "#FFFFFF",
  surfaceContainerLow: "#F0F6F8",
  surfaceContainer: "#EAF1F3",
  surfaceContainerHigh: "#E4EBEE",
  surfaceContainerHighest: "#DEE5E8",
  outline: "#6F797C",
  outlineVariant: "#BFC8CB",
  error: STATUS_COLORS.red,
  onError: "#FFFFFF",
  errorContainer: "#FFDAD6",
  onErrorContainer: "#410002",
  // Extended (custom) colour roles. M3 has no built-in success/warning, and
  // MUI's stock M2 green/orange don't belong to this app's colour language
  // either - so the accents are taken straight from the status palette in
  // lib/statusColors.ts (Dark Green, Amber, Red), the same source the CSO
  // states and the rainfall spill likelihood draw from. A "Medium likelihood"
  // panel then reads in the same amber as the "Recent spill" chip beside it,
  // instead of introducing a second, unrelated orange. The container tones
  // stay on the M3 tonal ramp, since they back low-emphasis surfaces rather
  // than signalling status.
  //
  // All three are saturated mid-tones that carry as fills - chips, alert
  // panels, chart threshold lines - and only weakly as bare glyphs on a
  // surface, `warning` worst at around 2:1. Prefer a filled treatment over
  // colouring text or a lone icon with them, and never use them for body copy.
  success: STATUS_COLORS.darkGreen,
  onSuccess: "#FFFFFF",
  successContainer: "#A2F5AC",
  onSuccessContainer: "#00210A",
  warning: STATUS_COLORS.amber,
  onWarning: "#271900",
  warningContainer: "#FFDEA6",
  onWarningContainer: "#271900",
  inverseSurface: "#2E3133",
  inverseOnSurface: "#EFF1F3",
  inversePrimary: "#4FD8E8",
} as const;

export const m3Dark = {
  primary: "#4FD8E8",
  onPrimary: "#00363F",
  primaryContainer: "#004E5C",
  onPrimaryContainer: "#A6EDFB",
  secondary: "#B0CBD4",
  onSecondary: "#1B343B",
  secondaryContainer: "#324B53",
  onSecondaryContainer: "#CCE7F0",
  // The original dark page background - a deep teal-black rather than M3's
  // neutral #191C1E, which is why the container ramp below is hand-built to
  // climb from it (see the note on the ramp itself).
  surface: "#0B1418",
  onSurface: "#FFFFFF",
  surfaceVariant: "#1E333B",
  onSurfaceVariant: "#A0B2B8",
  surfaceContainerLowest: "#060E11",
  surfaceContainerLow: "#122229",
  surfaceContainer: "#172B33",
  surfaceContainerHigh: "#1D3540",
  surfaceContainerHighest: "#24404C",
  outline: "#8A9DA4",
  outlineVariant: "#2A4552",
  // The same status accents as the light scheme, not lifted versions of them.
  // These roles sit alongside the status palette - a `warning` alert next to a
  // "Recent" chip in the CSO list - and that palette is scheme-independent, so
  // any lift here reads as a second amber rather than as the same colour
  // adapted. The container tones below stay on the dark tonal ramp: they back
  // surfaces rather than signalling status, so they have to follow the scheme.
  error: STATUS_COLORS.red,
  onError: "#FFFFFF",
  errorContainer: "#93000A",
  onErrorContainer: "#FFDAD6",
  success: STATUS_COLORS.darkGreen,
  onSuccess: "#FFFFFF",
  successContainer: "#00531F",
  onSuccessContainer: "#A2F5AC",
  warning: STATUS_COLORS.amber,
  onWarning: "#271900",
  warningContainer: "#5F4100",
  onWarningContainer: "#FFDEA6",
  inverseSurface: "#E1E3E4",
  inverseOnSurface: "#2E3133",
  inversePrimary: "#006C7F",
} as const;

// Widened type - maps each key to string so both m3Light and m3Dark satisfy it.
export type M3Palette = { [K in keyof typeof m3Light]: string };

// M3 Expressive motion-physics springs, sampled into CSS `linear()` curves.
//
// The spec expresses these as a mass-1 spring with a stiffness and a damping
// ratio; each entry below records the pair it was generated from, along with
// the settling time that becomes its duration. Spatial springs move things
// (position, size) and carry a deliberate overshoot - that gentle bounce *is*
// the Expressive part. Effects springs change things that shouldn't overshoot
// (colour, opacity, elevation), so they're critically damped.
//
// Browsers without `linear()` fall back to the UA default easing rather than
// breaking, so this degrades to a plain timed transition.
export const m3Spring = {
  // stiffness 800, damping 0.6 - peaks at 1.095
  spatialFast: {
    easing:
      "linear(0, 0.028, 0.101, 0.202, 0.32, 0.444, 0.565, 0.679, 0.78, 0.866, 0.938, 0.994, 1.036, 1.066, 1.084, 1.093, 1.095, 1.091, 1.083, 1.073, 1.062, 1.05, 1.039, 1.028, 1.019, 1.011, 1.005, 1, 0.996, 0.993, 0.992, 0.991, 0.991, 0.992, 0.992, 0.993, 0.994, 0.995, 0.997, 0.998, 1)",
    duration: 350,
  },
  // stiffness 380, damping 0.8 - peaks at 1.015
  spatialDefault: {
    easing:
      "linear(0, 0.018, 0.066, 0.133, 0.212, 0.297, 0.382, 0.466, 0.545, 0.618, 0.684, 0.743, 0.795, 0.839, 0.877, 0.909, 0.935, 0.956, 0.973, 0.986, 0.996, 1.003, 1.008, 1.012, 1.014, 1.015, 1.015, 1.015, 1.014, 1.013, 1.012, 1.01, 1.009, 1.008, 1.007, 1.006, 1.005, 1.004, 1.003, 1.002, 1)",
    duration: 420,
  },
  // stiffness 200, damping 0.8 - peaks at 1.015
  spatialSlow: {
    easing:
      "linear(0, 0.018, 0.066, 0.133, 0.211, 0.296, 0.381, 0.465, 0.544, 0.617, 0.683, 0.742, 0.794, 0.838, 0.876, 0.908, 0.934, 0.955, 0.972, 0.985, 0.995, 1.003, 1.008, 1.012, 1.014, 1.015, 1.015, 1.015, 1.014, 1.013, 1.012, 1.011, 1.009, 1.008, 1.007, 1.006, 1.005, 1.004, 1.003, 1.002, 1)",
    duration: 570,
  },
  // stiffness 3800, critically damped
  effectsFast: {
    easing:
      "linear(0, 0.021, 0.072, 0.141, 0.219, 0.299, 0.378, 0.453, 0.522, 0.586, 0.643, 0.693, 0.738, 0.776, 0.81, 0.839, 0.864, 0.886, 0.904, 0.919, 0.932, 0.944, 0.953, 0.961, 0.967, 0.973, 0.977, 0.981, 0.984, 0.987, 0.989, 0.991, 0.993, 0.994, 0.995, 0.996, 0.997, 0.997, 0.998, 0.998, 1)",
    duration: 140,
  },
  // stiffness 1600, critically damped
  effectsDefault: {
    easing:
      "linear(0, 0.02, 0.07, 0.138, 0.214, 0.294, 0.372, 0.446, 0.515, 0.579, 0.636, 0.686, 0.731, 0.77, 0.804, 0.834, 0.859, 0.881, 0.9, 0.916, 0.929, 0.941, 0.95, 0.958, 0.965, 0.971, 0.976, 0.98, 0.983, 0.986, 0.989, 0.99, 0.992, 0.993, 0.995, 0.996, 0.996, 0.997, 0.997, 0.998, 1)",
    duration: 215,
  },
  // stiffness 800, critically damped
  effectsSlow: {
    easing:
      "linear(0, 0.02, 0.07, 0.137, 0.213, 0.292, 0.37, 0.444, 0.513, 0.576, 0.633, 0.684, 0.729, 0.768, 0.802, 0.832, 0.858, 0.88, 0.898, 0.914, 0.928, 0.94, 0.949, 0.958, 0.965, 0.97, 0.975, 0.979, 0.983, 0.986, 0.988, 0.99, 0.992, 0.993, 0.994, 0.995, 0.996, 0.997, 0.997, 0.998, 1)",
    duration: 305,
  },
} as const;

// M3 motion easing curves
export const m3Easing = {
  // Standard: everyday transitions - color, opacity, small layout shifts
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  // Decelerate: elements entering the screen (slide in, expand)
  decelerate: "cubic-bezier(0, 0, 0, 1)",
  // Accelerate: elements leaving the screen (slide out, collapse)
  accelerate: "cubic-bezier(0.3, 0, 1, 1)",
} as const;

// M3 motion duration tokens (milliseconds)
export const m3Duration = {
  short1: 50,
  short2: 100,
  short3: 150,
  short4: 200,
  medium1: 250,
  medium2: 300,
  medium3: 350,
  medium4: 400,
} as const;

type SpringToken = { easing: string; duration: number };

// Shorthand for `transition` values driven by a spring token, e.g.
//   transition: spring("transform", m3Spring.spatialFast)
export const spring = (
  properties: string,
  token: SpringToken = m3Spring.spatialDefault
): string =>
  properties
    .split(",")
    .map((p) => `${p.trim()} ${token.duration}ms ${token.easing}`)
    .join(", ");

// The same token spread over MUI's transition components (Grow, Fade, Slide),
// which take easing and timeout as separate props. Spread it in place of a
// bare `easing` so entrances land with the spring rather than easing to a
// dead stop: `<Grow in appear {...springTransition()}>`.
export const springTransition = (
  token: SpringToken = m3Spring.spatialDefault
) => ({
  easing: { enter: token.easing, exit: m3Easing.accelerate },
  timeout: { enter: token.duration, exit: m3Duration.short4 },
});

// Motion for <Collapse>, which the springs above are the wrong tool for: a
// spatial spring overshoots by design, and a section whose height overshoots
// doesn't bounce - it clips its own last line and then lets it back in.
// Collapses take M3's decelerate/accelerate pair instead, entering slower
// than they leave, the way a panel that unfurls into place should.
//
// Spread it whole where the height is known, or pass `.easing` alone next to
// `timeout="auto"` to keep MUI's content-aware duration.
export const collapseMotion = {
  easing: { enter: m3Easing.decelerate, exit: m3Easing.accelerate },
  timeout: { enter: m3Duration.medium2, exit: m3Duration.short4 },
} as const;
