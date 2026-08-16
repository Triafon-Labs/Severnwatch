import { CsoState } from "@/types";
import { ON_STATUS_COLORS, STATUS_COLORS } from "@/lib/statusColors";

// How each CSO state looks and reads, in one place. The spill card and the
// full monitoring list both surface the same four states, and they used to
// keep separate label maps and separate MUI chip colours - which is how
// "Ongoing" ended up rendering as "Discharging now" in one card and "Ongoing"
// in the other, in two different reds.
//
// `color`/`onColor` come from lib/statusColors.ts rather than from a MUI
// palette role, so an Ongoing chip is the same red wherever it appears and in
// whichever colour scheme. `severity` is for the places that genuinely want a
// themed surface instead - the alert panels, whose tonal container fills do
// have to follow the scheme.
export interface CsoStateUi {
  label: string;
  groupLabel: string;
  color: string;
  onColor: string;
  severity: "error" | "warning" | "success" | "info";
}

export const CSO_STATE_UI: Record<CsoState, CsoStateUi> = {
  Ongoing: {
    label: "Discharging",
    groupLabel: "Discharging now",
    color: STATUS_COLORS.red,
    onColor: ON_STATUS_COLORS.red,
    severity: "error",
  },
  Recent: {
    label: "Recent",
    groupLabel: "Recent spill (last 24h)",
    color: STATUS_COLORS.amber,
    onColor: ON_STATUS_COLORS.amber,
    severity: "warning",
  },
  "Not discharging": {
    label: "Clear",
    groupLabel: "Not discharging",
    color: STATUS_COLORS.darkGreen,
    onColor: ON_STATUS_COLORS.darkGreen,
    severity: "success",
  },
  Offline: {
    label: "Offline",
    groupLabel: "Monitor offline",
    color: STATUS_COLORS.grey,
    onColor: ON_STATUS_COLORS.grey,
    severity: "info",
  },
};

// Order the states are presented in, worst first.
export const CSO_STATE_ORDER: CsoState[] = [
  "Ongoing",
  "Recent",
  "Not discharging",
  "Offline",
];

// The single state that should represent a group of monitors - the worst one
// present, per CSO_STATE_ORDER. Used by the river schematic, where one stop
// stands for every outfall near a waypoint: one discharging outfall among ten
// quiet ones has to colour that stop red, or the diagram reassures when it
// shouldn't. Returns null for an empty group, which renders as a stop with no
// monitors rather than as a healthy one.
export const worstCsoState = (states: CsoState[]): CsoState | null => {
  let worst: CsoState | null = null;
  for (const state of states) {
    if (
      worst === null ||
      CSO_STATE_ORDER.indexOf(state) < CSO_STATE_ORDER.indexOf(worst)
    ) {
      worst = state;
    }
  }
  return worst;
};

// The states worth showing unprompted. The rest are collapsed behind a
// disclosure, since "nothing is happening at 12 outfalls" is reassurance
// rather than news and shouldn't cost twelve rows of the page to say.
export const CSO_NOTABLE_STATES: CsoState[] = ["Ongoing", "Recent"];
export const CSO_QUIET_STATES: CsoState[] = ["Not discharging", "Offline"];

// The `sx` that makes a default MUI Chip carry an exact status colour. It has
// to go through custom properties rather than `backgroundColor`/`color`: the
// theme's dark-scheme chip rule is emitted under a `.dark` ancestor selector,
// which outranks the single class an `sx` background compiles to, so a direct
// colour would be silently dropped in dark mode only. See the MuiChip
// override in lib/themes.ts.
export const statusChipSx = (state: CsoState) => ({
  "--chip-bg": CSO_STATE_UI[state].color,
  "--chip-fg": CSO_STATE_UI[state].onColor,
  fontWeight: 500,
});
