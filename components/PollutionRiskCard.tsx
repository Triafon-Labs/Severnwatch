"use client";

import { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Grow,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  PollutionRisk,
  PollutionRiskLevel,
  derivePollutionRisk,
} from "@/lib/pollutionRisk";
import { ON_STATUS_COLORS, STATUS_COLORS } from "@/lib/statusColors";
import { m3Spring, spring, springTransition } from "@/lib/m3-palette";
import { useNowTicking } from "@/lib/time";
import InfoPanel from "@/components/InfoPanel";

// The scale strip, best to worst, the way it reads left to right.
const RISK_SCALE: PollutionRiskLevel[] = ["lower", "raised", "high"];

// Same hues the spill states use (lib/csoStatus.ts), so "High" here is the
// red a discharging overflow is everywhere else on the page.
const RISK_UI: Record<
  PollutionRiskLevel,
  { label: string; color: string; onColor: string; Icon: React.ElementType }
> = {
  high: {
    label: "High Risk",
    color: STATUS_COLORS.red,
    onColor: ON_STATUS_COLORS.red,
    Icon: ReportProblemIcon,
  },
  raised: {
    label: "Raised Risk",
    color: STATUS_COLORS.amber,
    onColor: ON_STATUS_COLORS.amber,
    Icon: WarningAmberIcon,
  },
  lower: {
    label: "Lower Risk",
    color: STATUS_COLORS.darkGreen,
    onColor: ON_STATUS_COLORS.darkGreen,
    Icon: CheckCircleOutlineIcon,
  },
};

const RiskHero: React.FC<{ risk: PollutionRisk }> = ({ risk }) => {
  const ui = RISK_UI[risk.level];
  const otherLevels = RISK_SCALE.filter((l) => l !== risk.level)
    .map((l) => RISK_UI[l].label)
    .join(" and ");
  const fullAriaLabel = `Pollution risk scale: ${ui.label}, step ${
    RISK_SCALE.indexOf(risk.level) + 1
  } of ${RISK_SCALE.length}. Other levels are ${otherLevels}.`;

  return (
    <Box>
      <InfoPanel
        sx={{
          gap: { xs: 1.75, sm: 2.5 },
          p: { xs: 2, sm: 3 },
          borderRadius: "28px",
          backgroundColor: ui.color,
          color: ui.onColor,
          transition: spring("background-color", m3Spring.effectsDefault),
        }}
      >
        <ui.Icon sx={{ fontSize: { xs: 40, sm: 56 }, flexShrink: 0 }} />
        <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="h3"
            component="p"
            sx={{
              fontWeight: 500,
              lineHeight: 1.1,
              fontSize: { xs: "1.625rem", sm: "2rem" },
            }}
          >
            {ui.label}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 500,
              opacity: 0.9,
              fontSize: { xs: "0.95rem", sm: "1.1rem" },
            }}
          >
            From spills and rainfall
          </Typography>
        </Stack>
      </InfoPanel>

      <Box
        role="img"
        aria-label={fullAriaLabel}
        sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.5 }}
      >
        {RISK_SCALE.map((level) => {
          const isActive = level === risk.level;
          return (
            <Box
              key={level}
              title={RISK_UI[level].label}
              sx={{
                flex: isActive ? 2.2 : 1,
                height: isActive ? 10 : 6,
                borderRadius: 9999,
                backgroundColor: RISK_UI[level].color,
                opacity: isActive ? 1 : 0.32,
                transition: [
                  spring("flex-grow, height", m3Spring.spatialDefault),
                  spring("opacity", m3Spring.effectsDefault),
                ].join(", "),
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

// Why the level is what it is, then what would change how far to trust it.
// The closing line is not optional: without it a green panel reads as a
// water test that came back clean.
const RiskDetail: React.FC<{ risk: PollutionRisk }> = ({ risk }) => (
  <Stack spacing={1} sx={{ mt: 2 }}>
    {risk.reasons.map((reason) => {
      const ui = RISK_UI[reason.level];
      return (
        <Box
          key={reason.text}
          sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}
        >
          <ui.Icon
            fontSize="small"
            sx={{ color: ui.color, flexShrink: 0, mt: "1px" }}
          />
          <Typography variant="body2">{reason.text}</Typography>
        </Box>
      );
    })}
    {risk.caveats.map((caveat) => (
      <Box
        key={caveat}
        sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}
      >
        <InfoOutlinedIcon
          fontSize="small"
          sx={{ color: "text.secondary", flexShrink: 0, mt: "1px" }}
        />
        <Typography variant="body2" color="text.secondary">
          {caveat}
        </Typography>
      </Box>
    ))}
    <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
      Not a water test. Nothing here measures bacteria, and the river can be
      polluted on a lower-risk day - see the citizen science results below.
    </Typography>
  </Stack>
);

const PollutionRiskCard: React.FC = () => {
  const { cso, rainfall, csoError, loading, isRefreshing, isOffline } =
    useSevernContext();
  const showSkeleton = loading || (isRefreshing && !isOffline);
  // Ticks so a plume's "due in about N hours" counts down, and moves from
  // arriving to passing, between fetches.
  const now = useNowTicking();

  const risk = useMemo(
    () => (cso ? derivePollutionRisk(cso, rainfall, now.getTime()) : null),
    [cso, rainfall, now]
  );

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Water Quality Status
        </Typography>

        {/* Mirrors the hero and its scale strip, so the card doesn't jump
            when the data lands. The reasons below it vary in length, so
            only their first line is reserved. */}
        {showSkeleton && (
          <Box>
            <Skeleton
              variant="rounded"
              animation="wave"
              sx={{ height: { xs: 92, sm: 128 }, borderRadius: "28px" }}
            />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                height: 10,
                mt: 1.5,
              }}
            >
              {RISK_SCALE.map((level) => (
                <Skeleton
                  key={level}
                  variant="rounded"
                  height={6}
                  animation="wave"
                  sx={{ flex: 1, borderRadius: 9999 }}
                />
              ))}
            </Box>
            <Skeleton animation="wave" sx={{ mt: 2 }} />
          </Box>
        )}

        {!showSkeleton && csoError && !cso && (
          <InfoPanel align="flex-start" sx={{ borderRadius: 3, p: 2 }}>
            <CloudOffIcon
              color="warning"
              sx={{ flexShrink: 0, fontSize: 32 }}
            />
            <Typography variant="body2" color="text.secondary">
              Couldn&apos;t load sewage spill data right now, and the risk
              can&apos;t be estimated without it. It&apos;ll retry on the next
              refresh.
            </Typography>
          </InfoPanel>
        )}

        {!showSkeleton && risk && (
          <Grow in appear {...springTransition()}>
            <Box>
              <RiskHero risk={risk} />
              <RiskDetail risk={risk} />
            </Box>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default PollutionRiskCard;
