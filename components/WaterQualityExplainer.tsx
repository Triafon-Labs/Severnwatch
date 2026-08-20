"use client";

import { Box, Typography } from "@mui/material";
import { ClassificationTablesSection } from "@/components/WaterQualityInfoContent";

const WaterQualityExplainer: React.FC = () => {
  return (
    <Box sx={{ pt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
        What do the water quality classifications mean?
      </Typography>
      <ClassificationTablesSection />
    </Box>
  );
};

export default WaterQualityExplainer;
