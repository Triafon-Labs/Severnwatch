"use client";

import {
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
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { formatDistanceToNow } from "date-fns";
import { CsoOutfall } from "@/types";
import { SEVERN_TRENT_MAP_URL } from "@/lib/config";
import { formatDuration, formatAsOf } from "@/lib/format";
import { CSO_STATE_UI, statusChipSx } from "@/lib/csoStatus";
import { useSevernContext } from "@/lib/SevernDataContext";
import InfoPanel from "@/components/InfoPanel";

const relativeTime = (iso: string | null): string =>
  iso
    ? formatDistanceToNow(new Date(iso), { addSuffix: true })
    : "unknown time";

const describeLocation = (o: CsoOutfall): string =>
  o.locationName ? `${o.locationName} (${o.watercourse})` : o.watercourse;

const OutfallRow: React.FC<{ outfall: CsoOutfall }> = ({ outfall: o }) => (
  <Box>
    <Typography variant="body2" sx={{ fontWeight: 500 }}>
      {describeLocation(o)}
    </Typography>
    <Stack
      direction="row"
      spacing={1}
      alignItems="baseline"
      sx={{ flexWrap: "wrap" }}
    >
      {/* Lower emphasis by fading the container's own on-colour, not by
          switching to `text.secondary`. These rows sit on the error/warning
          container fill, and the global secondary text colour is a neutral
          tuned for the card surface - on the dark scheme's deep red it lands
          at 4.3:1 and reads as a different, clashing grey rather than as
          quieter text. */}
      <Typography variant="caption" sx={{ opacity: 0.85 }}>
        {o.state === "Ongoing"
          ? `Started ${relativeTime(o.startISO)}`
          : `Ended ${relativeTime(o.endISO)}`}
      </Typography>
      {o.durationMinutes !== null && (
        <Typography variant="caption" sx={{ opacity: 0.85 }}>
          &middot; {o.state === "Ongoing" ? "running" : "lasted"}{" "}
          {formatDuration(o.durationMinutes)}
        </Typography>
      )}
    </Stack>
  </Box>
);

// The card's headline reading, drawn as a tonal container panel rather than a
// bordered Alert. M3 carries severity with the container fill and the icon;
// the outlined Alert this replaced drew a saturated ring around body text
// sitting on the bare card, which is a Material 2 shape and read as an error
// state even when the message was "no spills reported".
const SpillGroup: React.FC<{
  state: "Ongoing" | "Recent";
  title: string;
  outfalls: CsoOutfall[];
}> = ({ state, title, outfalls }) => {
  const ui = CSO_STATE_UI[state];
  const Icon = state === "Ongoing" ? ReportProblemIcon : InfoOutlinedIcon;
  const role = state === "Ongoing" ? "error" : "warning";

  return (
    <InfoPanel
      align="flex-start"
      sx={{
        bgcolor: `${role}.container`,
        color: `${role}.onContainer`,
        borderLeft: "4px solid",
        borderColor: ui.color,
      }}
    >
      <Icon sx={{ color: ui.color, flexShrink: 0 }} />
      <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {outfalls.map((o, idx) => (
          <Box key={o.id}>
            {idx > 0 && <Divider sx={{ my: 1, opacity: 0.4 }} />}
            <OutfallRow outfall={o} />
          </Box>
        ))}
      </Stack>
    </InfoPanel>
  );
};

const CsoSpillCard: React.FC = () => {
  const { cso, csoError, loading } = useSevernContext();

  const outfalls = cso?.outfalls ?? [];
  const ongoing = outfalls.filter((o) => o.state === "Ongoing");
  const recent = outfalls.filter((o) => o.state === "Recent");
  const showSkeleton = loading && !cso;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h5" component="h2">
            Sewage Spill Status
          </Typography>
          {ongoing.length > 0 && (
            <Chip
              label="Spill in progress"
              size="small"
              sx={statusChipSx("Ongoing")}
            />
          )}
        </Stack>

        {showSkeleton && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={72} />
            <Skeleton variant="text" width="40%" />
          </Stack>
        )}

        {!showSkeleton && csoError && !cso && (
          <InfoPanel align="flex-start">
            <CloudOffIcon color="warning" sx={{ flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              Couldn&apos;t load sewage spill data right now. It&apos;ll retry
              on the next refresh.
            </Typography>
          </InfoPanel>
        )}

        {!showSkeleton && cso && (
          <Stack spacing={1.5}>
            {ongoing.length === 0 && recent.length === 0 && (
              <InfoPanel
                sx={{
                  bgcolor: "success.container",
                  color: "success.onContainer",
                }}
              >
                <CheckCircleOutlineIcon
                  sx={{ color: "success.main", flexShrink: 0 }}
                />
                <Typography variant="body2">
                  No spills currently reported in this catchment (Worcester to
                  Bewdley).
                </Typography>
              </InfoPanel>
            )}

            {ongoing.length > 0 && (
              <SpillGroup
                state="Ongoing"
                title="Sewage spill in progress"
                outfalls={ongoing}
              />
            )}

            {recent.length > 0 && (
              <SpillGroup
                state="Recent"
                title="Recent sewage spill"
                outfalls={recent}
              />
            )}

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="baseline"
            >
              <Typography variant="caption" color="text.secondary">
                {formatAsOf(cso.asOf)}
              </Typography>
              <Link
                href={SEVERN_TRENT_MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                sx={{ fontWeight: 600 }}
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
