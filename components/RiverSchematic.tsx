"use client";

import { useMemo, useState } from "react";
import {
  Box,
  ButtonBase,
  Chip,
  Collapse,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { CsoOutfall } from "@/types";
import {
  CSO_NOTABLE_STATES,
  CSO_STATE_UI,
  statusChipSx,
} from "@/lib/csoStatus";
import {
  ConfluenceRow,
  SchematicRow,
  SchematicSegment,
  StationRow,
  TRUNK_LANE,
  buildRiverSchematic,
} from "@/lib/riverSchematic";
import { collapseMotion, m3Spring, spring } from "@/lib/m3-palette";
import CsoOutfallRow from "@/components/CsoOutfallRow";

// The CSO monitoring network drawn as a transit diagram: the Severn as a
// trunk line running downstream from Bewdley to Worcester, the Stour and
// Salwarpe joining where they do, and every monitored outfall grouped into
// the stop it sits nearest. Colour is the worst state at that stop.
//
// Geometry is deliberately simple. The connector column is a fixed-width
// gutter drawn with plain boxes, one per line segment, so a stop can expand
// to any height without the diagram desynchronising - only the confluence
// elbow needs a path, and it lives in a fixed-height row of its own so it is
// never stretched.

const CONNECTOR_WIDTH = 44;
// Lane centres sit on the half pixel so that a line of odd width - and the
// odd-sized dots on it - start and end on whole pixels. On a whole-pixel
// centre the boxes start at x.5, which the browser rounds to the next pixel
// while the SVG confluence curve is drawn where it is asked, so the two came
// out half a pixel apart: a shoulder where the curve leaves a tributary and a
// sliver beside the trunk where it joins.
const LANE_X: Record<number, number> = { 0: 13.5, 1: 31.5 };
const LINE_WIDTH = 3;
const DOT_SIZE = 13;
// The station dot sits a fixed distance below the row's top edge, level with
// the middle of the stop's header, rather than at 50% of the row - expanding
// a stop grows it downwards and must leave the dot where it was.
const HEADER_MIN_HEIGHT = 48;
const DOT_CENTRE_Y = HEADER_MIN_HEIGHT / 2;
const CONFLUENCE_HEIGHT = 30;
const BRANCH_LABEL_HEIGHT = 30;

const laneColour = (lane: number) =>
  lane === TRUNK_LANE ? "primary.main" : "secondary.main";

// The fixed-height annotation rows (branch names, confluences) share a
// layout: text centred against the piece of line drawn beside it.
const centredRow = { display: "flex", alignItems: "center", px: 1 } as const;

// The M3 state layer and focus ring Paddlecheck's expandable rows carry
// (PaddlingMatrixCard): an onSurface overlay at 8% on hover and 10% pressed,
// drawn on a pseudo-element so it composites over whatever fill the row has
// rather than replacing it. These rows used to swap their background on
// hover instead, or show nothing at all until focused from the keyboard.
const stateLayerSx = {
  position: "relative",
  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    backgroundColor: "text.primary",
    opacity: 0,
    transition: spring("opacity", m3Spring.effectsFast),
    pointerEvents: "none",
  },
  "&:hover::after": { opacity: 0.08 },
  "&:active::after": { opacity: 0.1 },
  "&:focus-visible": {
    outline: "3px solid",
    outlineColor: "primary.main",
    outlineOffset: -3,
  },
} as const;

// How far a segment runs past its row's edge into the next. Rows can land on
// fractional pixel heights, and two pieces that only meet edge to edge leave
// a hairline seam where the rounding falls between them; overlapping the
// same opaque colour by a pixel hides it.
const SEAM_OVERLAP = 1;

// Square-ended, like Paddlecheck's landmark track: each row draws its own
// piece of line, and rounded ends pinched in at every join, so the river read
// as a string of dashes. Where a segment ends at a stop, the dot covers it.
const Segment: React.FC<{ segment: SchematicSegment }> = ({ segment }) => {
  const top = segment.from === "top" ? -SEAM_OVERLAP : DOT_CENTRE_Y;
  return (
    <Box
      sx={{
        position: "absolute",
        left: LANE_X[segment.lane] - LINE_WIDTH / 2,
        width: LINE_WIDTH,
        backgroundColor: laneColour(segment.lane),
        top,
        ...(segment.to === "bottom"
          ? { bottom: -SEAM_OVERLAP }
          : { height: DOT_CENTRE_Y - top }),
      }}
    />
  );
};

// The elbow where a tributary merges into the trunk, as a single smooth
// curve that arrives vertical so it reads as a confluence rather than a
// T-junction. Drawn in the tributary's colour - it is the tributary's water
// joining the Severn, not the other way round. Butt-capped and painted
// beneath the trunk (see renderRow), so its end slips under the main line
// rather than a round cap of the tributary's colour sitting on top of it.
const MergeCurve: React.FC<{ row: ConfluenceRow }> = ({ row }) => {
  const fromX = LANE_X[row.fromLane];
  const toX = LANE_X[row.toLane];
  const h = CONFLUENCE_HEIGHT;
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${CONNECTOR_WIDTH} ${h}`}
      width={CONNECTOR_WIDTH}
      height={h}
      aria-hidden
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        color: laneColour(row.fromLane),
      }}
    >
      <path
        d={`M ${fromX} 0 C ${fromX} ${h * 0.58}, ${toX} ${h * 0.42}, ${toX} ${h}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={LINE_WIDTH}
        strokeLinecap="butt"
      />
    </Box>
  );
};

const StationDot: React.FC<{ row: StationRow }> = ({ row }) => {
  const { state } = row.station;
  const isReach = row.station.waypoint.isReach === true;
  return (
    <Box
      sx={{
        position: "absolute",
        left: LANE_X[row.lane] - DOT_SIZE / 2,
        top: DOT_CENTRE_Y - DOT_SIZE / 2,
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: "50%",
        boxSizing: "border-box",
        border: "2px solid",
        ...(state
          ? {
              // A ring in the card's own colour lifts the dot off the line
              // behind it, the way a transit map punches its interchange
              // markers out.
              borderColor: "background.paper",
              backgroundColor: CSO_STATE_UI[state].color,
            }
          : {
              // A stop with no monitors is a hollow ring, not a grey dot. A
              // filled outline-grey (#8A9DA4 in dark) was all but identical
              // to the Offline status grey (#9E9E9E), and the two mean
              // different things - "nothing to monitor here" against "the
              // monitors here aren't reporting". Shape tells them apart where
              // a third shade of grey wouldn't.
              borderColor: "surfaces.outline",
              backgroundColor: "background.paper",
            }),
        ...(isReach && {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        }),
      }}
    />
  );
};

const ClearMonitorsGroup: React.FC<{
  stationKey: string;
  clearOutfalls: CsoOutfall[];
  expanded: boolean;
  onToggle: () => void;
}> = ({ clearOutfalls, expanded, onToggle }) => {
  const count = clearOutfalls.length;
  if (count === 0) return null;

  const label = `${count} clear monitor${count === 1 ? "" : "s"}`;

  return (
    <Stack spacing={1}>
      <ButtonBase
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={label}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          px: 1.5,
          py: 1,
          borderRadius: 2,
          // Borderless on containerHigh, like the outfall rows beside it
          // and Paddlecheck's matrix rows.
          bgcolor: "surfaces.containerHigh",
          textAlign: "left",
          ...stateLayerSx,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
          {label}
        </Typography>
        <Chip
          label="Clear"
          size="small"
          sx={{
            ...statusChipSx("Not discharging"),
            flexShrink: 0,
            mr: 1,
          }}
        />
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            flexShrink: 0,
            color: "text.secondary",
            transition: spring("transform", m3Spring.spatialFast),
            transform: expanded ? "rotate(180deg)" : "none",
          }}
        />
      </ButtonBase>
      <Collapse
        in={expanded}
        unmountOnExit
        easing={collapseMotion.easing}
        timeout="auto"
      >
        <Stack spacing={1} sx={{ pt: 0.5 }}>
          {clearOutfalls.map((outfall) => (
            <CsoOutfallRow key={outfall.id} outfall={outfall} />
          ))}
        </Stack>
      </Collapse>
    </Stack>
  );
};

const StationHeader: React.FC<{
  row: StationRow;
  expanded: boolean;
  onToggle: () => void;
}> = ({ row, expanded, onToggle }) => {
  const { waypoint, outfalls, state } = row.station;
  const count = outfalls.length;
  const notable = state !== null && CSO_NOTABLE_STATES.includes(state);

  const body = (
    <>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {waypoint.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {count === 0
            ? "No monitors"
            : `${count} monitor${count === 1 ? "" : "s"}`}
        </Typography>
      </Box>
      {notable && (
        <Chip
          label={CSO_STATE_UI[state].label}
          size="small"
          sx={{ ...statusChipSx(state), flexShrink: 0 }}
        />
      )}
      {count > 0 && (
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            flexShrink: 0,
            color: "text.secondary",
            transition: spring("transform", m3Spring.spatialFast),
            transform: expanded ? "rotate(180deg)" : "none",
          }}
        />
      )}
    </>
  );

  const layout = {
    width: "100%",
    minHeight: HEADER_MIN_HEIGHT,
    display: "flex",
    alignItems: "center",
    gap: 1,
    px: 1,
    textAlign: "left" as const,
    borderRadius: 2,
  };

  // A stop with no monitors has nothing to expand, so it stays inert rather
  // than offering a control that does nothing.
  if (count === 0) return <Box sx={layout}>{body}</Box>;

  return (
    <ButtonBase
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`${waypoint.label}, ${count} monitor${
        count === 1 ? "" : "s"
      }`}
      sx={{ ...layout, ...stateLayerSx }}
    >
      {body}
    </ButtonBase>
  );
};

const RiverSchematic: React.FC<{ outfalls: CsoOutfall[] }> = ({ outfalls }) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedClearKeys, setExpandedClearKeys] = useState<Set<string>>(
    () => new Set()
  );
  const rows = useMemo(() => buildRiverSchematic(outfalls), [outfalls]);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleClearExpanded = (key: string) => {
    setExpandedClearKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderRow = (row: SchematicRow) => {
    const isExpanded = row.kind === "station" && expandedKeys.has(row.key);
    const isClearExpanded =
      row.kind === "station" && expandedClearKeys.has(row.key);
    const nonClearOutfalls =
      row.kind === "station"
        ? row.station.outfalls.filter((o) => o.state !== "Not discharging")
        : [];
    const clearOutfalls =
      row.kind === "station"
        ? row.station.outfalls.filter((o) => o.state === "Not discharging")
        : [];
    return (
      <Box key={row.key} sx={{ display: "flex", alignItems: "stretch" }}>
        <Box
          aria-hidden
          sx={{
            position: "relative",
            width: CONNECTOR_WIDTH,
            flexShrink: 0,
          }}
        >
          {/* Before the segments, so the trunk running through the row
              paints over the end of the merging curve. */}
          {row.kind === "confluence" && <MergeCurve row={row} />}
          {row.segments.map((segment) => (
            <Segment key={segment.lane} segment={segment} />
          ))}
          {row.kind === "station" && <StationDot row={row} />}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {row.kind === "confluence" && (
            <Box sx={{ height: CONFLUENCE_HEIGHT, ...centredRow }}>
              <Typography variant="caption" color="text.secondary">
                {row.label}
              </Typography>
            </Box>
          )}

          {row.kind === "branchLabel" && (
            <Box sx={{ height: BRANCH_LABEL_HEIGHT, ...centredRow }}>
              <Typography
                variant="overline"
                sx={{ lineHeight: 1.4, color: laneColour(row.lane) }}
              >
                {row.label}
              </Typography>
            </Box>
          )}

          {row.kind === "reachStart" && (
            <Box sx={{ height: BRANCH_LABEL_HEIGHT, ...centredRow }}>
              <Typography
                variant="overline"
                sx={{
                  lineHeight: 1.4,
                  fontWeight: 700,
                  color: "primary.main",
                }}
              >
                {row.label}
              </Typography>
            </Box>
          )}

          {row.kind === "station" && (
            <>
              <StationHeader
                row={row}
                expanded={isExpanded}
                onToggle={() => toggleExpanded(row.key)}
              />
              <Collapse
                in={isExpanded}
                unmountOnExit
                easing={collapseMotion.easing}
                timeout="auto"
              >
                <Stack spacing={1} sx={{ pb: 1.5, px: 1 }}>
                  {nonClearOutfalls.map((outfall) => (
                    <CsoOutfallRow key={outfall.id} outfall={outfall} />
                  ))}
                  {clearOutfalls.length > 0 && (
                    <ClearMonitorsGroup
                      stationKey={row.key}
                      clearOutfalls={clearOutfalls}
                      expanded={isClearExpanded}
                      onToggle={() => toggleClearExpanded(row.key)}
                    />
                  )}
                </Stack>
              </Collapse>
            </>
          )}
        </Box>
      </Box>
    );
  };

  return <Box>{rows.map(renderRow)}</Box>;
};

// Every catchment waypoint gets a row whether or not it has outfalls (see
// buildRiverSchematic), so the diagram's shape is fixed by config rather than
// by the data. The skeleton builds the same rows from an empty list and lays
// out each at its real height - one generic block per row would have the card
// grow by several hundred pixels when the data lands.
export const RiverSchematicSkeleton: React.FC = () => {
  const rows = useMemo(() => buildRiverSchematic([]), []);
  return (
    <Box aria-hidden>
      {rows.map((row) => {
        if (row.kind !== "station") {
          const height =
            row.kind === "confluence" ? CONFLUENCE_HEIGHT : BRANCH_LABEL_HEIGHT;
          return (
            <Box
              key={row.key}
              sx={{ height, ...centredRow, pl: `${CONNECTOR_WIDTH + 8}px` }}
            >
              <Skeleton variant="text" width={110} animation="wave" />
            </Box>
          );
        }
        return (
          <Box
            key={row.key}
            sx={{
              display: "flex",
              alignItems: "center",
              height: HEADER_MIN_HEIGHT,
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: CONNECTOR_WIDTH,
                flexShrink: 0,
              }}
            >
              <Skeleton
                variant="circular"
                width={DOT_SIZE}
                height={DOT_SIZE}
                animation="wave"
                sx={{ ml: `${LANE_X[row.lane] - DOT_SIZE / 2}px` }}
              />
            </Box>
            <Box sx={{ px: 1, flex: 1, minWidth: 0 }}>
              <Skeleton variant="text" width="45%" animation="wave" />
              <Skeleton
                variant="text"
                width={72}
                height={16}
                animation="wave"
              />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default RiverSchematic;
