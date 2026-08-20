"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { RainfallGaugeData } from "@/types";
import { STATUS_COLORS } from "@/lib/statusColors";
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  HOUR_MS,
  SpillLikelihood,
  assessRainfallLikelihood,
  calculateForecast24hTotal,
  findForecastRiskWindows,
  sumRecentMm,
} from "@/lib/rainfallAnalysis";
import { RainfallForecastPoint } from "@/types";
import InfoPanel from "@/components/InfoPanel";
import RainfallChart from "@/components/RainfallChart";

const GaugeStat: React.FC<{
  label: string;
  latestMm: number | null;
  last24hTotalMm: number;
}> = ({ label, latestMm, last24hTotalMm }) => (
  <Stack spacing={0.25} sx={{ minWidth: 140 }}>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h6" component="p">
      {last24hTotalMm} mm
      <Typography
        component="span"
        variant="caption"
        color="text.secondary"
        sx={{ ml: 0.5 }}
      >
        last 24h
      </Typography>
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {latestMm !== null
        ? `${latestMm} mm in the last 15 min`
        : "no recent reading"}
    </Typography>
  </Stack>
);

// Worst (highest) reading across the catchment's gauges - the number that
// actually matters for "could this cause a spill nearby", not an average
// that dilutes a burst at one station with calm at the others.
const maxAcrossGauges = (
  gauges: RainfallGaugeData[],
  value: (g: RainfallGaugeData) => number
): number => Math.max(...gauges.map(value));

const PeriodTile: React.FC<{ label: string; totalMm: number }> = ({
  label,
  totalMm,
}) => (
  <InfoPanel
    align="flex-start"
    sx={{ flexDirection: "column", gap: 0.5, height: "100%" }}
  >
    <Stack direction="row" spacing={0.5} alignItems="center">
      <RestoreIcon sx={{ fontSize: 16, color: "text.secondary" }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
    <Typography variant="h6" component="p">
      {totalMm} mm
    </Typography>
  </InfoPanel>
);

const ForecastTile: React.FC<{
  totalMm: number | null;
  forecast: RainfallForecastPoint[];
}> = ({ totalMm, forecast }) => {
  const riskWindows = findForecastRiskWindows(forecast);

  return (
    <InfoPanel
      align="flex-start"
      sx={{ flexDirection: "column", gap: 0.5, height: "100%" }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <ScheduleIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="caption" color="text.secondary">
          24h Forecast Total
        </Typography>
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ flexWrap: "wrap", rowGap: 0.5 }}
      >
        <Typography variant="h6" component="p">
          {totalMm !== null ? `${totalMm} mm` : "—"}
        </Typography>
        {riskWindows.map((w) => (
          <Chip
            key={w.label}
            label={w.label}
            size="small"
            color={w.riskLevel === "high" ? "error" : "warning"}
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: "0.75rem" }}
          />
        ))}
      </Stack>
    </InfoPanel>
  );
};

const LIKELIHOOD_STYLE: Record<
  SpillLikelihood,
  {
    role: "success" | "warning" | "error";
    accent: string;
    icon: React.ReactNode;
    description: string;
  }
> = {
  Low: {
    role: "success",
    accent: STATUS_COLORS.darkGreen,
    icon: <CheckCircleOutlineIcon />,
    description: "Rainfall doesn't currently suggest an elevated spill risk.",
  },
  Medium: {
    role: "warning",
    accent: STATUS_COLORS.amber,
    icon: <WarningAmberIcon />,
    description:
      "Sustained rain across the catchment - a spill is more plausible than usual.",
  },
  High: {
    role: "error",
    accent: STATUS_COLORS.red,
    icon: <ReportProblemIcon />,
    description:
      "Heavy, thunderstorm-level rainfall in the catchment - a spill is more likely.",
  },
};

const LikelihoodPanel: React.FC<{ likelihood: SpillLikelihood }> = ({
  likelihood,
}) => {
  const style = LIKELIHOOD_STYLE[likelihood];
  return (
    <InfoPanel
      align="flex-start"
      sx={{
        bgcolor: `${style.role}.container`,
        color: `${style.role}.onContainer`,
        borderLeft: "4px solid",
        borderColor: style.accent,
      }}
    >
      <Box sx={{ color: style.accent, display: "flex", flexShrink: 0 }}>
        {style.icon}
      </Box>
      <Stack spacing={0.25}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Rainfall-based spill likelihood: {likelihood}
        </Typography>
        <Typography variant="body2">{style.description}</Typography>
      </Stack>
    </InfoPanel>
  );
};

const RainfallCard: React.FC = () => {
  const { rainfall, rainfallError, loading } = useSevernContext();
  const gauges = rainfall?.gauges ?? [];
  const showSkeleton = loading && !rainfall;

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Rainfall
        </Typography>

        {showSkeleton && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={72} />
            <Skeleton variant="rounded" height={220} />
          </Stack>
        )}

        {!showSkeleton && rainfallError && !rainfall && (
          <InfoPanel align="flex-start">
            <CloudOffIcon color="warning" sx={{ flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              Couldn&apos;t load rainfall data right now. It&apos;ll retry on
              the next refresh.
            </Typography>
          </InfoPanel>
        )}

        {!showSkeleton && rainfall && gauges.length > 0 && (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              {gauges.map((gauge) => (
                <Grid key={gauge.id} size={{ xs: 12, sm: 4 }}>
                  <GaugeStat
                    label={gauge.label}
                    latestMm={gauge.latestMm}
                    last24hTotalMm={gauge.last24hTotalMm}
                  />
                </Grid>
              ))}
            </Grid>

            <Divider />

            <RainfallChart gauges={gauges} forecast={rainfall.forecast} />

            <Grid container spacing={1.5}>
              <Grid size={6}>
                <PeriodTile
                  label="Past 1 Hour"
                  totalMm={maxAcrossGauges(gauges, (g) =>
                    sumRecentMm(g, HOUR_MS)
                  )}
                />
              </Grid>
              <Grid size={6}>
                <PeriodTile
                  label="Past 8 Hours"
                  totalMm={maxAcrossGauges(gauges, (g) =>
                    sumRecentMm(g, 8 * HOUR_MS)
                  )}
                />
              </Grid>
              <Grid size={6}>
                <PeriodTile
                  label="Past 24 Hours"
                  totalMm={maxAcrossGauges(gauges, (g) =>
                    sumRecentMm(g, 24 * HOUR_MS)
                  )}
                />
              </Grid>
              <Grid size={6}>
                <PeriodTile
                  label="Past 7 Days"
                  totalMm={maxAcrossGauges(gauges, (g) =>
                    sumRecentMm(g, 7 * 24 * HOUR_MS)
                  )}
                />
              </Grid>
              <Grid size={12}>
                <ForecastTile
                  totalMm={calculateForecast24hTotal(rainfall.forecast)}
                  forecast={rainfall.forecast}
                />
              </Grid>
            </Grid>

            <LikelihoodPanel likelihood={assessRainfallLikelihood(gauges)} />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default RainfallCard;
