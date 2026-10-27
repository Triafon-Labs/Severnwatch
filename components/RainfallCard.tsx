"use client";

import {
  Box,
  Card,
  CardContent,
  Divider,
  Grow,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import UpdateIcon from "@mui/icons-material/Update";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import { RainfallGaugeData } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  HOUR_MS,
  calculateForecast24hTotal,
  sumRecentMm,
} from "@/lib/rainfallAnalysis";
import InfoPanel from "@/components/InfoPanel";
import StatTile, { tileGridSx } from "@/components/StatTile";
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

// Each tile's rendered height, for the skeletons that stand in for them: the
// heading and value, and the same with a detail line beneath.
const TILE_HEIGHT = 75;
const DETAIL_TILE_HEIGHT = 96;

// The wettest gauge's total over each period - labels as short as
// Paddlecheck's ("1h Change") and the chart's own range toggle, since a
// longer one wraps in a half-width tile on a phone.
const PERIODS: { label: string; ms: number; icon: React.ReactNode }[] = [
  { label: "Past 1h", ms: HOUR_MS, icon: <HistoryIcon /> },
  { label: "Past 8h", ms: 8 * HOUR_MS, icon: <HistoryIcon /> },
  { label: "Past 24h", ms: 24 * HOUR_MS, icon: <HistoryIcon /> },
  { label: "Past 7d", ms: 7 * 24 * HOUR_MS, icon: <CalendarTodayIcon /> },
];

// The gauges stack one to a row rather than sharing tileGridSx's two
// columns: at half width the reading's age wraps onto a line of its own.
const gaugeListSx = { display: "grid", gap: 1 } as const;

// A gauge's own day of rain, with its newest reading beneath. The reading's
// own age rather than a fixed "in the last 15 min", which this used to claim
// for whatever the newest reading was - including one from a gauge that had
// stopped reporting hours ago.
const GaugeStat: React.FC<{
  label: string;
  latestMm: number | null;
  latestAgeLabel: string | null;
  last24hTotalMm: number;
}> = ({ label, latestMm, latestAgeLabel, last24hTotalMm }) => (
  <StatTile
    icon={<WaterDropIcon />}
    label={label}
    value={`${last24hTotalMm} mm in 24h`}
    detail={
      latestMm !== null && latestAgeLabel
        ? `Latest ${latestMm} mm · ${latestAgeLabel}`
        : "No recent reading"
    }
  />
);

// Worst (highest) reading across the catchment's gauges - the number that
// actually matters for "could this cause a spill nearby", not an average
// that dilutes a burst at one station with calm at the others.
const maxAcrossGauges = (
  gauges: RainfallGaugeData[],
  value: (g: RainfallGaugeData) => number
): number => Math.max(...gauges.map(value));

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
    <Box sx={gaugeListSx}>
      {Array.from({ length: RAINFALL_GAUGES.length }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={DETAIL_TILE_HEIGHT}
          animation="wave"
        />
      ))}
    </Box>

    <ChartSkeleton />

    <Divider />

    <Box sx={tileGridSx}>
      {PERIODS.map(({ label }) => (
        <Skeleton
          key={label}
          variant="rounded"
          height={TILE_HEIGHT}
          animation="wave"
        />
      ))}
      <Skeleton
        variant="rounded"
        height={DETAIL_TILE_HEIGHT}
        animation="wave"
      />
    </Box>
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
  const forecast24hMm = rainfall
    ? calculateForecast24hTotal(rainfall.forecast)
    : null;
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
              <Box sx={gaugeListSx}>
                {gauges.map((gauge) => (
                  <GaugeStat
                    key={gauge.id}
                    label={gauge.label}
                    latestMm={gauge.latestMm}
                    latestAgeLabel={ageLabel(latestReadingMs(gauge))}
                    last24hTotalMm={gauge.last24hTotalMm}
                  />
                ))}
              </Box>

              <RainfallChart
                gauges={gauges}
                forecast={rainfall.forecast}
                dataAgeLabel={ageLabel(newestReadingMs)}
              />

              <Divider />

              <Box sx={tileGridSx}>
                {PERIODS.map(({ label, ms, icon }) => (
                  <StatTile
                    key={label}
                    icon={icon}
                    label={label}
                    value={`${maxAcrossGauges(gauges, (g) =>
                      sumRecentMm(g, ms)
                    )} mm`}
                  />
                ))}
                <StatTile
                  icon={<UpdateIcon />}
                  label="24h Forecast"
                  value={forecast24hMm !== null ? `${forecast24hMm} mm` : "—"}
                  detail="Worcester only"
                />
              </Box>
            </Stack>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default RainfallCard;
