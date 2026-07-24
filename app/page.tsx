import { Container, Stack, Typography } from "@mui/material";
import RainfallCard from "@/components/RainfallCard";
import WaterQualityMap from "@/components/WaterQualityMap";
import WaterQualityExplainer from "@/components/WaterQualityExplainer";

export default function HomePage() {
  return (
    <Container maxWidth="md">
      <Stack spacing={4}>
        <Typography variant="body1" color="text.secondary">
          River Severn conditions at Worcester - sewage spill status, rainfall,
          and citizen science water quality.
        </Typography>
        <RainfallCard />
        <Stack spacing={1.5}>
          <WaterQualityMap />
          <WaterQualityExplainer />
        </Stack>
      </Stack>
    </Container>
  );
}
