"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { formatDistanceToNow } from "date-fns";
import { CsoOutfall, CsoResponse } from "@/types";
import { SEVERN_TRENT_MAP_URL } from "@/lib/config";
import { formatDuration, formatAsOf } from "@/lib/format";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // matches the route's 5-min cache

const relativeTime = (iso: string | null): string =>
  iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "unknown time";

const describeLocation = (o: CsoOutfall): string =>
  o.locationName ? `${o.locationName} (${o.watercourse})` : o.watercourse;

const OutfallRow: React.FC<{ outfall: CsoOutfall }> = ({ outfall: o }) => (
  <Box>
    <Typography variant="body2" sx={{ fontWeight: 500 }}>
      {describeLocation(o)}
    </Typography>
    <Stack direction="row" spacing={1} alignItems="baseline" sx={{ flexWrap: "wrap" }}>
      <Typography variant="caption" sx={{ opacity: 0.9 }}>
        {o.state === "Ongoing"
          ? `Started ${relativeTime(o.startISO)}`
          : `Ended ${relativeTime(o.endISO)}`}
      </Typography>
      {o.durationMinutes !== null && (
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          &middot; {o.state === "Ongoing" ? "running" : "lasted"}{" "}
          {formatDuration(o.durationMinutes)}
        </Typography>
      )}
    </Stack>
  </Box>
);

const CsoSpillCard: React.FC = () => {
  const [data, setData] = useState<CsoResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/sewage");
        if (!res.ok) throw new Error("Failed to fetch");
        const body: CsoResponse = await res.json();
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

  const outfalls = data?.outfalls ?? [];
  const ongoing = outfalls.filter((o) => o.state === "Ongoing");
  const recent = outfalls.filter((o) => o.state === "Recent");

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Typography variant="h5" component="h2">
            Sewage Spill Status
          </Typography>
          {ongoing.length > 0 && (
            <Chip label="Spill in progress" color="error" size="small" />
          )}
        </Stack>

        {loading && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={72} />
            <Skeleton variant="text" width="40%" />
          </Stack>
        )}

        {!loading && error && (
          <Alert severity="warning" sx={{ borderRadius: 1 }}>
            Couldn&apos;t load sewage spill data right now. Try again shortly.
          </Alert>
        )}

        {!loading && !error && (
          <Stack spacing={1.5}>
            {ongoing.length === 0 && recent.length === 0 && (
              <Alert
                icon={<CheckCircleOutlineIcon />}
                severity="success"
                variant="outlined"
                sx={{ borderRadius: 1 }}
              >
                No spills currently reported in this catchment (Worcester to
                Bewdley).
              </Alert>
            )}

            {ongoing.length > 0 && (
              <Alert
                icon={<ReportProblemIcon />}
                severity="error"
                variant="outlined"
                sx={{ borderRadius: 1, "& .MuiAlert-message": { width: "100%" } }}
              >
                <Stack spacing={0.75}>
                  <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                    Sewage spill in progress
                  </Typography>
                  {ongoing.map((o, idx) => (
                    <Box key={o.id}>
                      {idx > 0 && <Divider sx={{ my: 1, opacity: 0.3 }} />}
                      <OutfallRow outfall={o} />
                    </Box>
                  ))}
                </Stack>
              </Alert>
            )}

            {recent.length > 0 && (
              <Alert
                icon={<InfoOutlinedIcon />}
                severity="warning"
                variant="outlined"
                sx={{ borderRadius: 1, "& .MuiAlert-message": { width: "100%" } }}
              >
                <Stack spacing={0.75}>
                  <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                    Recent sewage spill (last 24h)
                  </Typography>
                  {recent.map((o, idx) => (
                    <Box key={o.id}>
                      {idx > 0 && <Divider sx={{ my: 1, opacity: 0.3 }} />}
                      <OutfallRow outfall={o} />
                    </Box>
                  ))}
                </Stack>
              </Alert>
            )}

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="baseline"
            >
              <Typography variant="caption" color="text.secondary">
                {data ? formatAsOf(data.asOf) : ""}
              </Typography>
              <Link
                href={SEVERN_TRENT_MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                sx={{ fontWeight: "bold" }}
              >
                Severn Trent
              </Link>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default CsoSpillCard;
