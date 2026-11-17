"use client";

import { useEffect, useRef, useState } from "react";
import { Box, SxProps, Theme } from "@mui/material";
import { m3Duration, m3Easing } from "@/lib/m3-palette";

interface Props {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

// Eases a block to its content's height whenever the content changes - a
// sample stepped, a view switched - instead of snapping, so whatever sits
// below glides rather than jumps. Paddlecheck's forecast hour card, with the
// same duration and curve.
//
// The first measurement lands on a block already at its natural height, so
// nothing animates on load. It clips while it moves, so a taller content's
// last lines never spill past a block still growing to fit them, and stops
// clipping once it has settled - focus rings and the scatter's dots can sit
// over its edge.
export const EasedHeight: React.FC<Props> = ({ children, sx }) => {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const observer = new ResizeObserver(() => {
      const h = inner.offsetHeight;
      if (lastRef.current !== null && lastRef.current !== h) setMoving(true);
      lastRef.current = h;
      setHeight(h);
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === "height") {
          setMoving(false);
        }
      }}
      sx={[
        {
          height: height ?? "auto",
          overflow: moving ? "hidden" : "visible",
          transition: `height ${m3Duration.medium1}ms ${m3Easing.standard}`,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box ref={innerRef}>{children}</Box>
    </Box>
  );
};

// Holds the tallest height its content has reached, so the page never gets
// shorter under the reader when the content does. For the bottom card: a
// page that shrinks while you're scrolled to its end drags everything down
// the screen, the toggle you just pressed with it. Paddlecheck's forecast
// panel reserves its busiest hour's height for the same reason, and the
// space a shorter view leaves shows as page background below the card.
//
// Starts again from the current height when the width changes (a rotated
// phone), since every height before it was for a different layout.
export const ReservedHeight: React.FC<Props> = ({ children, sx }) => {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [reserved, setReserved] = useState<number | null>(null);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    let width = -1;
    let tallest = 0;
    const observer = new ResizeObserver(() => {
      const w = inner.offsetWidth;
      const h = inner.offsetHeight;
      if (w !== width) {
        width = w;
        tallest = h;
      } else {
        tallest = Math.max(tallest, h);
      }
      setReserved(tallest);
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      sx={[
        { minHeight: reserved ?? undefined },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box ref={innerRef}>{children}</Box>
    </Box>
  );
};
