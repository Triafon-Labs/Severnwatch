"use client";

import { useMemo } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { RiskHistoryDay } from "@/types";
import { useSevernContext } from "@/lib/SevernDataContext";
import { useRiskHistory } from "@/lib/useRiskHistory";
import { RISK_LEVEL_UI } from "@/lib/pollutionRisk";
import {
  SAMPLE_BAND_UI,
  SampleBand,
  bandForSample,
  sampleTimeMs,
} from "@/lib/waterQuality";
import { formatLondonDate, londonDayKey } from "@/lib/time";
import { DAY_MS } from "@/lib/rainfallAnalysis";

// What the app said against what the samples found: a strip of days
// coloured by the worst risk recorded on each, with a dot above any day a
// sample was taken, coloured by its result.
//
// The risk drawn is the one from spills and rain alone (RiskSnapshot's
// modelLevel) - the headline can itself be raised by a Poor sample, and
// that would be marking the estimate against its own answer.
//
// Renders nothing until recording has begun, so the card simply appears
// once there is a first day to show.

// How many days the strip shows, newest on the right.
const WINDOW_DAYS = 56;
const STRIP_HEIGHT = 28;
const DOT_SIZE = 10;

// "2026-11-16" for each of the last `count` London days, oldest first. Noon
// UTC is the same calendar day in London all year, so stepping by 24 hours
// from it never skips or repeats one across a clock change.
const lastDayKeys = (count: number): string[] => {
  const todayNoon = Date.parse(`${londonDayKey(Date.now())}T12:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    londonDayKey(todayNoon - (count - 1 - i) * DAY_MS)
  );
};

const dayLabel = (key: string) =>
  formatLondonDate(Date.parse(`${key}T12:00:00Z`), { withWeekday: false });

const LegendItem: React.FC<{
  colour: string;
  round?: boolean;
  children: React.ReactNode;
}> = ({ colour, round, children }) => (
  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
    <Box
      sx={{
        width: 10,
        height: 10,
        flexShrink: 0,
        borderRadius: round ? "50%" : "2px",
        backgroundColor: colour,
      }}
    />
    <Typography variant="caption" color="text.secondary">
      {children}
    </Typography>
  </Stack>
);

const RiskHistoryCard: React.FC = () => {
  const days = useRiskHistory();
  const { waterQuality } = useSevernContext();

  const view = useMemo(() => {
    if (days.length === 0) return null;
    const byDate = new Map<string, RiskHistoryDay>(
      days.map((d) => [d.date, d])
    );
    const since = days[0].date;

    // The newest sample on each day since recording began, with the worst
    // risk the app recorded that day.
    const sampleBands = new Map<string, SampleBand>();
    for (const sample of waterQuality?.samples ?? []) {
      const band = bandForSample(sample);
      const key = londonDayKey(sampleTimeMs(sample));
      if (band && key >= since) sampleBands.set(key, band);
    }

    const compared = [...sampleBands].filter(([key]) => byDate.has(key));
    const poor = compared.filter(([, band]) => band === "poor");
    const poorFlagged = poor.filter(
      ([key]) => byDate.get(key)?.worst !== "low"
    );
    const clean = compared.filter(([, band]) => band !== "poor");
    const cleanOnLow = clean.filter(
      ([key]) => byDate.get(key)?.worst === "low"
    );

    return {
      keys: lastDayKeys(WINDOW_DAYS),
      byDate,
      sampleBands,
      since,
      compared: compared.length,
      poor: poor.length,
      poorFlagged: poorFlagged.length,
      clean: clean.length,
      cleanOnLow: cleanOnLow.length,
    };
  }, [days, waterQuality]);

  if (!view) return null;

  const summary =
    view.compared === 0
      ? `No samples have been taken since recording began on ${dayLabel(view.since)}.`
      : [
          `${view.compared} sample${view.compared === 1 ? "" : "s"} since recording began on ${dayLabel(view.since)}.`,
          view.poor > 0 &&
            `${view.poorFlagged} of ${view.poor} Poor ${view.poor === 1 ? "result" : "results"} came on a day the risk was Raised or High.`,
          view.clean > 0 &&
            `${view.cleanOnLow} of ${view.clean} Excellent or Good ${view.clean === 1 ? "result" : "results"} came on a Low day.`,
        ]
          .filter(Boolean)
          .join(" ");

  const columns = {
    display: "grid",
    gridTemplateColumns: `repeat(${view.keys.length}, minmax(0, 1fr))`,
    columnGap: "2px",
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          Risk vs Samples
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25, mb: 2 }}
        >
          The worst risk the app estimated each day from spills and rain, and
          what the samples then found.
        </Typography>

        <Box role="img" aria-label={`Risk history. ${summary}`}>
          {/* Sample results, each over the day it was taken. */}
          <Box sx={{ ...columns, height: DOT_SIZE, mb: 0.75 }}>
            {view.keys.map((key) => {
              const band = view.sampleBands.get(key);
              return (
                <Box
                  key={key}
                  sx={{ display: "flex", justifyContent: "center" }}
                >
                  {band && (
                    <Box
                      title={`${dayLabel(key)}: ${SAMPLE_BAND_UI[band].label} sample`}
                      sx={{
                        width: DOT_SIZE,
                        height: DOT_SIZE,
                        flexShrink: 0,
                        borderRadius: "50%",
                        backgroundColor: SAMPLE_BAND_UI[band].color,
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>

          {/* The day's worst estimated risk; an empty step where nothing
              was recorded. */}
          <Box sx={{ ...columns, height: STRIP_HEIGHT }}>
            {view.keys.map((key) => {
              const day = view.byDate.get(key);
              return (
                <Box
                  key={key}
                  title={
                    day
                      ? `${dayLabel(key)}: ${RISK_LEVEL_UI[day.worst].label}`
                      : `${dayLabel(key)}: not recorded`
                  }
                  sx={{
                    borderRadius: "2px",
                    ...(day
                      ? { backgroundColor: RISK_LEVEL_UI[day.worst].color }
                      : { bgcolor: "surfaces.containerHigh" }),
                  }}
                />
              );
            })}
          </Box>

          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", mt: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              {dayLabel(view.keys[0])}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Today
            </Typography>
          </Stack>
        </Box>

        {/* Two rows, so the squares and the dots each read as one scale. */}
        <Stack spacing={0.25} sx={{ mt: 1.5 }}>
          <Stack direction="row" sx={{ flexWrap: "wrap", columnGap: 1.5 }}>
            <LegendItem colour={RISK_LEVEL_UI.low.color}>Low risk</LegendItem>
            <LegendItem colour={RISK_LEVEL_UI.raised.color}>Raised</LegendItem>
            <LegendItem colour={RISK_LEVEL_UI.high.color}>High</LegendItem>
          </Stack>
          <Stack direction="row" sx={{ flexWrap: "wrap", columnGap: 1.5 }}>
            <LegendItem colour={SAMPLE_BAND_UI.excellent.color} round>
              Excellent sample
            </LegendItem>
            <LegendItem colour={SAMPLE_BAND_UI.good.color} round>
              Good
            </LegendItem>
            <LegendItem colour={SAMPLE_BAND_UI.poor.color} round>
              Poor
            </LegendItem>
          </Stack>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {summary}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default RiskHistoryCard;
