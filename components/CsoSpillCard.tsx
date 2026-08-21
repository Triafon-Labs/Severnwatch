"use client";

import { useState } from "react";
import {
  Box,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Collapse,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { formatDistanceToNow } from "date-fns";
import { CsoOutfall } from "@/types";
import { SEVERN_TRENT_MAP_URL } from "@/lib/config";
import { formatDuration, formatOutfallSubtitle } from "@/lib/format";
import { CSO_STATE_UI, statusChipSx } from "@/lib/csoStatus";
import { useSevernContext } from "@/lib/SevernDataContext";
import InfoPanel from "@/components/InfoPanel";

const relativeTime = (iso: string | null): string =>
  iso
    ? formatDistanceToNow(new Date(iso), { addSuffix: true })
    : "unknown time";

const OutfallRow: React.FC<{ outfall: CsoOutfall }> = ({ outfall: o }) => {
  const title = o.locationName ?? o.watercourse;
  const subtitle = o.locationName
    ? formatOutfallSubtitle(o.watercourse, o.waypointName)
    : o.waypointName;

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.9, display: "block", mb: 0.25 }}>
        {subtitle}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        alignItems="baseline"
        sx={{ flexWrap: "wrap" }}
      >
        <Typography variant="caption" sx={{ opacity: 0.85 }}>
          {o.state === "Ongoing"
            ? `Started ${relativeTime(o.startISO)}`
            : `Ended ${relativeTime(o.endISO)}`}
        </Typography>
        {o.durationMinutes !== null && (
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            &middot; {o.state === "Ongoing" ? "Running" : "Lasted"}{" "}
            {formatDuration(o.durationMinutes)}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

const SpillGroup: React.FC<{
  state: "Ongoing" | "Recent";
  outfalls: CsoOutfall[];
}> = ({ state, outfalls }) => {
  const ui = CSO_STATE_UI[state];
  const Icon = state === "Ongoing" ? ReportProblemIcon : InfoOutlinedIcon;
  const role = state === "Ongoing" ? "error" : "warning";
  const multiple = outfalls.length > 1;

  // Start minimised if there are multiple spills
  const [expanded, setExpanded] = useState(!multiple);

  const headingText = multiple
    ? `${outfalls.length} sewage spills ${state === "Ongoing" ? "in progress" : "recently ended"}`
    : state === "Ongoing"
    ? "Sewage spill in progress"
    : "Recent sewage spill";

  const toggleExpand = () => setExpanded((prev) => !prev);

  return (
    <InfoPanel
      align="flex-start"
      sx={{
        bgcolor: `${role}.container`,
        color: `${role}.onContainer`,
        borderLeft: "6px solid",
        borderColor: ui.color,
        borderRadius: 3,
        p: 2,
      }}
    >
      <Stack direction="row" spacing={2} sx={{ width: "100%", minWidth: 0 }}>
        <Icon sx={{ color: ui.color, fontSize: 36, mt: 0.25, flexShrink: 0 }} />
        <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
          <Box
            {...(multiple
              ? {
                  component: ButtonBase,
                  onClick: toggleExpand,
                  sx: {
                    display: "block",
                    textAlign: "left",
                    width: "100%",
                    borderRadius: 1,
                    cursor: "pointer",
                  },
                }
              : {})}
          >
            <Typography
              variant="caption"
              sx={{
                display: "block",
                letterSpacing: "0.08em",
                fontWeight: 600,
                opacity: 0.8,
                textTransform: "uppercase",
                mb: 0.25,
              }}
            >
              CATCHMENT - WORCESTER TO BEWDLEY
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography
                variant="h5"
                component="h3"
                sx={{ fontWeight: 700, lineHeight: 1.2 }}
              >
                {headingText}
              </Typography>
              {multiple && (
                <ExpandMoreIcon
                  sx={{
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease-in-out",
                    opacity: 0.9,
                    ml: 1,
                  }}
                />
              )}
            </Stack>
          </Box>
          <Collapse in={expanded} unmountOnExit>
            <Stack spacing={1.5} sx={{ minWidth: 0, mt: 0.5 }}>
              {outfalls.map((o, idx) => (
                <Box key={o.id}>
                  {idx > 0 && <Divider sx={{ my: 1, opacity: 0.3 }} />}
                  <OutfallRow outfall={o} />
                </Box>
              ))}
            </Stack>
          </Collapse>
        </Stack>
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
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
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
            <Skeleton variant="rounded" height={100} />
          </Stack>
        )}

        {!showSkeleton && csoError && !cso && (
          <InfoPanel align="flex-start" sx={{ borderRadius: 3, p: 2 }}>
            <CloudOffIcon color="warning" sx={{ flexShrink: 0, fontSize: 32 }} />
            <Typography variant="body2" color="text.secondary">
              Couldn&apos;t load sewage spill data right now. It&apos;ll retry
              on the next refresh.
            </Typography>
          </InfoPanel>
        )}

        {!showSkeleton && cso && (
          <Stack spacing={2}>
            {ongoing.length === 0 && recent.length === 0 && (
              <InfoPanel
                align="flex-start"
                sx={{
                  bgcolor: "success.container",
                  color: "success.onContainer",
                  borderLeft: "6px solid",
                  borderColor: "success.main",
                  borderRadius: 3,
                  p: 2,
                }}
              >
                <Stack direction="row" spacing={2} sx={{ width: "100%", minWidth: 0 }}>
                  <CheckCircleOutlineIcon
                    sx={{ color: "success.main", fontSize: 36, mt: 0.25, flexShrink: 0 }}
                  />
                  <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        letterSpacing: "0.08em",
                        fontWeight: 600,
                        opacity: 0.8,
                        textTransform: "uppercase",
                      }}
                    >
                      CATCHMENT - WORCESTER TO BEWDLEY
                    </Typography>
                    <Typography variant="h5" component="h3" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      No spills reported
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                      No spills currently reported in this catchment.
                    </Typography>
                  </Stack>
                </Stack>
              </InfoPanel>
            )}

            {ongoing.length > 0 && (
              <SpillGroup
                state="Ongoing"
                outfalls={ongoing}
              />
            )}

            {recent.length > 0 && (
              <SpillGroup
                state="Recent"
                outfalls={recent}
              />
            )}

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Link
                href={SEVERN_TRENT_MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                sx={{ fontWeight: 600 }}
              >
                Severn Trent
              </Link>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default CsoSpillCard;
