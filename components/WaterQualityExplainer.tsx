"use client";

import { useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { ClassificationTablesSection } from "@/components/WaterQualityInfoContent";

// The fuller write-up (what CSOs and EDM are, how citizen science sampling
// works) lives in the Info tab (SettingsDialog) - this stays focused on the
// one thing that's directly useful next to the map: what the classification
// bands actually mean.
const WaterQualityExplainer: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box>
      <Accordion
        expanded={expanded}
        onChange={(_, isExpanded) => setExpanded(isExpanded)}
        variant="outlined"
        sx={{ "&:before": { display: "none" } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">
            What do the water quality classifications mean?
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ClassificationTablesSection />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default WaterQualityExplainer;
