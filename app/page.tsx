import { Container, Stack } from "@mui/material";
import PollutionRiskCard from "@/components/PollutionRiskCard";
import CsoListCard from "@/components/CsoListCard";
import RainfallCard from "@/components/RainfallCard";
import LatestSampleCard from "@/components/LatestSampleCard";
import SampleHistoryCard from "@/components/SampleHistoryCard";

export default function HomePage() {
  return (
    // 16px between cards, against the 24px inset the theme gives CardContent -
    // M3 wants the inset larger than the gap so the card edge is legible as a
    // boundary. The page used to sit at 32, which read as four unrelated
    // panels rather than one dashboard.
    //
    // Effect first, then its causes: the headline risk, what the water
    // actually measured, the spills that are the main live cause, then the
    // rain that drives them - so each card explains the one above it, and the
    // risk card's spill and rain factors point at two cards that sit
    // together. The sample history is the deepest read, so it goes last.
    //
    // Kept fixed rather than reordered by the data (e.g. dropping a stale
    // sample down the page): cards that move around are harder to find than
    // any one order is to read. A stale sample says so on its own card.
    <Container maxWidth="md" sx={{ px: 2 }}>
      <Stack spacing={2}>
        <PollutionRiskCard />
        <LatestSampleCard />
        <CsoListCard />
        <RainfallCard />
        <SampleHistoryCard />
      </Stack>
    </Container>
  );
}
