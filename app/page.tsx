import { Container, Stack, Typography } from "@mui/material";
import CsoSpillCard from "@/components/CsoSpillCard";

export default function HomePage() {
  return (
    <Container maxWidth="md">
      <Stack spacing={4}>
        <Typography variant="body1" color="text.secondary">
          River Severn conditions at Worcester - sewage spill status, rainfall,
          and citizen science water quality.
        </Typography>
        <CsoSpillCard />
      </Stack>
    </Container>
  );
}
