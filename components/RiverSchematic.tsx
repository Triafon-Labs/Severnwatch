"use client";

import { useState } from "react";
import {
  Box,
  ButtonBase,
  Chip,
  Collapse,
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
import { m3Spring, spring } from "@/lib/m3-palette";
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
const LANE_X: Record<number, number> = { 0: 13, 1: 31 };
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

const Segment: React.FC<{ segment: SchematicSegment }> = ({ segment }) => {
  const top = segment.from === "top" ? 0 : DOT_CENTRE_Y;
  return (
    <Box
      sx={{
        position: "absolute",
        left: LANE_X[segment.lane] - LINE_WIDTH / 2,
        width: LINE_WIDTH,
        borderRadius: LINE_WIDTH,
        backgroundColor: laneColour(segment.lane),
        top,
        ...(segment.to === "bottom"
          ? { bottom: 0 }
          : { height: DOT_CENTRE_Y - top }),
      }}
    />
  );
};

// The elbow where a tributary merges into the trunk, as a single smooth
// curve that arrives vertical so it reads as a confluence rather than a
// T-junction. Drawn in the tributary's colour - it is the tributary's water
// joining the Severn, not the other way round.
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
        strokeLinecap="round"
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
        // A ring in the card's own colour lifts the dot off the line behind
        // it, the way a transit map punches its interchange markers out.
        border: "2px solid",
        borderColor: "background.paper",
        backgroundColor: state ? CSO_STATE_UI[state].color : "surfaces.outline",
        ...(isReach && {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        }),
      }}
    />
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
            transition: spring("transform", m3Spring.effectsFast),
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
      sx={{
        ...layout,
        "&:focus-visible": {
          outline: "3px solid",
          outlineColor: "primary.main",
          outlineOffset: -3,
        },
      }}
    >
      {body}
    </ButtonBase>
  );
};

const RiverSchematic: React.FC<{ outfalls: CsoOutfall[] }> = ({ outfalls }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = buildRiverSchematic(outfalls);

  const renderRow = (row: SchematicRow) => {
    const isExpanded = row.kind === "station" && expanded === row.key;
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
          {row.segments.map((segment) => (
            <Segment key={segment.lane} segment={segment} />
          ))}
          {row.kind === "confluence" && <MergeCurve row={row} />}
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
                onToggle={() => setExpanded(isExpanded ? null : row.key)}
              />
              <Collapse in={isExpanded} unmountOnExit>
                <Stack spacing={1} sx={{ pb: 1.5, px: 1 }}>
                  {row.station.outfalls.map((outfall) => (
                    <CsoOutfallRow key={outfall.id} outfall={outfall} />
                  ))}
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

export default RiverSchematic;
