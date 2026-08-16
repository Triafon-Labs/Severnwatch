"use client";

import React from "react";
import { Paper, SxProps, Theme } from "@mui/material";
import { m3Spring, spring } from "@/lib/m3-palette";

interface InfoPanelProps {
  children: React.ReactNode;
  align?: "center" | "flex-start";
  // Renders the panel as a button carrying the M3 state layer and focus
  // indicator. The layer is drawn on a pseudo-element rather than by swapping
  // the background, so it composites over whatever fill the panel has instead
  // of replacing it.
  onClick?: () => void;
  ariaLabel?: string;
  sx?: SxProps<Theme>;
}

// Shared wrapper for the "icon + text on a muted background" panels used
// across the CSO and rainfall cards, so the same padding/spacing/background
// doesn't get hand-duplicated at each call site.
//
// The background is the tonal surfaceContainerHigh role, one step up from the
// card these sit inside. Reaching for `action.hover` instead - which several
// of these panels used to do - paints a resting panel in a state layer, the
// overlay M3 reserves for expressing interaction, so it reads as permanently
// hovered.
const InfoPanel: React.FC<InfoPanelProps> = ({
  children,
  align = "center",
  onClick,
  ariaLabel,
  sx,
}) => (
  <Paper
    elevation={0}
    {...(onClick && {
      component: "button" as const,
      type: "button" as const,
      onClick,
      "aria-label": ariaLabel,
    })}
    sx={{
      p: 1.5,
      display: "flex",
      alignItems: align,
      gap: 1,
      backgroundColor: "surfaces.containerHigh",
      ...(onClick && {
        width: "100%",
        border: "none",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
        position: "relative",
        // M3 state layer at 8% hover / 10% pressed, plus a focus indicator so
        // a keyboard user can see which panel they are on.
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          backgroundColor: "text.primary",
          opacity: 0,
          transition: spring("opacity", m3Spring.effectsFast),
          pointerEvents: "none",
        },
        "&:hover::after": { opacity: 0.08 },
        "&:active::after": { opacity: 0.1 },
        "&:focus-visible": {
          outline: "3px solid",
          outlineColor: "primary.main",
          outlineOffset: -3,
        },
      }),
      ...sx,
    }}
  >
    {children}
  </Paper>
);

export default InfoPanel;
