"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  Divider,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { RainfallResponse } from "@/types";
import { formatAsOf } from "@/lib/format";
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

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
          Rainfall
        </Typography>

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
              {data.gauges.map((gauge) => (
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

            <RainfallChart gauges={data.gauges} />

            <Typography variant="caption" color="text.secondary">
              {formatAsOf(data.asOf)}
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default RainfallCard;
