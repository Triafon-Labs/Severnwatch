import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";
import { ON_STATUS_COLORS, STATUS_COLORS } from "@/lib/statusColors";

// Shared between the classification tables at the foot of the Sample
// History card and the fuller write-up in the Info tab of the settings
// sheet - kept in one place so the two stay in sync.

type Tier = "Excellent" | "Good" | "Sufficient" | "Poor";

interface ThresholdRow {
  tier: Tier;
  basis: string | null; // percentile the tier is judged on, e.g. "95th percentile"
  eColi: string;
  enterococci: string;
}

// Four tiers on the app's four-step status ramp, rather than on MUI's three
// severity colours. The previous mapping gave Excellent and Good the same
// green and separated them only by fill vs outline, which put the difference
// between the two best classifications entirely in a border - while Poor and
// Sufficient, which matter far more to a swimmer, were the only pair the eye
// could actually tell apart.
//
// Set through --chip-bg/--chip-fg rather than backgroundColor/color: the
// theme's dark-scheme chip rule is emitted under a `.dark` ancestor selector
// and would outrank a direct `sx` colour. See the MuiChip override in
// lib/themes.ts.
const TIER_COLOR: Record<Tier, keyof typeof STATUS_COLORS> = {
  Excellent: "darkGreen",
  Good: "lightGreen",
  Sufficient: "amber",
  Poor: "red",
};

const tierChipSx = (tier: Tier) => ({
  "--chip-bg": STATUS_COLORS[TIER_COLOR[tier]],
  "--chip-fg": ON_STATUS_COLORS[TIER_COLOR[tier]],
  fontWeight: 600,
});

export const INLAND_THRESHOLDS: ThresholdRow[] = [
  {
    tier: "Excellent",
    basis: "95th percentile",
    eColi: "< 500",
    enterococci: "< 200",
  },
  {
    tier: "Good",
    basis: "95th percentile",
    eColi: "< 1000",
    enterococci: "< 400",
  },
  {
    tier: "Sufficient",
    basis: "90th percentile",
    eColi: "< 900",
    enterococci: "< 330",
  },
  {
    tier: "Poor",
    basis: null,
    eColi: "worse than sufficient",
    enterococci: "worse than sufficient",
  },
];

export const ThresholdTable: React.FC<{ rows: ThresholdRow[] }> = ({
  rows,
}) => (
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
              {row.basis && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {row.basis}
                </Typography>
              )}
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
  { tier: "Excellent", basis: null, eColi: "< 500", enterococci: "< 200" },
  { tier: "Good", basis: null, eColi: "< 1000", enterococci: "< 400" },
  {
    tier: "Poor",
    basis: null,
    eColi: "≥ 1000",
    enterococci: "≥ 400",
  },
];

// What the limits mean in this app, then what they mean officially - the
// app reads a week at a time, and the official tables are a season-long
// statistic, so the two need telling apart wherever the limits are shown.
// Shared by the Sample History card and the Info tab's deep dive.
export const SampleLimitsSection: React.FC = () => (
  <>
    <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
      How a sample is graded here
    </Typography>
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ mt: 0.5, mb: 1.5 }}
    >
      Each weekly sample is checked on its own against the inland bathing water
      limits, and named after the tier whose limit it&apos;s under. It&apos;s a
      snapshot of the river that week, not a classification of the site. A
      sample is graded on whichever of E. coli or Enterococci is worse.
    </Typography>
    <ThresholdTable rows={SAMPLE_LIMITS} />

    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mt: 2.5 }}>
      The official classification
    </Typography>
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ mt: 0.5, mb: 1.5 }}
    >
      Regulators classify a designated bathing site once a year, from up to four
      bathing seasons of samples (normally at least 16). Excellent and Good are
      judged on the 95th percentile of the results and Sufficient on the 90th,
      so a classification reflects the worst few samples across the seasons
      rather than any one week. That&apos;s why Sufficient&apos;s limits sit
      below Good&apos;s, and why a single sample is never graded Sufficient.
      Grandstand Road isn&apos;t a designated bathing water, so it has no
      official classification.
    </Typography>
    <ClassificationTablesSection />
  </>
);

export const ClassificationTablesSection: React.FC = () => (
  <>
    <ThresholdTable rows={INLAND_THRESHOLDS} />

    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mt: 1.5 }}
    >
      Values are colony-forming units per 100ml for inland waters under the
      Bathing Water Regulations 2013. A site&apos;s overall classification is
      whichever of E. coli or Enterococci comes out lower.
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

    <Box sx={{ mt: 2 }}>
      <SampleLimitsSection />
    </Box>

    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mt: 1.5 }}
    >
      Source: Surfers Against Sewage, Explainer: Bathing Water Classifications.
    </Typography>
  </>
);
