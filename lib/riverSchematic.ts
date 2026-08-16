import { CsoOutfall, CsoState } from "@/types";
import {
  CATCHMENT_WAYPOINTS,
  CatchmentWaypoint,
  RIVER_BRANCHES,
  RiverBranchId,
} from "@/lib/config";
import { worstCsoState } from "@/lib/csoStatus";
import { nearestWaypoint } from "@/lib/catchment";

// Builds the model behind the river schematic - the tube-map-style diagram
// that replaced a flat list of every monitored outfall.
//
// The list was sorted by severity then distance, which answered "what is the
// worst thing happening" but not the question people actually bring to the
// app: is there sewage *upstream of me*, and how far up? That is a
// one-dimensional question, so it gets a one-dimensional diagram - the
// corridor from Bewdley down to Worcester, with the Stour and Salwarpe
// joining where they really do.
//
// Positions come from CATCHMENT_WAYPOINTS' branch/downstreamOrder, not from
// coordinates: we have outfall lat/lon but no river-network topology, so we
// can order stops honestly but not space them. That is exactly the tube-map
// bargain - not to scale, correct in sequence and connectivity.

export interface SchematicStation {
  waypoint: CatchmentWaypoint;
  outfalls: CsoOutfall[];
  // Worst state among this stop's monitors, or null when it has none - which
  // renders as an unmonitored stop rather than as a healthy one.
  state: CsoState | null;
}

// Lanes are the diagram's columns. The trunk keeps lane 0; every tributary
// shares lane 1, which works because in this corridor each tributary rejoins
// the Severn before the next one starts, so no two are ever drawn at once. A
// corridor with overlapping tributaries would need real lane allocation here.
export const TRUNK_LANE = 0;
export const TRIBUTARY_LANE = 1;

// A straight vertical run of river through one row. Rows vary in height (a
// stop expands to list its monitors), so a segment is expressed as the row
// edges it spans rather than as coordinates, and each row draws its own.
// "centre" is the station dot, which sits a fixed distance down from the row
// top so that expanding a row grows it downwards and leaves the dot aligned
// with its label.
export interface SchematicSegment {
  lane: number;
  from: "top" | "centre";
  to: "bottom" | "centre";
}

interface BaseRow {
  key: string;
  segments: SchematicSegment[];
}

export interface StationRow extends BaseRow {
  kind: "station";
  lane: number;
  station: SchematicStation;
}

// Names a line at the point it starts, rather than in a legend the reader
// has to hold in their head. It takes a row of its own so that station rows
// stay structurally identical - a label sitting inside the first stop would
// push that stop's header down and leave its dot floating above it.
export interface BranchLabelRow extends BaseRow {
  kind: "branchLabel";
  lane: number;
  label: string;
}

// A short fixed-height row carrying only the elbow where a tributary merges
// into the trunk. It gets a row to itself so that the curve is never
// stretched out of shape by a neighbouring stop expanding.
export interface ConfluenceRow extends BaseRow {
  kind: "confluence";
  fromLane: number;
  toLane: number;
  label: string;
}

// Marks where the paddled water starts. The reach spans several stops, so
// tagging each one individually just repeats the same words down the page;
// naming the boundary once and letting it run to the foot of the diagram says
// it better, and matches how the stops are ringed.
export interface ReachStartRow extends BaseRow {
  kind: "reachStart";
  lane: number;
  label: string;
}

export type SchematicRow =
  StationRow | BranchLabelRow | ConfluenceRow | ReachStartRow;

const waypointsOn = (branch: RiverBranchId): CatchmentWaypoint[] =>
  CATCHMENT_WAYPOINTS.filter((w) => w.branch === branch).sort(
    (a, b) => a.downstreamOrder - b.downstreamOrder
  );

// A continuous run of one lane's line, as a row index range. Tracked per run
// rather than per lane because the tributary lane is reused: a single
// lane-wide span would draw a line straight through the gap between the Stour
// leaving and the Salwarpe arriving.
interface LaneRun {
  lane: number;
  start: number;
  end: number;
}

const WAYPOINT_NAMES = new Set(CATCHMENT_WAYPOINTS.map((w) => w.name));

// A CSO response cached before `waypointName` existed has none: lib/hooks.ts
// reads localStorage straight back into the response type with no migration,
// so an upgrading (or offline) user would otherwise get a diagram reporting
// every stop as unmonitored while the header still counted them. Renaming a
// waypoint in config would strand its outfalls the same way. Both fall back
// to recomputing from the coordinates the outfall already carries.
const resolveWaypointName = (outfall: CsoOutfall): string | null => {
  if (outfall.waypointName && WAYPOINT_NAMES.has(outfall.waypointName)) {
    return outfall.waypointName;
  }
  return (
    nearestWaypoint(outfall.latitude, outfall.longitude)?.waypoint.name ?? null
  );
};

export const buildRiverSchematic = (outfalls: CsoOutfall[]): SchematicRow[] => {
  const byWaypoint = new Map<string, CsoOutfall[]>();
  for (const outfall of outfalls) {
    const name = resolveWaypointName(outfall);
    if (name === null) continue;
    const existing = byWaypoint.get(name);
    if (existing) existing.push(outfall);
    else byWaypoint.set(name, [outfall]);
  }

  const toStation = (waypoint: CatchmentWaypoint): SchematicStation => {
    const stops = byWaypoint.get(waypoint.name) ?? [];
    return {
      waypoint,
      outfalls: stops,
      state: worstCsoState(stops.map((o) => o.state)),
    };
  };

  const trunk = RIVER_BRANCHES.find((b) => b.joinsAt === null);
  if (!trunk) return [];
  const tributaries = RIVER_BRANCHES.filter((b) => b.joinsAt !== null);

  const rows: SchematicRow[] = [];
  const runs: LaneRun[] = [];

  rows.push({
    kind: "branchLabel",
    key: `${trunk.id}-label`,
    lane: TRUNK_LANE,
    label: trunk.label,
    segments: [],
  });

  const trunkStops = waypointsOn(trunk.id);
  const reachStops = trunkStops.filter((w) => w.isReach);
  let reachAnnounced = false;

  // Walk the trunk downstream. A tributary's stops are emitted just before
  // the trunk stop it flows into - geographically true, and it keeps every
  // stop on a row of its own so nothing has to share vertical space.
  for (const waypoint of trunkStops) {
    for (const tributary of tributaries.filter(
      (t) => t.joinsAt === waypoint.name
    )) {
      const stops = waypointsOn(tributary.id);
      if (stops.length === 0) continue;
      rows.push({
        kind: "branchLabel",
        key: `${tributary.id}-label`,
        lane: TRIBUTARY_LANE,
        label: tributary.label,
        segments: [],
      });
      const start = rows.length;
      for (const stop of stops) {
        rows.push({
          kind: "station",
          key: stop.name,
          lane: TRIBUTARY_LANE,
          station: toStation(stop),
          segments: [],
        });
      }
      rows.push({
        kind: "confluence",
        key: `${tributary.id}-confluence`,
        fromLane: TRIBUTARY_LANE,
        toLane: TRUNK_LANE,
        label: `${tributary.label} joins here`,
        segments: [],
      });
      runs.push({ lane: TRIBUTARY_LANE, start, end: rows.length - 1 });
    }

    if (waypoint.isReach && !reachAnnounced && reachStops.length > 0) {
      reachAnnounced = true;
      const first = reachStops[0];
      const last = reachStops[reachStops.length - 1];
      rows.push({
        kind: "reachStart",
        key: "reach-start",
        lane: TRUNK_LANE,
        label:
          first === last
            ? `Your reach: ${first.label}`
            : `Your reach: ${first.label} to ${last.label}`,
        segments: [],
      });
    }

    rows.push({
      kind: "station",
      key: waypoint.name,
      lane: TRUNK_LANE,
      station: toStation(waypoint),
      segments: [],
    });
  }

  // The trunk runs unbroken from its first stop to its last, passing through
  // every tributary row in between - the Severn does not stop flowing while
  // the diagram details the Stour.
  const trunkRows = rows.reduce<number[]>((acc, row, i) => {
    if (row.kind === "station" && row.lane === TRUNK_LANE) acc.push(i);
    return acc;
  }, []);
  if (trunkRows.length > 0) {
    runs.push({
      lane: TRUNK_LANE,
      start: trunkRows[0],
      end: trunkRows[trunkRows.length - 1],
    });
  }

  rows.forEach((row, i) => {
    for (const run of runs) {
      if (i < run.start || i > run.end) continue;
      // At a confluence the merging line leaves via the elbow, so it draws no
      // straight segment of its own there.
      if (row.kind === "confluence" && run.lane === row.fromLane) continue;
      row.segments.push({
        lane: run.lane,
        from: i === run.start ? "centre" : "top",
        to: i === run.end ? "centre" : "bottom",
      });
    }
  });

  return rows;
};
