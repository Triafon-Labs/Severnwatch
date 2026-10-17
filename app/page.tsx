import { Container, Stack } from "@mui/material";
import PollutionRiskCard from "@/components/PollutionRiskCard";
import CsoListCard from "@/components/CsoListCard";
import RainfallCard from "@/components/RainfallCard";
import WaterQualityMap from "@/components/WaterQualityMap";

export default function HomePage() {
  return (
    // 16px between cards, against the 24px inset the theme gives CardContent -
    // M3 wants the inset larger than the gap so the card edge is legible as a
    // boundary. The page used to sit at 32, which read as four unrelated
    // panels rather than one dashboard.
    <Container maxWidth="md" sx={{ px: 2 }}>
      <Stack spacing={2}>
        <PollutionRiskCard />
        <CsoListCard />
        <RainfallCard />
        <WaterQualityMap />
      </Stack>
    </Container>
  );
}
