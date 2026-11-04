"use client";

import { Chip } from "@mui/material";
import { SAMPLE_BAND_UI, SampleBand } from "@/lib/waterQuality";

// A sample's band in its status colour. Set through --chip-bg/--chip-fg
// rather than backgroundColor/color, for the same reason as the
// classification tier chips: the theme's dark-scheme chip rule outranks a
// direct `sx` colour (see the MuiChip override in lib/themes.ts).
const SampleBandChip: React.FC<{ band: SampleBand }> = ({ band }) => (
  <Chip
    label={SAMPLE_BAND_UI[band].label}
    size="small"
    sx={{
      "--chip-bg": SAMPLE_BAND_UI[band].color,
      "--chip-fg": SAMPLE_BAND_UI[band].onColor,
      fontWeight: 600,
    }}
  />
);

export default SampleBandChip;
