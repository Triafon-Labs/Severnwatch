import {
  createTheme,
  type CSSObject,
  type Theme,
  type ThemeOptions,
} from "@mui/material/styles";
import {
  m3Light,
  m3Dark,
  type M3Palette,
  m3Easing,
  m3Duration,
  m3Spring,
  spring,
} from "./m3-palette";

// The tonal surface roles, exposed on the palette so components can reach
// them through `sx` (e.g. `bgcolor: "surfaces.containerHigh"`) instead of
// importing the raw token maps and re-implementing the light/dark split.
// M3 draws a firm line between these and the `action.*` state-layer colours:
// state layers are translucent overlays that express interaction, so using
// one as a component's resting background (as several panels used to) reads
// as a permanently-hovered surface and drifts with any state-layer change.
interface M3Surfaces {
  containerLowest: string;
  containerLow: string;
  container: string;
  containerHigh: string;
  containerHighest: string;
  variant: string;
  onVariant: string;
  outline: string;
  inverse: string;
  onInverse: string;
}

// Opts the MUI types into their CSS-theme-variables branch, which is what
// makes `theme.vars` and the provider's `forceThemeRerender` prop visible to
// TypeScript. Without it the types describe the non-variables theme even
// though `cssVariables` is set below.
declare module "@mui/material/styles" {
  interface CssThemeVariables {
    enabled: true;
  }
  interface Palette {
    surfaces: M3Surfaces;
  }
  interface PaletteOptions {
    surfaces?: M3Surfaces;
  }
  // M3 pairs every accent role with a lower-emphasis container role. MUI's
  // PaletteColor only models main/light/dark/contrastText, so the container
  // pair is added here rather than hard-coding tonal values at call sites.
  interface PaletteColor {
    container: string;
    onContainer: string;
  }
  interface SimplePaletteColorOptions {
    container?: string;
    onContainer?: string;
  }
}

// Both schemes' surface sets, derived from the same token maps that drive
// the component overrides below.
const surfacesFor = (m3: M3Palette): M3Surfaces => ({
  containerLowest: m3.surfaceContainerLowest,
  containerLow: m3.surfaceContainerLow,
  container: m3.surfaceContainer,
  containerHigh: m3.surfaceContainerHigh,
  containerHighest: m3.surfaceContainerHighest,
  variant: m3.surfaceVariant,
  onVariant: m3.onSurfaceVariant,
  outline: m3.outline,
  inverse: m3.inverseSurface,
  onInverse: m3.inverseOnSurface,
});

// M3 type scale mapped to MUI variants.
//
// opsz (optical size) is clamped at the font's designed default of 14 rather
// than tracking each step's pixel size. Roboto Flex's opsz axis runs 8-144,
// and above 14 it steadily narrows the letterforms and thins the strokes for
// print-scale display type: measured against opsz 14, a line set at opsz 24
// is 4.7% narrower, at 32 8.4%, at 57 14.4%, with the x-height dropping in
// step. Pinning opsz to the size therefore makes every heading render lighter
// and shorter-looking than its nominal size. It also isn't buying anything
// the browser wasn't already doing: `font-optical-sizing` defaults to `auto`,
// which is exactly "opsz = font-size".
//
// M3's type scale is drawn for Roboto, which is Roboto Flex frozen at opsz
// 14, so 14 is the value that gives the scale the proportions it was designed
// with. Below 14 the ramp works in our favour - it opens the spacing out and
// thickens the strokes - so the two smallest steps keep an opsz matched to
// their size.
//
// Two axes are deliberately absent:
//
// wght is driven by each variant's `fontWeight` instead of being pinned here.
// font-variation-settings outranks font-weight, so listing the axis would make
// every `sx={{ fontWeight: … }}` at a call site silently do nothing - which
// takes M3's emphasised type styles off the table.
//
// wdth stays at the font's designed default. M3's type scale doesn't vary
// width at all (its emphasised styles vary weight), and widened letterforms
// read as subtly wrong.
const OPSZ_DEFAULT = '"opsz" 14';
const m3Typography: ThemeOptions["typography"] = {
  // next/font renames the family it registers, so naming "Roboto Flex" here
  // would match nothing and every MUI component would quietly fall through to
  // Helvetica - taking the variable axes below with it, since a static
  // fallback has no opsz to set. The variable is declared by the localFont()
  // call in app/layout.tsx and already expands to the family plus its
  // metric-matched fallback, so only the generic families follow it.
  fontFamily: "var(--font-roboto-flex), Helvetica, Arial, sans-serif",
  // Display Large - rarely used in app, included for completeness
  h1: {
    fontSize: "3.5625rem",
    fontWeight: 400,
    lineHeight: 1.127,
    // M3 Display Large tracks -0.25px at 57px.
    letterSpacing: "-0.004386em",
    fontVariationSettings: OPSZ_DEFAULT,
  },
  // Display Medium
  h2: {
    fontSize: "2.8125rem",
    fontWeight: 400,
    lineHeight: 1.156,
    letterSpacing: "0em",
    fontVariationSettings: OPSZ_DEFAULT,
  },
  // Display Small
  h3: {
    fontSize: "2.25rem",
    fontWeight: 400,
    lineHeight: 1.222,
    letterSpacing: "0em",
    fontVariationSettings: OPSZ_DEFAULT,
  },
  // Headline Large
  h4: {
    fontSize: "2rem",
    fontWeight: 400,
    lineHeight: 1.25,
    letterSpacing: "0em",
    fontVariationSettings: OPSZ_DEFAULT,
  },
  // Headline Small - used for card titles ("Water Quality Status", "Rainfall")
  h5: {
    fontSize: "1.5rem",
    fontWeight: 600,
    lineHeight: 1.333,
    letterSpacing: "0em",
    fontVariationSettings: OPSZ_DEFAULT,
  },
  // Title Large - used for settings section headings
  h6: {
    fontSize: "1.375rem",
    fontWeight: 500,
    lineHeight: 1.273,
    letterSpacing: "0em",
    fontVariationSettings: OPSZ_DEFAULT,
  },
  // Title Medium
  subtitle1: {
    fontSize: "1rem",
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: "0.009375em",
    fontVariationSettings: OPSZ_DEFAULT,
  },
  // Title Small
  subtitle2: {
    fontSize: "0.875rem",
    fontWeight: 500,
    lineHeight: 1.429,
    letterSpacing: "0.00714em",
    fontVariationSettings: OPSZ_DEFAULT,
  },
  // Body Large
  body1: {
    fontSize: "1rem",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.03125em",
    fontVariationSettings: OPSZ_DEFAULT,
  },
  // Body Medium
  body2: {
    fontSize: "0.875rem",
    fontWeight: 400,
    lineHeight: 1.429,
    letterSpacing: "0.015625em",
    fontVariationSettings: OPSZ_DEFAULT,
  },
  // Body Small
  caption: {
    fontSize: "0.75rem",
    fontWeight: 400,
    lineHeight: 1.333,
    // 0.4px at 12px, per M3 Body Small.
    letterSpacing: "0.033333em",
    fontVariationSettings: '"opsz" 12',
  },
  // Label Small
  overline: {
    fontSize: "0.6875rem",
    fontWeight: 500,
    lineHeight: 1.455,
    letterSpacing: "0.0454em",
    textTransform: "uppercase",
    fontVariationSettings: '"opsz" 11',
  },
  // Label Large - button text
  button: {
    fontSize: "0.875rem",
    fontWeight: 500,
    lineHeight: 1.429,
    // 0.1px at 14px, per M3 Label Large - matching subtitle2, which is the
    // same 14px step of the scale.
    letterSpacing: "0.00714em",
    textTransform: "none",
    fontVariationSettings: OPSZ_DEFAULT,
  },
};

// One palette shape, filled from whichever token map a scheme uses, so a
// role can't end up defined for light and forgotten for dark.
const paletteFor = (m3: M3Palette) => ({
  primary: {
    main: m3.primary,
    contrastText: m3.onPrimary,
    container: m3.primaryContainer,
    onContainer: m3.onPrimaryContainer,
  },
  secondary: {
    main: m3.secondary,
    contrastText: m3.onSecondary,
    container: m3.secondaryContainer,
    onContainer: m3.onSecondaryContainer,
  },
  error: {
    main: m3.error,
    contrastText: m3.onError,
    container: m3.errorContainer,
    onContainer: m3.onErrorContainer,
  },
  success: {
    main: m3.success,
    contrastText: m3.onSuccess,
    container: m3.successContainer,
    onContainer: m3.onSuccessContainer,
  },
  warning: {
    main: m3.warning,
    contrastText: m3.onWarning,
    container: m3.warningContainer,
    onContainer: m3.onWarningContainer,
  },
  background: { default: m3.surface, paper: m3.surfaceContainerLow },
  text: { primary: m3.onSurface, secondary: m3.onSurfaceVariant },
  divider: m3.outlineVariant,
  surfaces: surfacesFor(m3),
});

// Emits one declaration per colour scheme from a single token-keyed rule:
// the light values apply at the base selector, the dark ones inside the
// theme's `.dark` scheme selector. Returned as an array so `applyStyles`
// always lands last, which is what MUI's docs require for correct ordering.
const perScheme = (
  theme: Theme,
  rule: (m3: M3Palette) => CSSObject
): CSSObject[] => [rule(m3Light), theme.applyStyles("dark", rule(m3Dark))];

// Shared component overrides. Using compound selectors (&.MuiPaper-outlined)
// ensures higher specificity than MUI's own variant rules, reliably stripping
// the outlined border from Cards while leaving other Paper components (e.g.
// chart tooltips) untouched.
const components: ThemeOptions["components"] = {
  MuiCssBaseline: {
    styleOverrides: {
      // The type scale is written in rem, so this is the one knob that moves
      // all of it at once. M3's scale is specified for phone-sized reading
      // distances and comes out small on a dashboard read at arm's length, so
      // every step is scaled up by a sixteenth. A percentage keeps it relative
      // to whatever base size the reader has set in their browser, which a
      // hardcoded `17px` would throw away. Nothing else needs adjusting:
      // MUI's own pxToRem values ride the same base, while the px-based
      // spacing scale deliberately doesn't, so text grows inside the existing
      // paddings rather than pushing every card taller with it.
      html: {
        fontSize: "106.25%",
      },
      // CssBaseline sets -webkit-font-smoothing: antialiased of its own
      // accord, so dropping it from globals.css alone changes nothing. It
      // disables subpixel rendering on macOS and thins every stroke, which
      // works against the weights the type scale asks for; `auto` is the
      // property's initial value, i.e. whatever the platform does normally.
      body: {
        WebkitFontSmoothing: "auto",
        MozOsxFontSmoothing: "auto",
        // The type scale pins opsz per variant (see m3Typography), but text
        // that isn't a Typography variant - Chip labels, table cells, chart
        // labels, anything sized straight from `sx` - would otherwise be left
        // on the browser default of `auto`, which ramps opsz with the font
        // size and reintroduces the thinning the scale exists to avoid.
        fontOpticalSizing: "none",
      },
      // Form controls don't inherit typography from their ancestors - the UA
      // stylesheet gives them the system font outright - so the body rule
      // above never reaches them.
      "button, input, optgroup, select, textarea": {
        fontOpticalSizing: "none",
      },
      // Recharts hands out tabindex freely: the chart's <svg> gets 0 for its
      // accessibility layer (arrow keys walk the series), and each z-index
      // layer <g>, portal and tooltip box gets -1. Chromium paints its focus
      // ring on a focused SVG element whether or not `:focus-visible`
      // matches, and a press lands focus on whichever of those the finger hit
      // - so tapping the rainfall chart drew a hard rectangle, sized to a
      // different layer's bounding box depending on where it was tapped. Kill
      // the ring across the whole chart, then put the app's M3 indicator back
      // on the one element a reader can actually reach with Tab, which is the
      // surface. The colour comes from the palette's CSS variable rather than
      // `perScheme` because CssBaseline's overrides are a plain global-style
      // object with no theme in scope.
      ".recharts-wrapper": {
        WebkitTapHighlightColor: "transparent",
      },
      ".recharts-wrapper :focus": {
        outline: "none",
      },
      ".recharts-wrapper .recharts-surface:focus-visible": {
        outline: "3px solid var(--mui-palette-primary-main)",
        outlineOffset: 2,
      },
      // Everything M3 Expressive adds - the springs, the sliding pill, the
      // spinning refresh affordance - is motion a vestibular-sensitive viewer
      // has asked not to see. M3's accessibility guidance is to honour the
      // request globally rather than component by component, so transitions
      // collapse to a single frame and looping animations stop at their first
      // keyframe. `!important` is needed because most of the durations it's
      // overriding are themselves inline emotion styles.
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": {
          animationDuration: "0.01ms !important",
          animationIterationCount: "1 !important",
          transitionDuration: "0.01ms !important",
          scrollBehavior: "auto !important",
        },
      },
    },
  },
  // MUI still paints Material 2's dark-mode "elevation overlay" - a white
  // linear-gradient laid over the paper colour - on every elevated Paper.
  // M3 replaced that idea outright with the tonal surfaceContainer ramp, so
  // the gradient is stripped here and elevated papers (chart tooltips, menus,
  // popovers) sit on a genuine tonal surface instead.
  MuiPaper: {
    styleOverrides: {
      root: ({ theme }) => [
        { backgroundImage: "none" },
        // Deliberately limited to the low elevations, which is what a bare
        // <Paper> in this app uses (chart tooltips). The components that ride
        // on higher elevations - Drawer at 16, Menu at 8, SnackbarContent at
        // 6 - each pick their own tonal surface further down. Matching every
        // non-zero elevation here would out-specify those rules, because
        // `applyStyles` compiles this one to a longer selector than theirs.
        ...perScheme(theme, (m3) => ({
          "&.MuiPaper-elevation1, &.MuiPaper-elevation2, &.MuiPaper-elevation3, &.MuiPaper-elevation4":
            {
              backgroundColor: m3.surfaceContainerHigh,
            },
        })),
      ],
    },
  },
  MuiCard: {
    // Cards render at elevation 0 so they stay out of the elevation1-4 bucket
    // the MuiPaper override above claims for surfaceContainerHigh. That rule
    // compiles to a longer selector than this one (see the note there), so a
    // card left at MUI's default elevation of 1 is painted a tone lighter than
    // `surfaceContainer` below - which is the tone the panels *inside* it use,
    // so the nesting flattens and the panels disappear into the card.
    //
    // Every call site used to hold this off by passing `variant="outlined"`,
    // which looked decorative because the override below strips the border it
    // asks for. What it was really doing was keeping the card off the
    // elevation classes. Setting the elevation here does that on purpose, and
    // in one place.
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: ({ theme }) => [
        {
          borderRadius: 16,
          // Strip both variant styles so cards always show the tonal surface
          "&.MuiPaper-outlined": { border: "none" },
          "&.MuiPaper-elevation": { boxShadow: "none" },
        },
        ...perScheme(theme, (m3) => ({
          backgroundColor: m3.surfaceContainer,
        })),
      ],
    },
  },
  // 24dp on all four sides, and the only inset the cards carry. Each of them
  // used to set padding on the Card as well, on top of the padding CardContent
  // brings of its own, so every card was inset twice over - an expensive way
  // to spend a 360px phone.
  //
  // 24 rather than the 16 M3 gives as a card's padding: at 16 the content sits
  // hard against the card edge, with the same gap inside the card as between
  // one card and the next, so nothing marks where a card begins. M3 pairs a
  // 16dp inset with an 8dp gap between cards for exactly that reason - the
  // inset is meant to be the larger of the two. This keeps that relationship
  // with the 16px gap the page settled on.
  MuiCardContent: {
    styleOverrides: {
      root: {
        padding: 24,
        "&:last-child": { paddingBottom: 24 },
      },
    },
  },
  // No bottom border. `outlineVariant` is darker than the bar in the light
  // scheme and lighter than it in the dark one, so the same rule drew a shadow
  // line under the bar in one scheme and an edge-lit seam in the other. M3
  // doesn't give the top app bar a divider at all - separation comes from the
  // tonal step the bar takes when content scrolls under it (see TopNavBar),
  // and that ramp moves away from the background in whichever direction the
  // scheme runs, so it reads the same way in both.
  //
  // Both scroll states live here rather than in an sx at the call site,
  // because perScheme's dark half goes through applyStyles and compiles to a
  // selector with an ancestor in it. That outranks a single sx class, so an sx
  // colour on the AppBar would take effect in the light scheme and be silently
  // dropped in the dark one - the same trap as the Card elevation above.
  //
  // The scrolled tone is containerHighest, not the container M3 names for it,
  // because container is exactly what the cards are painted: a card sliding
  // under the bar would meet a boundary between two identical fills. Highest
  // clears the cards by a step in both schemes, in the direction each scheme's
  // ramp already runs.
  MuiAppBar: {
    styleOverrides: {
      root: ({ theme }) => [
        { boxShadow: "none", transition: spring("background-color") },
        ...perScheme(theme, (m3) => ({
          backgroundColor: m3.surfaceContainerLow,
          color: m3.onSurface,
          '&[data-scrolled="true"]': {
            backgroundColor: m3.surfaceContainerHighest,
          },
        })),
      ],
    },
  },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        borderRadius: 9999,
        textTransform: "none",
        paddingLeft: 24,
        paddingRight: 24,
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => [
        { borderRadius: 9999 },
        // M3 focus indicator - thin primary outline on keyboard focus
        ...perScheme(theme, (m3) => ({
          "&.Mui-focusVisible": {
            outline: `3px solid ${m3.primary}`,
            outlineOffset: 2,
            transition: `outline ${m3Duration.short2}ms ${m3Easing.standard}`,
          },
        })),
      ],
    },
  },
  MuiChip: {
    styleOverrides: {
      root: ({ theme }) => [
        { borderRadius: 8 },
        // The success/warning/error chips deliberately keep MUI's saturated
        // filled treatment, drawing on the status accents in
        // lib/m3-palette.ts. Demoting them to the tonal container pair is more
        // orthodox M3 and makes a cleaner emphasis hierarchy, but it washes the
        // status colours out - and on a water-quality dashboard the colour
        // needs to carry at a glance, so legibility wins over hierarchy here.
        ...perScheme(theme, (m3) => ({
          // Read through custom properties rather than set outright: some
          // chips carry their own exact status colour, and `applyStyles`
          // emits the dark rule under a `.dark` ancestor selector, which
          // outranks the single class an `sx` background compiles to. Those
          // chips would go flat grey in dark mode only. Setting
          // --chip-bg/--chip-fg at the call site wins regardless of
          // specificity, since there is nothing to out-specify.
          "&.MuiChip-filled.MuiChip-colorDefault": {
            backgroundColor: `var(--chip-bg, ${m3.surfaceContainerHighest})`,
            color: `var(--chip-fg, ${m3.onSurfaceVariant})`,
          },
        })),
      ],
    },
  },
  // Segmented pill control - container + individual pill buttons
  MuiToggleButtonGroup: {
    styleOverrides: {
      root: ({ theme }) => [
        {
          borderRadius: 9999,
          padding: 4,
          border: "none",
          gap: 4,
        },
        ...perScheme(theme, (m3) => ({
          backgroundColor: m3.surfaceContainerHighest,
        })),
      ],
      grouped: {
        // Remove MUI's inter-button borders; shape is set per-button
        border: "none !important",
        borderRadius: "9999px !important",
        margin: "0 !important",
      },
    },
  },
  MuiToggleButton: {
    styleOverrides: {
      root: ({ theme }) => [
        {
          borderRadius: 9999,
          border: "none",
          textTransform: "none",
          // Every group in the app lays its pills out with flex, so the side
          // padding only ever sets each pill's *minimum* width - at normal
          // widths they're sized by their flex share and this is invisible.
          // It matters on a 320px phone, where the rainfall range control has
          // to fit five pills ("Forecast" through "7d") into a narrow row: at
          // MUI's default 11px the labels alone overran it. The vertical
          // padding is what carries the touch target, and 8px + the 20px
          // label line keeps it at M3's 36dp minimum for a small pill.
          padding: "8px 6px",
          // The selected pill sets `overflow: hidden` for its state layer
          // (below), and an overflow other than `visible` switches a flex
          // item's automatic minimum size off - so under a fullWidth group's
          // `flex: 1 1 0%`, the selected pill alone is free to shrink to its
          // padding and clip its own label. Restoring the floor explicitly
          // keeps every pill at least as wide as its text, selected or not.
          minWidth: "fit-content",
          // Lets label/icon colour recolour in step with
          // SlidingToggleButtonGroup's pill sliding underneath, rather than
          // flipping instantly. Colour is an "effects" change in M3's motion
          // system, so it gets the critically-damped spring - overshooting a
          // colour just looks wrong.
          transition: spring("color", m3Spring.effectsDefault),
        },
        ...perScheme(theme, (m3) => ({
          "&.Mui-focusVisible": {
            outline: `3px solid ${m3.primary}`,
            outlineOffset: -1,
            zIndex: 1,
          },
          "&.Mui-selected": {
            backgroundColor: m3.primary,
            color: m3.onPrimary,
            // M3 state layers via pseudo-element overlay
            position: "relative",
            overflow: "hidden",
            "&::after": {
              content: '""',
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              backgroundColor: m3.onPrimary,
              opacity: 0,
              transition: `opacity ${m3Duration.short2}ms ${m3Easing.standard}`,
              pointerEvents: "none",
            },
            "&:hover::after": { opacity: 0.08 },
            "&.Mui-focusVisible::after": { opacity: 0.12 },
            "&:active::after": { opacity: 0.12 },
            "&:hover": { backgroundColor: m3.primary },
          },
        })),
      ],
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => [
        { backgroundImage: "none" },
        ...perScheme(theme, (m3) => ({
          backgroundColor: m3.surfaceContainerLow,
        })),
      ],
    },
  },
  MuiAccordion: {
    styleOverrides: {
      root: {
        backgroundColor: "transparent",
        backgroundImage: "none",
      },
    },
  },
  // MUI's own defaults animate the summary row (height/margin/chevron) at
  // theme.transitions.duration.shortest (50ms), far quicker than the
  // auto-height Collapse driving the details panel below it - the header
  // snaps into its expanded shape well before the body finishes unfurling.
  // Slowing the summary row to match keeps both halves reading as one motion.
  MuiAccordionSummary: {
    styleOverrides: {
      root: {
        transition: `min-height ${m3Duration.short3}ms ${m3Easing.standard}, background-color ${m3Duration.short3}ms ${m3Easing.standard}`,
      },
      content: {
        transition: `margin ${m3Duration.short3}ms ${m3Easing.standard}`,
      },
      expandIconWrapper: {
        transition: `transform ${m3Duration.short3}ms ${m3Easing.standard}`,
      },
    },
  },
  MuiDivider: {
    styleOverrides: {
      root: ({ theme }) =>
        perScheme(theme, (m3) => ({ borderColor: m3.outlineVariant })),
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: ({ theme }) => [
        {
          "&:last-child td, &:last-child th": { border: 0 },
          transition: `background-color ${m3Duration.short2}ms ${m3Easing.standard}`,
        },
        // M3 hover state layer at 4% onSurface
        ...perScheme(theme, (m3) => ({
          "&:hover": { backgroundColor: `${m3.onSurface}0A` },
        })),
      ],
    },
  },
  MuiSelect: {
    styleOverrides: {
      root: { borderRadius: 12 },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: { borderRadius: 12 },
      notchedOutline: ({ theme }) =>
        perScheme(theme, (m3) => ({ borderColor: m3.outline })),
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: ({ theme }) => [
        { borderRadius: 12 },
        // Nothing currently renders an <Alert>: the status panels that used to
        // be outlined Alerts are now InfoPanels on the tonal container pair,
        // which is the shape M3 actually gives an inline status surface. This
        // override stays because MUI's Alert defaults are Material 2 - a
        // tinted background with saturated `main` text, which leaves dark mode
        // a near-black panel - so the first Alert anyone adds would otherwise
        // land off-system. It is a guard rail, not a description of the
        // current page.
        ...perScheme(theme, (m3) => ({
          "&.MuiAlert-standardError": {
            backgroundColor: m3.errorContainer,
            color: m3.onErrorContainer,
            "& .MuiAlert-icon": { color: m3.onErrorContainer },
          },
          "&.MuiAlert-standardWarning": {
            backgroundColor: m3.warningContainer,
            color: m3.onWarningContainer,
            "& .MuiAlert-icon": { color: m3.onWarningContainer },
          },
          "&.MuiAlert-standardSuccess": {
            backgroundColor: m3.successContainer,
            color: m3.onSuccessContainer,
            "& .MuiAlert-icon": { color: m3.onSuccessContainer },
          },
          "&.MuiAlert-standardInfo": {
            backgroundColor: m3.secondaryContainer,
            color: m3.onSecondaryContainer,
            "& .MuiAlert-icon": { color: m3.onSecondaryContainer },
          },
          // The outlined variant needs the same treatment: MUI draws its
          // border in the saturated `main` colour while leaving the fill
          // transparent, so an error panel is a hard red rectangle around body
          // text sitting directly on the card. Give it the container fill too
          // and keep the border as the accent, so the severity is carried by
          // the tone and the icon rather than by a ring.
          "&.MuiAlert-outlinedError": {
            backgroundColor: m3.errorContainer,
            color: m3.onErrorContainer,
            border: `1px solid ${m3.error}`,
            "& .MuiAlert-icon": { color: m3.error },
          },
          "&.MuiAlert-outlinedWarning": {
            backgroundColor: m3.warningContainer,
            color: m3.onWarningContainer,
            border: `1px solid ${m3.warning}`,
            "& .MuiAlert-icon": { color: m3.onWarningContainer },
          },
          "&.MuiAlert-outlinedSuccess": {
            backgroundColor: m3.successContainer,
            color: m3.onSuccessContainer,
            border: `1px solid ${m3.success}`,
            "& .MuiAlert-icon": { color: m3.onSuccessContainer },
          },
        })),
      ],
    },
  },
  // M3's switch is a different component from Material 2's, not a restyle:
  // a 52x32 track with an outline when off, a thumb that grows from 16dp to
  // 24dp as it travels, and a state layer that only appears on interaction.
  // MUI still ships the M2 shape, so the whole thing is rebuilt here.
  MuiSwitch: {
    defaultProps: { disableRipple: true },
    styleOverrides: {
      root: {
        width: 52,
        height: 32,
        padding: 0,
        overflow: "visible",
        marginRight: 8,
      },
      switchBase: ({ theme }) => [
        {
          // 8px of padding around the 16px thumb keeps the hit target at
          // 32x32 even though the thumb itself is small.
          padding: 8,
          transition: spring("transform", m3Spring.spatialFast),
          "&:hover, &.Mui-focusVisible": { backgroundColor: "transparent" },
          "&.Mui-checked": { transform: "translateX(20px)" },
        },
        ...perScheme(theme, (m3) => ({
          color: m3.outline,
          "&.Mui-checked": { color: m3.onPrimary },
          // The selected track is coloured from here rather than from the
          // `track` slot below. A sibling selector written there would have to
          // start `.Mui-checked + &`, and `applyStyles` wraps its rule as
          // `.dark &` - so the nested `&` expands to `.dark <track>` and the
          // whole thing becomes `.Mui-checked + .dark <track>`, which matches
          // nothing. Anchoring on `&` keeps the scheme class where it belongs.
          "&.Mui-checked + .MuiSwitch-track": {
            backgroundColor: m3.primary,
            borderColor: m3.primary,
            opacity: 1,
          },
          // The state layer is a 40dp halo around the thumb rather than a
          // fill, so it lives on a pseudo-element instead of the usual MUI
          // hover background.
          "&::before": {
            content: '""',
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            backgroundColor: m3.onSurface,
            opacity: 0,
            transition: `opacity ${m3Duration.short2}ms ${m3Easing.standard}`,
            pointerEvents: "none",
          },
          "&:hover::before": { opacity: 0.08 },
          "&.Mui-focusVisible::before": { opacity: 0.12 },
          "&.Mui-checked::before": { backgroundColor: m3.primary },
          "&.Mui-disabled": { color: `${m3.onSurface}61` },
        })),
      ],
      thumb: {
        width: 16,
        height: 16,
        boxShadow: "none",
        transition: spring("width, height, margin", m3Spring.spatialFast),
        ".Mui-checked &": { width: 24, height: 24, margin: -4 },
      },
      track: ({ theme }) => [
        {
          borderRadius: 16,
          opacity: 1,
          border: "2px solid",
          transition: `background-color ${m3Duration.short4}ms ${m3Easing.standard}, border-color ${m3Duration.short4}ms ${m3Easing.standard}`,
        },
        // Unselected track is surfaceContainerHighest per spec. The selected
        // state lives on switchBase above.
        ...perScheme(theme, (m3) => ({
          backgroundColor: m3.surfaceContainerHighest,
          borderColor: m3.outline,
        })),
      ],
    },
  },
  // MUI hangs control labels 11px into the left margin to cancel out the
  // padding on its own Material 2 switch. The M3 switch above carries no such
  // padding, so that compensation would pull the row out of alignment with
  // every heading beside it.
  MuiFormControlLabel: {
    styleOverrides: {
      root: { marginLeft: 0 },
    },
  },
  // M3 primary tabs: label-large text, and an indicator that's a 3dp bar with
  // rounded top corners inset to the label, not MUI's full-width 2dp square
  // rule.
  MuiTabs: {
    styleOverrides: {
      root: { minHeight: 48 },
      indicator: {
        height: 3,
        borderRadius: "3px 3px 0 0",
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: ({ theme }) => [
        {
          textTransform: "none",
          minHeight: 48,
          fontWeight: 500,
          transition: `color ${m3Duration.short4}ms ${m3Easing.standard}`,
        },
        ...perScheme(theme, (m3) => ({
          color: m3.onSurfaceVariant,
          "&.Mui-selected": { color: m3.primary },
          "&.Mui-focusVisible": {
            outline: `3px solid ${m3.primary}`,
            outlineOffset: -3,
            borderRadius: 8,
          },
        })),
      ],
    },
  },
  // M3 plain tooltip - inverse surface, body-small text, 4dp corners. MUI's
  // default is Material 2's translucent grey.
  MuiTooltip: {
    styleOverrides: {
      tooltip: ({ theme }) => [
        {
          borderRadius: 4,
          fontSize: "0.75rem",
          lineHeight: 1.333,
          letterSpacing: "0.025em",
          fontWeight: 400,
          padding: "4px 8px",
        },
        ...perScheme(theme, (m3) => ({
          backgroundColor: m3.inverseSurface,
          color: m3.inverseOnSurface,
        })),
      ],
      arrow: ({ theme }) =>
        perScheme(theme, (m3) => ({ color: m3.inverseSurface })),
    },
  },
  // Same inverse-surface pairing for snackbars, which MUI otherwise renders
  // in a fixed Material 2 grey that ignores the colour scheme entirely.
  MuiSnackbarContent: {
    styleOverrides: {
      root: ({ theme }) => [
        { borderRadius: 4, boxShadow: "none" },
        ...perScheme(theme, (m3) => ({
          backgroundColor: m3.inverseSurface,
          color: m3.inverseOnSurface,
        })),
      ],
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: ({ theme }) => [
        { borderRadius: 12, boxShadow: "none" },
        ...perScheme(theme, (m3) => ({
          backgroundColor: m3.surfaceContainer,
          border: `1px solid ${m3.outlineVariant}`,
        })),
      ],
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: ({ theme }) =>
        perScheme(theme, (m3) => ({
          "&.Mui-selected": {
            backgroundColor: m3.secondaryContainer,
            color: m3.onSecondaryContainer,
            "&:hover": { backgroundColor: m3.secondaryContainer },
          },
        })),
    },
  },
  // The skeletons stand in for content on the tonal card surface, so the
  // default 11%-black wash is nearly invisible in dark mode. Pin them to the
  // next surface step up instead, which is the same tone the loaded panels
  // will occupy.
  MuiSkeleton: {
    styleOverrides: {
      root: ({ theme }) =>
        perScheme(theme, (m3) => ({
          backgroundColor: m3.surfaceContainerHigh,
        })),
    },
  },
};

// M3-compliant MUI transitions config - propagates to all MUI components
// that use theme.transitions.create() (Drawer, Accordion, Collapse, Fade…)
const m3Transitions: ThemeOptions["transitions"] = {
  easing: {
    easeInOut: m3Easing.standard, // everyday state transitions
    easeOut: m3Easing.decelerate, // elements entering the screen
    easeIn: m3Easing.accelerate, // elements leaving the screen
    sharp: m3Easing.standard, // quick discrete changes
  },
  duration: {
    shortest: m3Duration.short1,
    shorter: m3Duration.short3,
    short: m3Duration.short4,
    standard: m3Duration.medium2,
    complex: m3Duration.medium4,
    enteringScreen: m3Duration.medium3,
    leavingScreen: m3Duration.short4,
  },
};

// One theme carrying both colour schemes as CSS variables, rather than two
// themes swapped at runtime. Both schemes' variables are emitted during SSR
// and InitColorSchemeScript (see app/layout.tsx) picks the right one before
// first paint, so a dark-mode visitor never sees a flash of light theme.
// `colorSchemeSelector: "class"` pairs with that script's `attribute="class"`:
// it toggles a `light`/`dark` class on <html>.
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: { palette: paletteFor(m3Light) },
    dark: { palette: paletteFor(m3Dark) },
  },
  shape: { borderRadius: 12 },
  typography: m3Typography,
  transitions: m3Transitions,
  components,
});
