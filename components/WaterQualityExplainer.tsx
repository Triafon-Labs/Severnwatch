"use client";

import { Box, Typography } from "@mui/material";
import { ClassificationTablesSection } from "@/components/WaterQualityInfoContent";

const WaterQualityExplainer: React.FC = () => {
  return (
    <Box sx={{ pt: 2 }}>
      {/* Same section-heading style as Paddlecheck's in-card headings
          ("Contributing Factors", "Be Aware"): subtitle2 in text.secondary
          with an 8px step to what it heads, rather than a bolded
          primary-colour label. */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        What do the water quality classifications mean?
      </Typography>
      <ClassificationTablesSection />
    </Box>
  );
};

export default WaterQualityExplainer;
