import { Container, Stack } from "@mui/material";
import CsoSpillCard from "@/components/CsoSpillCard";
import CsoListCard from "@/components/CsoListCard";
import RainfallCard from "@/components/RainfallCard";
import WaterQualityMap from "@/components/WaterQualityMap";
import WaterQualityExplainer from "@/components/WaterQualityExplainer";

export default function HomePage() {
  return (
    <Container maxWidth="md">
      <Stack spacing={4}>
        <CsoSpillCard />
        <CsoListCard />
        <RainfallCard />
        <Stack spacing={1.5}>
          <WaterQualityMap />
          <WaterQualityExplainer />
        </Stack>
      </Stack>
    </Container>
  );
}
