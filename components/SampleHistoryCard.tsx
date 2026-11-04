"use client";

import { Fragment, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Divider,
  Grow,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  Typography,
} from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import FunctionsIcon from "@mui/icons-material/Functions";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { useSevernContext } from "@/lib/SevernDataContext";
import {
  CLASSIFIED_INDICATORS,
  INDICATORS,
  IndicatorKey,
  SAMPLE_BAND_UI,
  bandForSample,
  formatCount,
  indicatorStats,
  sampleTimeMs,
} from "@/lib/waterQuality";
import { formatLondonDate } from "@/lib/londonDate";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { collapseMotion, springTransition } from "@/lib/m3-palette";
import InfoPanel from "@/components/InfoPanel";
import StatTile, { tileGridSx } from "@/components/StatTile";
import SlidingToggleButtonGroup from "@/components/SlidingToggleButtonGroup";
import { ClassificationTablesSection } from "@/components/WaterQualityInfoContent";

const INDICATOR_ORDER = CLASSIFIED_INDICATORS;

const isIndicator = (v: string | null): v is IndicatorKey =>
  v !== null && (INDICATOR_ORDER as string[]).includes(v);

const ChartSkeleton: React.FC = () => (
  <Stack spacing={1} aria-hidden>
    <Skeleton variant="text" width={200} height={17} animation="wave" />
    <Skeleton variant="rounded" height={240} animation="wave" />
    <Skeleton variant="text" width={260} height={17} animation="wave" />
  </Stack>
);

// recharts is its own chunk (as with the rainfall chart), and this card sits
// at the bottom of the page, so nothing above waits on it.
const SampleHistoryChart = dynamic(
  () => import("@/components/SampleHistoryChart"),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const SampleHistoryCard: React.FC = () => {
  const { waterQuality, waterQualityError, loading, isRefreshing, isOffline } =
    useSevernContext();
  const showSkeleton = loading || (isRefreshing && !isOffline);
  const samples = waterQuality?.samples ?? [];

  // Seeded from localStorage on first render, like the rainfall range, so the
  // reader's choice is what paints first.
  const [indicatorKey, setIndicatorKey] = useState<IndicatorKey>(() => {
    if (typeof window === "undefined") return "eColi";
    try {
      const saved = window.localStorage.getItem(STORAGE_KEYS.SAMPLE_INDICATOR);
      return isIndicator(saved) ? saved : "eColi";
    } catch {
      return "eColi";
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.SAMPLE_INDICATOR, indicatorKey);
    } catch {
      // Storage disabled - the choice just doesn't survive a reload.
    }
  }, [indicatorKey]);

  const [tableOpen, setTableOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);

  const indicator = INDICATORS[indicatorKey];
  const stats = indicatorStats(samples, indicatorKey);
  const firstMs = samples[0] ? sampleTimeMs(samples[0]) : null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          Sample History
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 2 }}
        >
          {samples.length > 0 && firstMs !== null
            ? `${samples.length} samples at ${waterQuality?.site.name} since ${formatLondonDate(
                firstMs,
                { withWeekday: false, withYear: true }
              )}`
            : "Every sample taken at this site"}
        </Typography>

        {showSkeleton && (
          <Stack spacing={2} aria-hidden>
            <Skeleton
              variant="rounded"
              height={41}
              animation="wave"
              sx={{ borderRadius: 9999 }}
            />
            <ChartSkeleton />
          </Stack>
        )}

        {!showSkeleton && waterQualityError && !waterQuality && (
          <InfoPanel align="flex-start">
            <CloudOffIcon color="warning" sx={{ flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              Couldn&apos;t load the sample history right now. It&apos;ll retry
              on the next refresh.
            </Typography>
          </InfoPanel>
        )}

        {!showSkeleton && waterQuality && samples.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No samples have been added yet.
          </Typography>
        )}

        {!showSkeleton && samples.length > 0 && (
          <Grow in appear {...springTransition()}>
            <Stack spacing={2}>
              <SlidingToggleButtonGroup
                value={indicatorKey}
                exclusive
                fullWidth
                size="small"
                aria-label="Bacteria shown"
                onChange={(_, v: IndicatorKey | null) =>
                  v && setIndicatorKey(v)
                }
              >
                {INDICATOR_ORDER.map((key) => (
                  <ToggleButton key={key} value={key} sx={{ fontSize: 12 }}>
                    {INDICATORS[key].shortLabel}
                  </ToggleButton>
                ))}
              </SlidingToggleButtonGroup>

              <SampleHistoryChart
                samples={samples}
                indicatorKey={indicatorKey}
              />

              <Divider />

              <Box sx={tileGridSx}>
                <StatTile
                  icon={<WarningAmberIcon />}
                  label="Over Good"
                  value={`${stats.overGood} of ${stats.total}`}
                  detail={`${indicator.limits.good.toLocaleString("en-GB")} or more`}
                />
                <StatTile
                  icon={<WarningAmberIcon />}
                  label="Over Excellent"
                  value={`${stats.overExcellent} of ${stats.total}`}
                  detail={`${indicator.limits.excellent.toLocaleString("en-GB")} or more`}
                />
                {stats.highest && (
                  <StatTile
                    icon={<ArrowUpwardIcon />}
                    label="Highest"
                    value={formatCount(stats.highest.count)}
                    detail={formatLondonDate(
                      Date.parse(stats.highest.sampledAt),
                      { withWeekday: false }
                    )}
                  />
                )}
                <StatTile
                  icon={<FunctionsIcon />}
                  label="Median"
                  value={formatCount(stats.median)}
                  detail="Half of samples were higher"
                />
              </Box>

              <Box>
                <Button
                  onClick={() => setTableOpen((o) => !o)}
                  endIcon={tableOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  aria-expanded={tableOpen}
                  size="small"
                >
                  {tableOpen ? "Hide All Samples" : "Show All Samples"}
                </Button>
                <Collapse in={tableOpen} unmountOnExit {...collapseMotion}>
                  <TableContainer sx={{ mt: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell align="right">E. coli</TableCell>
                          <TableCell align="right">Enterococci</TableCell>
                          <TableCell padding="none" sx={{ width: 24 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[...samples].reverse().map((s, idx, all) => {
                          const band = bandForSample(s);
                          const isLast = idx === all.length - 1;
                          // A note gets a row of its own beneath its sample,
                          // in the same stripe, rather than a hover tooltip -
                          // there's no hover on a phone, which is where this
                          // gets read. Notes are rare, so it costs little.
                          const rowSx = {
                            bgcolor:
                              idx % 2 === 1
                                ? "surfaces.containerHigh"
                                : "transparent",
                          };
                          return (
                            <Fragment key={s.id}>
                              <TableRow
                                sx={{
                                  ...rowSx,
                                  "& td": {
                                    borderBottom:
                                      isLast || s.notes ? 0 : undefined,
                                  },
                                }}
                              >
                                <TableCell sx={{ whiteSpace: "nowrap" }}>
                                  {formatLondonDate(sampleTimeMs(s), {
                                    withWeekday: false,
                                  })}
                                </TableCell>
                                <TableCell align="right">
                                  {formatCount(s.eColi)}
                                </TableCell>
                                <TableCell align="right">
                                  {formatCount(s.enterococci)}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  padding="none"
                                  sx={{ pr: 1 }}
                                >
                                  {band && (
                                    // A dot rather than the chip: four columns
                                    // don't leave room for a label on a phone.
                                    <Box
                                      role="img"
                                      aria-label={SAMPLE_BAND_UI[band].label}
                                      title={SAMPLE_BAND_UI[band].description}
                                      sx={{
                                        display: "inline-block",
                                        width: 10,
                                        height: 10,
                                        borderRadius: "50%",
                                        bgcolor: SAMPLE_BAND_UI[band].color,
                                      }}
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                              {s.notes && (
                                <TableRow
                                  sx={{
                                    ...rowSx,
                                    "& td": {
                                      borderBottom: isLast ? 0 : undefined,
                                    },
                                  }}
                                >
                                  <TableCell colSpan={4} sx={{ pt: 0 }}>
                                    <Box
                                      sx={{
                                        display: "flex",
                                        gap: 0.75,
                                        alignItems: "flex-start",
                                      }}
                                    >
                                      <FormatQuoteIcon
                                        color="primary"
                                        aria-hidden
                                        sx={{ fontSize: 18, flexShrink: 0 }}
                                      />
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ whiteSpace: "pre-line" }}
                                      >
                                        <Box
                                          component="span"
                                          sx={{
                                            position: "absolute",
                                            width: 1,
                                            height: 1,
                                            overflow: "hidden",
                                            clip: "rect(0 0 0 0)",
                                          }}
                                        >
                                          Tester&apos;s note:{" "}
                                        </Box>
                                        {s.notes}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Box>

              {/* The full classification tables, next to the chart that
                  draws their limits. These used to sit under the SAS map
                  embed, which this card and Latest Sample replaced. */}
              <Box sx={{ mt: -1 }}>
                <Button
                  onClick={() => setLimitsOpen((o) => !o)}
                  endIcon={limitsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  aria-expanded={limitsOpen}
                  size="small"
                >
                  {limitsOpen
                    ? "Hide Classification Limits"
                    : "Show Classification Limits"}
                </Button>
                <Collapse in={limitsOpen} unmountOnExit {...collapseMotion}>
                  <Box sx={{ mt: 1 }}>
                    <ClassificationTablesSection />
                  </Box>
                </Collapse>
              </Box>
            </Stack>
          </Grow>
        )}
      </CardContent>
    </Card>
  );
};

export default SampleHistoryCard;
