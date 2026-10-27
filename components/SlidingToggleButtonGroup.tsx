"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { Box, ToggleButtonGroup, ToggleButtonGroupProps } from "@mui/material";
import { m3Spring, spring } from "@/lib/m3-palette";

// Matches the MuiToggleButtonGroup theme override in lib/themes.ts (padding: 4).
const GROUP_PADDING = 4;

interface PillRect {
  left: number;
  width: number;
}

// Drop-in replacement for MUI's ToggleButtonGroup that adds a sliding pill
// behind the selected button, instead of the selected button's background
// just flipping on instantly. Used anywhere a segmented control picks one
// of several options (theme, rainfall time range).
const SlidingToggleButtonGroup = React.forwardRef<
  HTMLDivElement,
  ToggleButtonGroupProps
>(({ value, children, sx, ...props }, forwardedRef) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<PillRect | null>(null);

  const measure = () => {
    const container = containerRef.current;
    const selected = container?.querySelector<HTMLElement>(".Mui-selected");
    setPill(
      selected
        ? { left: selected.offsetLeft, width: selected.offsetWidth }
        : null
    );
  };

  // Re-measure whenever the selection or the number of buttons changes. Keyed
  // on the count rather than `children` itself, which is a new object on
  // every parent render: that re-measured - forcing a layout of the whole
  // page - each time the rainfall chart re-rendered for anything. Size
  // changes are the ResizeObserver's below. queueMicrotask still runs before
  // paint, it just satisfies the lint rule against calling setState
  // synchronously in an effect body.
  const buttonCount = React.Children.count(children);
  useLayoutEffect(() => {
    queueMicrotask(measure);
  }, [value, buttonCount]);

  // Buttons are usually fullWidth, so their positions shift on container
  // resize (window resize, orientation change) without `value` changing.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <ToggleButtonGroup
      ref={(node: HTMLDivElement | null) => {
        containerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      value={value}
      sx={{
        position: "relative",
        // The pill is the only thing providing the selected background now
        // (see the pill Box below) - without this the button's own flat
        // background would still hard-cut instead of sliding.
        "& .MuiToggleButton-root.Mui-selected": {
          backgroundColor: "transparent !important",
          "&:hover": { backgroundColor: "transparent !important" },
        },
        ...sx,
      }}
      {...props}
    >
      {pill && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            top: GROUP_PADDING,
            bottom: GROUP_PADDING,
            left: 0,
            borderRadius: 9999,
            bgcolor: "primary.main",
            // translateX is GPU-composited, unlike `left`/`width` (both
            // layout-triggering) - those look fine at 60Hz but visibly
            // stutter on high-refresh displays, since redoing layout on
            // every frame doesn't fit in an 8ms budget at 120Hz+. Width is
            // still set directly (not transitioned): every current usage
            // has equal-width segments, so it's only ever set once and
            // never actually animates - only position needs to slide.
            //
            // The pill is the most-touched moving part in the app, so it
            // gets M3 Expressive's fast spatial spring: it arrives with a
            // small overshoot and settles, rather than easing to a dead stop.
            transition: spring("transform", m3Spring.spatialFast),
            willChange: "transform",
            pointerEvents: "none",
            zIndex: 0,
          }}
          style={{
            width: pill.width,
            transform: `translateX(${pill.left}px)`,
          }}
        />
      )}
      {children}
    </ToggleButtonGroup>
  );
});

SlidingToggleButtonGroup.displayName = "SlidingToggleButtonGroup";

export default SlidingToggleButtonGroup;
