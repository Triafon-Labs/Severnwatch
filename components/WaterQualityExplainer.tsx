"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

interface ThresholdRow {
  classification: string;
  eColi: string;
  enterococci: string;
}

const INLAND_THRESHOLDS: ThresholdRow[] = [
  { classification: "Excellent (95th percentile)", eColi: "< 500", enterococci: "< 200" },
  { classification: "Good (95th percentile)", eColi: "< 1000", enterococci: "< 400" },
  { classification: "Sufficient (90th percentile)", eColi: "< 900", enterococci: "< 330" },
  { classification: "Poor", eColi: "worse than sufficient", enterococci: "worse than sufficient" },
];

const COASTAL_THRESHOLDS: ThresholdRow[] = [
  { classification: "Excellent (95th percentile)", eColi: "< 250", enterococci: "< 100" },
  { classification: "Good (95th percentile)", eColi: "< 500", enterococci: "< 200" },
  { classification: "Sufficient (90th percentile)", eColi: "< 500", enterococci: "< 185" },
  { classification: "Poor", eColi: "worse than sufficient", enterococci: "worse than sufficient" },
];

const ThresholdTable: React.FC<{ rows: ThresholdRow[] }> = ({ rows }) => (
  <TableContainer>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Classification</TableCell>
          <TableCell>E. coli (CFU/100mL)</TableCell>
          <TableCell>Intestinal Enterococci (CFU/100mL)</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.classification}>
            <TableCell>{row.classification}</TableCell>
            <TableCell>{row.eColi}</TableCell>
            <TableCell>{row.enterococci}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const WaterQualityExplainer: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box>
      {/* Always visible - deliberately not hidden behind the collapse below,
          since it qualifies what the map is (and isn't) showing. */}
      <Alert
        icon={<InfoOutlinedIcon fontSize="small" />}
        severity="info"
        variant="outlined"
        sx={{ borderRadius: 1, mb: 1.5 }}
      >
        Storm overflow monitoring indicates a spill was detected - it
        isn&apos;t confirmed lab contamination, and it doesn&apos;t cover
        every outfall. Water quality here can also be affected by
        agricultural runoff, misconnections, and other unmonitored sources.
      </Alert>

      <Accordion
        expanded={expanded}
        onChange={(_, isExpanded) => setExpanded(isExpanded)}
        variant="outlined"
        sx={{ "&:before": { display: "none" } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">
            How sewage spills and water quality classifications work
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", mt: 1 }}>
            Combined sewer overflows
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Much of the UK&apos;s sewer network carries rainwater and
            wastewater in the same pipe. During heavy rain, water companies
            are permitted to release the excess - diluted with rainwater -
            directly into rivers through combined sewer overflows (CSOs),
            rather than let it back up into homes and streets.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: "bold", mt: 2 }}>
            Event Duration Monitoring (EDM)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Water companies fit CSOs with monitors that record when a
            discharge starts and stops - this is what powers the sewage spill
            status above. It&apos;s a near-real-time indicator, but the data
            isn&apos;t validated before it appears, monitors can false-alert
            on debris, and not every outfall is monitored.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: "bold", mt: 2 }}>
            What the citizen science bacteria counts mean
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
            Official bathing water classifications are based on 10-20 weekly
            samples taken across a bathing season, measuring E. coli and
            intestinal Enterococci (both in colony-forming units per 100mL).
            &quot;Excellent&quot; and &quot;Good&quot; use the 95th
            percentile of results; &quot;Sufficient&quot; uses the 90th
            percentile - only the worst 5-10% of samples count, since the
            aim is to flag the realistic risk of high contamination, not the
            average. A site&apos;s overall classification is whichever of
            the two measures (E. coli or Enterococci) comes out lower.
          </Typography>

          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
            Inland waters (this applies to the Severn at Worcester)
          </Typography>
          <ThresholdTable rows={INLAND_THRESHOLDS} />

          <Typography variant="body2" sx={{ fontWeight: 500, mt: 2, mb: 1 }}>
            Coastal and transitional waters (shown for comparison)
          </Typography>
          <ThresholdTable rows={COASTAL_THRESHOLDS} />

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            Inland waters are allowed higher bacteria counts than coastal
            ones under the Bathing Water Regulations 2013 - so a result that
            would count as &quot;Good&quot; here might be
            &quot;Sufficient&quot; or &quot;Poor&quot; at the coast.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Source: Surfers Against Sewage, Explainer: Bathing Water
            Classifications.
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default WaterQualityExplainer;
