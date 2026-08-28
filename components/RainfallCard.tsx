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
import RainfallChart from "@/components/RainfallChart";
import { springTransition } from "@/lib/m3-palette";

const GaugeStat: React.FC<{
  label: string;
  latestMm: number | null;
  last24hTotalMm: number;
}> = ({ label, latestMm, last24hTotalMm }) => (
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
      {latestMm !== null
        ? `${latestMm} mm in the last 15 min`
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

const RainfallCard: React.FC = () => {
  const { rainfall, rainfallError, loading, isRefreshing, isOffline } =
    useSevernContext();
  const gauges = rainfall?.gauges ?? [];
  const showSkeleton = loading || (isRefreshing && !isOffline);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Rainfall
        </Typography>

        {showSkeleton && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={72} animation="wave" />
            <Skeleton variant="rounded" height={220} animation="wave" />
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
          <Grow in appear {...springTransition()}>
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

              <RainfallChart gauges={gauges} forecast={rainfall.forecast} />

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
