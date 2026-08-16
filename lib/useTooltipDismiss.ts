"use client";

import { RefObject, useCallback, useEffect, useState } from "react";

/**
 * Closes a recharts tooltip when the reader presses somewhere else.
 *
 * Recharts only clears a tooltip when the pointer *leaves* the chart, and a
 * touchscreen never sends that event: tapping the graph opens the tooltip and
 * tapping anywhere else on the page leaves it hanging over the chart until the
 * graph happens to be touched again. This watches for a press outside
 * `containerRef` and forces the tooltip shut, then hands control straight back
 * to recharts as soon as the chart itself is being touched or hovered.
 *
 * `tooltipActive` is `undefined` rather than `true` when nothing has been
 * dismissed: recharts reads `active={true}` as "pinned open" and only consults
 * its own hover state when the prop is absent.
 */
export const useTooltipDismiss = (
  containerRef: RefObject<HTMLElement | null>
) => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      if (!container.contains(event.target as Node)) {
        setDismissed(true);
      }
    };
    // Capture phase, so a press on something that stops propagation - a
    // button, a card that swallows the event - still closes the tooltip.
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [containerRef]);

  // Recharts' own move handling is what picks the point under the finger, so
  // un-dismissing on move rather than on press means the tooltip can't flash
  // at the previously-read point on the way back in. A tap sends a synthetic
  // mousemove before its mousedown, so this covers taps as well as drags.
  const handleChartMove = useCallback(() => setDismissed(false), []);

  return {
    tooltipActive: dismissed ? false : undefined,
    chartMoveProps: {
      onMouseMove: handleChartMove,
      onTouchMove: handleChartMove,
    },
  };
};
