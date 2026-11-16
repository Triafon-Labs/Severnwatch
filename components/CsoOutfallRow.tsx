"use client";

import { Chip, Link, Stack, Typography } from "@mui/material";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import HistoryIcon from "@mui/icons-material/History";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { CsoOutfall } from "@/types";
import { formatDuration } from "@/lib/format";
import { CSO_STATE_UI, statusChipSx } from "@/lib/csoStatus";
import { formatLondonDate, getLondonHHMM, londonDaysAgo } from "@/lib/time";
import InfoPanel from "@/components/InfoPanel";

// One monitored outfall, as a labelled row under its stop on the river
// schematic. The stop's own name is left off: the row sits beneath it.

// "18:05" today, "Sun 18:05" within the week, "Sun 8 Nov, 18:05" before
// that - in London time, and short enough to share a line with "21 hours
// ago".
const shortWhen = (iso: string, now: number): string => {
  const ms = Date.parse(iso);
  const days = londonDaysAgo(ms, now);
  const time = getLondonHHMM(new Date(ms));
  if (days <= 0) return time;
  if (days >= 7) return formatLondonDate(ms, { withTime: true });
  const weekday = new Date(ms).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
  });
  return `${weekday} ${time}`;
};

// "45 min ago" / "21h ago" / "2d ago" - to sit after the clock time.
const shortAgo = (iso: string, now: number): string => {
  const mins = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};

const mapUrl = (o: CsoOutfall) =>
  `https://www.google.com/maps/search/?api=1&query=${o.latitude},${o.longitude}`;

const getTimingDetails = (
  o: CsoOutfall,
  now: number
): { primaryTiming: string | null; durationText: string | null } => {
  const dateSince = (iso: string | null, prefix: string) =>
    iso
      ? `${prefix} ${formatLondonDate(Date.parse(iso), { withWeekday: false, withYear: true })}`
      : null;

  let primaryTiming: string | null = null;
  switch (o.state) {
    case "Ongoing": {
      if (o.startISO) {
        primaryTiming = `Started ${shortWhen(o.startISO, now)} · ${shortAgo(o.startISO, now)}`;
      } else {
        primaryTiming = null;
      }
      break;
    }
    case "Recent": {
      if (o.endISO) {
        primaryTiming = `Ended ${shortWhen(o.endISO, now)} · ${shortAgo(o.endISO, now)}`;
      } else {
        primaryTiming = null;
      }
      break;
    }
    case "Not discharging":
      primaryTiming = dateSince(o.startISO, "Clear since");
      break;
    case "Offline":
      primaryTiming = null;
      break;
  }

  let durationText: string | null = null;
  if (o.durationMinutes !== null) {
    const verb = o.state === "Ongoing" ? "Running" : "Lasted";
    durationText = `${verb} ${formatDuration(o.durationMinutes)}`;
  }

  return { primaryTiming, durationText };
};

const MetaLine: React.FC<{
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, children }) => (
  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
    <span
      style={{
        display: "inline-flex",
        flexShrink: 0,
        color: "inherit",
      }}
    >
      {icon}
    </span>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ lineHeight: 1.35 }}
    >
      {children}
    </Typography>
  </Stack>
);

const CsoOutfallRow: React.FC<{ outfall: CsoOutfall; now: number }> = ({
  outfall: o,
  now,
}) => {
  const { primaryTiming, durationText } = getTimingDetails(o, now);
  const title = o.locationName ?? o.watercourse;

  return (
    // The chip shares a line with the title only, so the detail lines
    // below get the row's full width instead of wrapping beside it.
    <InfoPanel sx={{ display: "block" }}>
      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, overflowWrap: "anywhere", minWidth: 0 }}
          >
            {title}
          </Typography>
          <Chip
            label={CSO_STATE_UI[o.state].label}
            size="small"
            sx={{ ...statusChipSx(o.state), flexShrink: 0, mt: 0.125 }}
          />
        </Stack>
        <MetaLine icon={<LocationOnOutlinedIcon sx={{ fontSize: 16 }} />}>
          {o.locationName && `${o.watercourse} · `}
          <Link
            href={mapUrl(o)}
            target="_blank"
            rel="noopener noreferrer"
            color="inherit"
            aria-label={`${title} on a map (opens in a new tab)`}
          >
            Map
          </Link>
        </MetaLine>
        {primaryTiming && (
          <MetaLine icon={<HistoryIcon sx={{ fontSize: 16 }} />}>
            {primaryTiming}
          </MetaLine>
        )}
        {durationText && (
          <MetaLine icon={<TimerOutlinedIcon sx={{ fontSize: 16 }} />}>
            {durationText}
          </MetaLine>
        )}
      </Stack>
    </InfoPanel>
  );
};

export default CsoOutfallRow;
