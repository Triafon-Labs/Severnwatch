// Chart entrances in CSS rather than recharts' own animation.
//
// Recharts animates by re-rendering the chart through React every frame and
// recomputing each point, which holds a chart near 30 fps on a phone-speed
// CPU. Paddlecheck moved its graphs to CSS for that reason, and the rainfall
// chart takes the same motion from here: its lines are revealed left to right
// by an animated clip, which the browser runs without any script per frame.
//
// The reveal replays whenever the element mounts, so a chart that should
// animate again (a new range) is keyed to remount; a re-render with the same
// key - a refetch, a theme change - leaves it still. Durations collapse under
// prefers-reduced-motion through the theme's global override.
//
// Paddlecheck's copy also carries barGrowSx, for its bar charts; nothing here
// draws bars, so only the reveal is ported.

// Reveals an element left to right by clipping it. The clip is over the
// element's own box, padded so a stroke's width and round caps aren't shaved
// off at the edges once it's fully shown.
export const revealSx = (
  selector: string,
  durationMs: number,
  easing: string,
  delayMs = 0
) => ({
  [`& ${selector}`]: {
    animation: `chartReveal ${durationMs}ms ${easing} ${delayMs}ms both`,
  },
  "@keyframes chartReveal": {
    from: { clipPath: "inset(-8px 100% -8px -8px)" },
    to: { clipPath: "inset(-8px -8px -8px -8px)" },
  },
});
