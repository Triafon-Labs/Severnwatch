import {
  Box,
  Chip,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";
import { ON_STATUS_COLORS, STATUS_COLORS } from "@/lib/statusColors";
import { EA_CLASSIFICATIONS_URL, SAS_CLASSIFICATIONS_URL } from "@/lib/config";

// Shared between "How Limits Work" at the foot of the Sample History card and
// the deep dive in the settings sheet's Info tab, so the two stay in sync.

type Tier = "Excellent" | "Good" | "Poor";

interface ThresholdRow {
  tier: Tier;
  eColi: string;
  enterococci: string;
}

// The tiers on the app's status ramp, matching SAMPLE_BAND_UI in
// lib/waterQuality.ts, so these chips read the same as the sample chips.
// Excellent and Good get distinct greens rather than one green told apart by
// fill vs outline, which put the difference between them in a border.
//
// Set through --chip-bg/--chip-fg rather than backgroundColor/color: the
// theme's dark-scheme chip rule is emitted under a `.dark` ancestor selector
// and would outrank a direct `sx` colour. See the MuiChip override in
// lib/themes.ts.
const TIER_COLOR: Record<Tier, keyof typeof STATUS_COLORS> = {
  Excellent: "darkGreen",
  Good: "lightGreen",
  Poor: "red",
};

const tierChipSx = (tier: Tier) => ({
  "--chip-bg": STATUS_COLORS[TIER_COLOR[tier]],
  "--chip-fg": ON_STATUS_COLORS[TIER_COLOR[tier]],
  fontWeight: 600,
});

const ThresholdTable: React.FC<{ rows: ThresholdRow[] }> = ({ rows }) => (
  <TableContainer>
    <Table size="small">
      <TableBody>
        {rows.map((row, idx) => (
          <TableRow
            key={row.tier}
            sx={{
              // A tonal surface step, not `action.hover` - that's the state
              // layer M3 reserves for interaction, so every other row read as
              // permanently hovered.
              bgcolor: idx % 2 === 1 ? "surfaces.containerHigh" : "transparent",
              "& td": { borderBottom: idx === rows.length - 1 ? 0 : undefined },
            }}
          >
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Chip label={row.tier} size="small" sx={tierChipSx(row.tier)} />
            </TableCell>
            <TableCell>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block" }}
              >
                E. coli
              </Typography>
              {row.eColi}
            </TableCell>
            <TableCell>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block" }}
              >
                Enterococci
              </Typography>
              {row.enterococci}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

// How the app grades one sample: against the same limits, named after the
// tier whose limit it's under. Three rows rather than four, because
// Sufficient's limits sit inside Good's (they're a 90th percentile, not a
// 95th), so on one number there's no range that's Sufficient.
const SAMPLE_LIMITS: ThresholdRow[] = [
  { tier: "Excellent", eColi: "< 500", enterococci: "< 200" },
  { tier: "Good", eColi: "< 1000", enterococci: "< 400" },
  { tier: "Poor", eColi: "≥ 1000", enterococci: "≥ 400" },
];

const SourceLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <Link href={href} target="_blank" rel="noopener noreferrer" color="inherit">
    {children}
  </Link>
);

// How the app grades a week, kept short: the official season-long
// classification is linked out to rather than re-explained, since the app
// never shows one. Shared by the Sample History card and the Info tab.
export const SampleLimitsSection: React.FC = () => (
  <>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      Each sample is graded on its own against the inland bathing water limits,
      on whichever of E. coli or Enterococci is worse. It&apos;s a snapshot of
      that week, not an official classification.
    </Typography>
    <ThresholdTable rows={SAMPLE_LIMITS} />
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mt: 1.5 }}
    >
      Official classifications cover designated bathing waters only - which
      Grandstand Road isn&apos;t - and are worked out from several seasons of
      samples. More from{" "}
      <SourceLink href={SAS_CLASSIFICATIONS_URL}>
        Surfers Against Sewage
      </SourceLink>{" "}
      and the{" "}
      <SourceLink href={EA_CLASSIFICATIONS_URL}>Environment Agency</SourceLink>.
    </Typography>
  </>
);

export const WaterQualityDeepDive: React.FC = () => (
  <>
    <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
      Combined sewer overflows
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
      Much of the UK&apos;s sewer network carries rainwater and wastewater in
      the same pipe. During heavy rain, water companies are permitted to release
      the excess - diluted with rainwater - directly into rivers through
      combined sewer overflows (CSOs), rather than let it back up into homes and
      streets.
    </Typography>

    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mt: 2 }}>
      Event Duration Monitoring (EDM)
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
      Water companies fit CSOs with monitors that record when a discharge starts
      and stops - this is what powers the sewage spill status on the home
      screen. It&apos;s a near-real-time indicator, but the data isn&apos;t
      validated before it appears, monitors can false-alert on debris, and not
      every outfall is monitored.
    </Typography>

    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mt: 2 }}>
      How samples are graded
    </Typography>
    <Box sx={{ mt: 0.5 }}>
      <SampleLimitsSection />
    </Box>
  </>
);
