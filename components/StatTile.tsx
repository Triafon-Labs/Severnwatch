"use client";

import React from "react";
import { Box, Paper, Typography } from "@mui/material";

// A labelled figure: icon and label, the value in medium-weight body text,
// and an optional line beneath. The one tile for the rainfall gauges and
// period totals and the pollution risk's factors, so every "what is it, how
// much" reading on the page has the same shape. Paddlecheck's tile, kept
// identical so the two apps' readings look alike side by side.
export const tileSx = {
  p: 1.5,
  // Grid items default to `min-width: auto`, so a long value held the
  // column wider than its share on a narrow phone. Zero lets the track win
  // and the text wrap instead.
  minWidth: 0,
  backgroundColor: "surfaces.containerHigh",
} as const;

export const TileHeading: React.FC<{
  icon: React.ReactNode;
  label: string;
}> = ({ icon, label }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
    <Box
      sx={{
        display: "flex",
        color: "primary.main",
        "& svg": { fontSize: 20 },
      }}
    >
      {icon}
    </Box>
    <Typography variant="subtitle2" color="text.secondary">
      {label}
    </Typography>
  </Box>
);

export const TileValue: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Typography variant="body1" component="div" sx={{ mt: 0.5, fontWeight: 500 }}>
    {children}
  </Typography>
);

const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}> = ({ icon, label, value, detail }) => (
  <Paper elevation={0} sx={tileSx}>
    <TileHeading icon={icon} label={label} />
    <TileValue>{value}</TileValue>
    {detail && (
      <Typography variant="body2" color="text.secondary">
        {detail}
      </Typography>
    )}
  </Paper>
);

// Two columns, with an odd tile out taking the full last row rather than
// sitting half-width beside a gap.
export const tileGridSx = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 1,
  "& > *:last-of-type:nth-of-type(odd)": { gridColumn: "1 / -1" },
} as const;

export default StatTile;
