import { Chip, ChipProps, Table, TableBody, TableCell, TableContainer, TableRow, Typography } from "@mui/material";

// Shared between the always-visible classification tables under the water
// quality map (WaterQualityExplainer) and the fuller write-up in the Info
// tab (SettingsDialog) - kept in one place so the two stay in sync.

type Tier = "Excellent" | "Good" | "Sufficient" | "Poor";

interface ThresholdRow {
  tier: Tier;
  basis: string | null; // percentile the tier is judged on, e.g. "95th percentile"
  eColi: string;
  enterococci: string;
}

const TIER_STYLE: Record<Tier, { color: ChipProps["color"]; variant: ChipProps["variant"] }> = {
  Excellent: { color: "success", variant: "filled" },
  Good: { color: "success", variant: "outlined" },
  Sufficient: { color: "warning", variant: "filled" },
  Poor: { color: "error", variant: "filled" },
};

export const INLAND_THRESHOLDS: ThresholdRow[] = [
  { tier: "Excellent", basis: "95th percentile", eColi: "< 500", enterococci: "< 200" },
  { tier: "Good", basis: "95th percentile", eColi: "< 1000", enterococci: "< 400" },
  { tier: "Sufficient", basis: "90th percentile", eColi: "< 900", enterococci: "< 330" },
  { tier: "Poor", basis: null, eColi: "worse than sufficient", enterococci: "worse than sufficient" },
];

export const COASTAL_THRESHOLDS: ThresholdRow[] = [
  { tier: "Excellent", basis: "95th percentile", eColi: "< 250", enterococci: "< 100" },
  { tier: "Good", basis: "95th percentile", eColi: "< 500", enterococci: "< 200" },
  { tier: "Sufficient", basis: "90th percentile", eColi: "< 500", enterococci: "< 185" },
  { tier: "Poor", basis: null, eColi: "worse than sufficient", enterococci: "worse than sufficient" },
];

export const ThresholdTable: React.FC<{ rows: ThresholdRow[] }> = ({ rows }) => (
  <TableContainer>
    <Table size="small">
      <TableBody>
        {rows.map((row, idx) => (
          <TableRow
            key={row.tier}
            sx={{
              bgcolor: idx % 2 === 1 ? "action.hover" : "transparent",
              "& td": { borderBottom: idx === rows.length - 1 ? 0 : undefined },
            }}
          >
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Chip
                label={row.tier}
                color={TIER_STYLE[row.tier].color}
                variant={TIER_STYLE[row.tier].variant}
                size="small"
                sx={{ fontWeight: 600 }}
              />
              {row.basis && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  {row.basis}
                </Typography>
              )}
            </TableCell>
            <TableCell>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                E. coli
              </Typography>
              {row.eColi}
            </TableCell>
            <TableCell>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
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
    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
      Inland waters (this applies to the Severn at Worcester)
    </Typography>
    <ThresholdTable rows={INLAND_THRESHOLDS} />

    <Typography variant="body2" sx={{ fontWeight: 500, mt: 2, mb: 1 }}>
      Coastal and transitional waters (shown for comparison)
    </Typography>
    <ThresholdTable rows={COASTAL_THRESHOLDS} />

    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
      Values are colony-forming units per 100mL. Inland waters are allowed
      higher bacteria counts than coastal ones under the Bathing Water
      Regulations 2013 - so a result that would count as &quot;Good&quot;
      here might be &quot;Sufficient&quot; or &quot;Poor&quot; at the coast.
      A site&apos;s overall classification is whichever of E. coli or
      Enterococci comes out lower.
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
      the same pipe. During heavy rain, water companies are permitted to
      release the excess - diluted with rainwater - directly into rivers
      through combined sewer overflows (CSOs), rather than let it back up
      into homes and streets.
    </Typography>

    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mt: 2 }}>
      Event Duration Monitoring (EDM)
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
      Water companies fit CSOs with monitors that record when a discharge
      starts and stops - this is what powers the sewage spill status on the
      home screen. It&apos;s a near-real-time indicator, but the data isn&apos;t
      validated before it appears, monitors can false-alert on debris, and
      not every outfall is monitored.
    </Typography>

    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mt: 2 }}>
      What the citizen science bacteria counts mean
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
      Official bathing water classifications are based on 10-20 weekly
      samples taken across a bathing season, measuring E. coli and
      intestinal Enterococci. &quot;Excellent&quot; and &quot;Good&quot; use
      the 95th percentile of results; &quot;Sufficient&quot; uses the 90th
      percentile - only the worst 5-10% of samples count, since the aim is
      to flag the realistic risk of high contamination, not the average.
    </Typography>

    <ClassificationTablesSection />

    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
      Source: Surfers Against Sewage, Explainer: Bathing Water
      Classifications.
    </Typography>
  </>
);
