"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  Divider,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import { RainfallGaugeData, RainfallResponse } from "@/types";
import { formatAsOf } from "@/lib/format";
import { HOUR_MS, SpillLikelihood, assessRainfallLikelihood, sumRecentMm } from "@/lib/rainfallAnalysis";
import RainfallChart from "@/components/RainfallChart";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // matches the gauges' own reporting cadence

const GaugeStat: React.FC<{ label: string; latestMm: number | null; last24hTotalMm: number }> = ({
  label,
  latestMm,
  last24hTotalMm,
}) => (
  <Stack spacing={0.25} sx={{ minWidth: 140 }}>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h6" component="p">
      {last24hTotalMm} mm
      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
        last 24h
      </Typography>
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {latestMm !== null ? `${latestMm} mm in the last 15 min` : "no recent reading"}
    </Typography>
  </Stack>
);

// Worst (highest) reading across the catchment's gauges - the number that
// actually matters for "could this cause a spill nearby", not an average
// that dilutes a burst at one station with calm at the others.
const maxAcrossGauges = (gauges: RainfallGaugeData[], value: (g: RainfallGaugeData) => number): number =>
  Math.max(...gauges.map(value));

const ChangeTile: React.FC<{ label: string; currentMm: number; previousMm: number }> = ({
  label,
  currentMm,
  previousMm,
}) => {
  const delta = Math.round((currentMm - previousMm) * 10) / 10;
  const Icon = delta > 0 ? TrendingUpIcon : delta < 0 ? TrendingDownIcon : TrendingFlatIcon;
  const color = delta > 0 ? "warning.main" : delta < 0 ? "success.main" : "text.secondary";

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, height: "100%" }}>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
        <RestoreIcon sx={{ fontSize: 16, opacity: 0.6 }} />
        <Typography variant="caption" color="text.secondary">
          {label} Change
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Icon sx={{ color, fontSize: 20 }} />
        <Typography variant="h6" component="p">
          {Math.abs(delta)} mm
        </Typography>
      </Stack>
    </Paper>
  );
};

const TotalTile: React.FC<{ label: string; totalMm: number }> = ({ label, totalMm }) => (
  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, height: "100%" }}>
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
      <CalendarMonthIcon sx={{ fontSize: 16, opacity: 0.6 }} />
      <Typography variant="caption" color="text.secondary">
        {label} Total
      </Typography>
    </Stack>
    <Typography variant="h6" component="p">
      {totalMm} mm
    </Typography>
  </Paper>
);

const LIKELIHOOD_STYLE: Record<
  SpillLikelihood,
  { severity: "success" | "warning" | "error"; icon: React.ReactNode; description: string }
> = {
  Low: {
    severity: "success",
    icon: <CheckCircleOutlineIcon />,
    description: "Rainfall doesn't currently suggest an elevated spill risk.",
  },
  Medium: {
    severity: "warning",
    icon: <WarningAmberIcon />,
    description: "Sustained rain across the catchment - a spill is more plausible than usual.",
  },
  High: {
    severity: "error",
    icon: <ReportProblemIcon />,
    description: "Heavy, thunderstorm-level rainfall in the catchment - a spill is more likely.",
  },
};

const LikelihoodTile: React.FC<{ likelihood: SpillLikelihood }> = ({ likelihood }) => {
  const style = LIKELIHOOD_STYLE[likelihood];
  return (
    <Alert icon={style.icon} severity={style.severity} variant="outlined" sx={{ borderRadius: 1 }}>
      <Stack spacing={0.25}>
        <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
          Rainfall-based spill likelihood: {likelihood}
        </Typography>
        <Typography variant="body2">{style.description}</Typography>
        <Typography variant="caption" color="text.secondary">
          Estimated from rainfall alone (this is separate from the actual spill
          status above) - real risk also depends on sewer capacity and ground
          conditions.
        </Typography>
      </Stack>
    </Alert>
  );
};

const RainfallCard: React.FC = () => {
  const [data, setData] = useState<RainfallResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/rainfall");
        if (!res.ok) throw new Error("Failed to fetch");
        const body: RainfallResponse = await res.json();
        if (!cancelled) {
          setData(body);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const gauges = data?.gauges ?? [];

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="h5" component="h2">
            Rainfall
          </Typography>
          {!loading && !error && data && (
            <Typography variant="caption" color="text.secondary">
              {formatAsOf(data.asOf)}
            </Typography>
          )}
        </Stack>

        {loading && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={72} />
            <Skeleton variant="rounded" height={180} />
          </Stack>
        )}

        {!loading && error && (
          <Alert severity="warning" sx={{ borderRadius: 1 }}>
            Couldn&apos;t load rainfall data right now. Try again shortly.
          </Alert>
        )}

        {!loading && !error && data && (
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

            <RainfallChart gauges={gauges} />

            <Grid container spacing={1.5}>
              <Grid size={6}>
                <ChangeTile
                  label="1h"
                  currentMm={maxAcrossGauges(gauges, (g) => sumRecentMm(g, HOUR_MS))}
                  previousMm={maxAcrossGauges(gauges, (g) => sumRecentMm(g, HOUR_MS, HOUR_MS))}
                />
              </Grid>
              <Grid size={6}>
                <ChangeTile
                  label="8h"
                  currentMm={maxAcrossGauges(gauges, (g) => sumRecentMm(g, 8 * HOUR_MS))}
                  previousMm={maxAcrossGauges(gauges, (g) => sumRecentMm(g, 8 * HOUR_MS, 8 * HOUR_MS))}
                />
              </Grid>
              <Grid size={6}>
                <ChangeTile
                  label="24h"
                  currentMm={maxAcrossGauges(gauges, (g) => sumRecentMm(g, 24 * HOUR_MS))}
                  previousMm={maxAcrossGauges(gauges, (g) => sumRecentMm(g, 24 * HOUR_MS, 24 * HOUR_MS))}
                />
              </Grid>
              <Grid size={6}>
                <TotalTile
                  label="7d"
                  totalMm={maxAcrossGauges(gauges, (g) => sumRecentMm(g, 7 * 24 * HOUR_MS))}
                />
              </Grid>
            </Grid>

            <LikelihoodTile likelihood={assessRainfallLikelihood(gauges)} />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default RainfallCard;
