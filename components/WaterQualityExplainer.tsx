"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { ClassificationTablesSection } from "@/components/WaterQualityInfoContent";

// The fuller write-up (what CSOs and EDM are, how citizen science sampling
// works) lives in the Info tab of the settings sheet - this stays focused on
// the one thing that's directly useful next to the map: what the
// classification bands actually mean.
//
// Rendered inside the map card (see WaterQualityMap), so the negative margin
// pulls the summary row out to the card's inner edge and its own padding puts
// the label back in line with the heading above it.
const WaterQualityExplainer: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      disableGutters
      elevation={0}
      sx={{ "&:before": { display: "none" }, mx: -1 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 1 }}>
        <Typography variant="subtitle2">
          What do the water quality classifications mean?
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 1, pt: 0 }}>
        <ClassificationTablesSection />
      </AccordionDetails>
    </Accordion>
  );
};

export default WaterQualityExplainer;
