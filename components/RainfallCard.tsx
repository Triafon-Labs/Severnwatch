"use client";

import {
  Card,
  CardContent,
  Divider,
  Grid,
  Grow,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import UpdateIcon from "@mui/icons-material/Update";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { RainfallGaugeData } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  HOUR_MS,
  calculateForecast24hTotal,
  sumRecentMm,
} from "@/lib/rainfallAnalysis";
import InfoPanel from "@/components/InfoPanel";
import dynamic from "next/dynamic";
import { springTransition } from "@/lib/m3-palette";
import { RAINFALL_GAUGES } from "@/lib/config";
import { formatDataAge, useNowTicking } from "@/lib/time";

// When a gauge's newest reading was taken. EA gauges report on their own
// telemetry schedules and often upload in batches, so the newest reading can
// be well over the nominal 15 minutes old - and one gauge can fall hours
// behind the others without the route failing.
const latestReadingMs = (gauge: RainfallGaugeData): number | null =>
  gauge.readings.length > 0
    ? new Date(gauge.readings[gauge.readings.length - 1].dateTime).getTime()
    : null;

const GaugeStat: React.FC<{
  label: string;
  latestMm: number | null;
  latestAgeLabel: string | null;
  last24hTotalMm: number;
}> = ({ label, latestMm, latestAgeLabel, last24hTotalMm }) => (
  <InfoPanel
    align="center"
    sx={{
      flexDirection: "column",
      gap: 0.5,
      height: "100%",
      textAlign: "center",
    }}
  >
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
      {/* The reading's own age rather than a fixed "in the last 15 min",
          which this used to claim for whatever the newest reading was -
          including one from a gauge that had stopped reporting hours ago. */}
      {latestMm !== null && latestAgeLabel
        ? `Latest ${latestMm} mm (${latestAgeLabel})`
        : "no recent reading"}
    </Typography>
  </InfoPanel>
);

// Worst (highest) reading across the catchment's gauges - the number that
// actually matters for "could this cause a spill nearby", not an average
// that dilutes a burst at one station with calm at the others.
const maxAcrossGauges = (
  gauges: RainfallGaugeData[],
  value: (g: RainfallGaugeData) => number
): number => Math.max(...gauges.map(value));

const PeriodTile: React.FC<{
  label: string;
  totalMm: number;
  icon?: React.ReactNode;
}> = ({
  label,
  totalMm,
  icon = <HistoryIcon sx={{ fontSize: 20, color: "primary.main" }} />,
}) => (
  <InfoPanel
    align="center"
    sx={{
      flexDirection: "column",
      gap: 0.75,
      height: "100%",
      textAlign: "center",
    }}
  >
    <Stack direction="row" spacing={0.75} alignItems="center">
      {icon}
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
}> = ({ totalMm }) => {
  return (
    <InfoPanel
      align="center"
      sx={{
        flexDirection: "column",
        gap: 0.75,
        height: "100%",
        textAlign: "center",
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center">
        <UpdateIcon sx={{ fontSize: 20, color: "primary.main" }} />
        <Typography variant="caption" color="text.secondary">
          24h Forecast (Worcester only)
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
      </Stack>
    </InfoPanel>
  );
};

// The chart's caption row, range toggle and plot, at their rendered heights.
// Shared by the card's own skeleton and the placeholder that holds the
// chart's place while its chunk downloads.
const ChartSkeleton: React.FC = () => (
  <Stack spacing={1} aria-hidden>
    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
      <Skeleton variant="text" width={150} height={17} animation="wave" />
      <Skeleton variant="text" width={90} height={17} animation="wave" />
    </Stack>
    <Skeleton
      variant="rounded"
      height={41}
      animation="wave"
      sx={{ borderRadius: 9999 }}
    />
    <Skeleton variant="rounded" height={220} animation="wave" />
  </Stack>
);

// recharts is by far the heaviest client dependency, and nothing else on the
// page uses it - load it as its own chunk so the CSO cards above paint
// sooner, the way Paddlecheck loads its graphs. Client-only anyway:
// ResponsiveContainer needs a real layout to measure.
const RainfallChart = dynamic(() => import("@/components/RainfallChart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

// Mirrors the loaded layout piece for piece - gauge tiles, the chart's
// caption row, range toggle and plot, then the period tiles - at their
// rendered heights, so the card doesn't grow when the data lands. It used to
// be two blocks totalling under 300px for a card that loads at 800-1000.
const RainfallCardSkeleton: React.FC = () => (
  <Stack spacing={2} aria-hidden>
    <Grid container spacing={2}>
      {Array.from({ length: RAINFALL_GAUGES.length }).map((_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 4 }}>
          <Skeleton variant="rounded" height={96} animation="wave" />
        </Grid>
      ))}
    </Grid>

    <ChartSkeleton />

    <Divider />

    <Grid container spacing={1.5}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Grid key={i} size={i === 4 ? 12 : 6}>
          <Skeleton variant="rounded" height={80} animation="wave" />
        </Grid>
      ))}
    </Grid>
  </Stack>
);

const RainfallCard: React.FC = () => {
  const { rainfall, rainfallError, loading, isRefreshing, isOffline } =
    useSevernContext();
  const gauges = rainfall?.gauges ?? [];
  const showSkeleton = loading || (isRefreshing && !isOffline);

  // The age of the reading itself, not of the fetch. The app bar's "Updated"
  // line is when /api/rainfall built its response, which is fresh by
  // construction even when every gauge is an hour behind.
  const now = useNowTicking();
  const ageLabel = (ms: number | null) =>
    ms !== null ? formatDataAge(ms, now) : null;
  const newestReadingMs = gauges.reduce<number | null>((newest, gauge) => {
    const ms = latestReadingMs(gauge);
    return ms !== null && (newest === null || ms > newest) ? ms : newest;
  }, null);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Rainfall
        </Typography>

        {showSkeleton && <RainfallCardSkeleton />}

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
          <Grow in appear {...springTransition()}>
            <Stack spacing={2}>
              <Grid container spacing={2}>
                {gauges.map((gauge) => (
                  <Grid key={gauge.id} size={{ xs: 12, sm: 4 }}>
                    <GaugeStat
                      label={gauge.label}
                      latestMm={gauge.latestMm}
                      latestAgeLabel={ageLabel(latestReadingMs(gauge))}
                      last24hTotalMm={gauge.last24hTotalMm}
                    />
                  </Grid>
                ))}
              </Grid>

              <RainfallChart
                gauges={gauges}
                forecast={rainfall.forecast}
                dataAgeLabel={ageLabel(newestReadingMs)}
              />

              <Divider />

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
                    icon={
                      <CalendarTodayIcon
                        sx={{ fontSize: 20, color: "primary.main" }}
                      />
                    }
                  />
                </Grid>
                <Grid size={12}>
                  <ForecastTile
                    totalMm={calculateForecast24hTotal(rainfall.forecast)}
                  />
                </Grid>
              </Grid>
            </Stack>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default RainfallCard;
