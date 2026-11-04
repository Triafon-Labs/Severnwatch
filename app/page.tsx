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
    // The live feeds first, then the citizen science testing: the newest
    // sample, and the site's full history last, as the deepest read on the
    // page.
    <Container maxWidth="md" sx={{ px: 2 }}>
      <Stack spacing={2}>
        <PollutionRiskCard />
        <CsoListCard />
        <RainfallCard />
        <LatestSampleCard />
        <SampleHistoryCard />
      </Stack>
    </Container>
  );
}
