import {
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

    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mt: 2 }}>
      What the citizen science bacteria counts mean
    </Typography>
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ mt: 0.5, mb: 1.5 }}
    >
      Official bathing water classifications are based on samples from up to
      four bathing seasons (normally at least 16, and at least four in each
      season), measuring E. coli and intestinal Enterococci. A newly designated
      site is classified on the seasons it has so far. &quot;Excellent&quot; and
      &quot;Good&quot; use the 95th percentile of results;
      &quot;Sufficient&quot; uses the 90th percentile - only the worst 5-10% of
      samples count, since the aim is to flag the realistic risk of high
      contamination, not the average.
    </Typography>

    <ClassificationTablesSection />

    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mt: 1.5 }}
    >
      Source: Surfers Against Sewage, Explainer: Bathing Water Classifications.
    </Typography>
  </>
);
