import { Container, Stack, Typography } from "@mui/material";
import WaterQualityMap from "@/components/WaterQualityMap";

export default function HomePage() {
  return (
    <Container maxWidth="md">
      <Stack spacing={4}>
        <Typography variant="body1" color="text.secondary">
          River Severn conditions at Worcester - sewage spill status, rainfall,
          and citizen science water quality.
        </Typography>
        <WaterQualityMap />
      </Stack>
    </Container>
  );
}
