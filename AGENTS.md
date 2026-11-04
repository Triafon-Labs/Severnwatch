<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

<!-- Everything below this point is project-owned. The two comment markers
     above delimit the Next.js-managed section; per Next's own guide
     (node_modules/next/dist/docs/01-app/02-guides/ai-agents.md) content
     outside them is not overwritten when that block is updated, so this
     reference is safe to keep in the same file. Do not move the markers. -->

# Severnwatch – Agent Reference

## Project Overview

Severnwatch is a Progressive Web App showing River Severn water quality
conditions at Worcester, UK: combined sewer overflow (CSO) spill status,
upstream rainfall with a short forecast, and citizen science water quality
sampling. There is no database and no persistence. Spill and rainfall
readings are fetched live from public APIs through Next.js routes. The
Grandstand Road sample results are the exception: SAS has no API for them, so
their CSV export is committed to `data/water-quality/` and parsed at build
time (see that folder's README).

Sibling project to [Paddlecheck](https://github.com/dylanr97/Paddlecheck) (the
Worcester Canoe Club kayaking conditions app). The two share a tech stack, a
design system, and a release pipeline, but are separate apps with separate
scopes. **Location hardcoded to:** Worcester, UK (lat 52.2, lon -2.2).

---

## Tech Stack

| Layer         | Technology                                                                     |
| ------------- | ------------------------------------------------------------------------------ |
| Framework     | Next.js 16 (App Router, Turbopack)                                             |
| Library       | React 19                                                                       |
| Language      | TypeScript 6 (strict mode)                                                     |
| UI Library    | Material UI (MUI) 7 + Emotion, themed to Material Design 3                     |
| Charts        | Recharts 3                                                                     |
| Date handling | date-fns 4                                                                     |
| PWA           | Web manifest (`app/manifest.ts`) + hand-rolled service worker (`public/sw.js`) |
| Linting       | ESLint 10, Prettier 3                                                          |
| Git hooks     | Husky 9 + commitlint (Conventional Commits)                                    |
| CI            | GitHub Actions (lint + build on PR, opt-in uptime + health ping)               |
| Releases      | commit-and-tag-version (auto version bump + changelog + tag on merge to main)  |

No environment variables are required for local development.

---

## Design System

The whole visual language is Material Design 3, implemented as one MUI theme.
Three files carry it, and they are the first thing to read before changing
anything that has a colour in it:

| File                  | What it holds                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `lib/statusColors.ts` | The five status hues (red/amber/yellow/green/grey) and their on-colours. Scheme-independent by design.             |
| `lib/m3-palette.ts`   | M3 tonal tokens for both schemes, seeded from the brand teal `#006C7F`, plus the motion springs/easings/durations. |
| `lib/themes.ts`       | One MUI theme carrying both schemes as CSS variables: type scale, transitions, and every component override.       |

Rules that the code depends on:

- **Reach for palette roles, not hex.** Tonal surfaces are on the palette as
  `surfaces.*` (`bgcolor: "surfaces.containerHigh"`), and every accent role has
  an M3 container pair (`bgcolor: "error.container"`, `color: "error.onContainer"`).
- **Never use `action.hover` as a resting background.** It is a state layer —
  an overlay M3 reserves for expressing interaction — so a panel painted with
  it reads as permanently hovered. Use a `surfaces.*` step instead.
- **Cards are elevation 0** (set as a default prop). Anything that lands on
  MUI elevation 1–4 gets `surfaceContainerHigh` from the `MuiPaper` override,
  which is the same tone the panels _inside_ a card use, so the nesting
  flattens.
- **Dark-scheme overrides out-specify `sx`.** `theme.applyStyles("dark", …)`
  compiles to a selector with a `.dark` ancestor, which beats the single class
  an `sx` colour compiles to. A colour set in `sx` can therefore apply in light
  mode and be silently dropped in dark. Where a call site genuinely needs its
  own exact colour (status chips), it goes through the `--chip-bg`/`--chip-fg`
  custom properties the `MuiChip` override reads.
- **Colours handed to Recharts** are read off `theme.palette` in JS, since SVG
  attributes can't take CSS variables. That read is only correct in dark mode
  because the provider sets `forceThemeRerender` (see `lib/ThemeContext.tsx`).
- **Motion** comes from `spring()` / `m3Spring` / `collapseMotion` in
  `lib/m3-palette.ts`, not from hand-written durations. `prefers-reduced-motion`
  is honoured globally in the `MuiCssBaseline` override.

---

## Directory Structure

```
app/
  api/
    sewage/             Severn Trent storm overflow feed, filtered to the catchment
    rainfall/           EA rainfall gauges + Open-Meteo forecast
    water-quality/      SAS sample CSVs from data/water-quality/, prerendered at build
  layout.tsx            Root layout – ThemeRegistry, data provider, safe-area frame
  page.tsx              Home page – the cards
  globals.css           Global resets only; type and colour come from the theme
  manifest.ts           PWA web manifest

components/
  TopNavBar.tsx              App bar – share, settings, refresh, freshness, banners
  SettingsModal.tsx          Bottom sheet – theme, links, conditions key, deep dive, version
  ConditionsKey.tsx          Legend for the status colours, map markers and chart bands
  PollutionRiskCard.tsx      Headline pollution risk, derived from spills + rainfall
  CsoListCard.tsx            Live/recent spills, then the network as a river diagram
  RiverSchematic.tsx         Transit-map view of the catchment, stops in downstream order
  CsoOutfallRow.tsx          One outfall as a labelled row, shared by both of the above
  RainfallCard.tsx           Gauge stats, chart, change tiles
  RainfallChart.tsx          Recharts intensity/daily/forecast views
  LatestSampleCard.tsx       Newest Grandstand Road sample – counts, notable findings, tester's note
  SampleHistoryCard.tsx      Every sample – indicator toggle, stats, full table
  SampleHistoryChart.tsx     Recharts history of one indicator, against the limits
  SampleBandChip.tsx         A sample's low/elevated/high band as a status chip
  WaterQualityMap.tsx        SAS citizen science map embed + explainer
  WaterQualityExplainer.tsx  Classification bands disclosure
  WaterQualityInfoContent.tsx  Threshold tables + deep dive copy (shared)
  InfoPanel.tsx              Shared tonal panel, optionally a button
  StatTile.tsx               Labelled-figure tile (icon + label, value, detail) – gauges, periods, risk factors
  SlidingToggleButtonGroup.tsx  Segmented control with a sliding pill
  SevernwatchLogo.tsx        Wave glyph, matching the installed app icons
  ThemeRegistry.tsx          Emotion cache + AppThemeProvider for SSR
  ServiceWorkerRegistration.tsx  Registers public/sw.js in production

lib/
  config.ts             Catchment waypoints + river branches, gauge IDs, endpoints, links
  hooks.ts              useSevernData – all fetching, caching, offline state
  SevernDataContext.tsx React Context wrapping the hook
  csoStatus.ts          CSO state → label/colour/severity, in one place
  pollutionRisk.ts      Derived high/raised/lower risk from spill timing, rainfall + latest sample
  waterQuality.ts       Sample bands against the bathing water limits, formatting, findings, stats
  waterQualityCsv.ts    Server-only: reads + validates the SAS CSV export(s), merges by Feature ID
  rainfall.ts           EA rainfall fetching and shaping
  rainfallAnalysis.ts   Intensity/daily buckets, trailing sums, forecast total
  catchment.ts          Nearest-waypoint filtering (which waypoint, and how far)
  riverSchematic.ts     Outfalls -> the river diagram's rows, lanes and confluences
  statusColors.ts       The status colour vocabulary
  chartColors.ts        Chart series colours (kept out of the recharts chunk)
  chartMotion.ts        Chart entrances in CSS (lines wipe in) instead of recharts' JS animation
  m3-palette.ts         M3 tonal tokens + motion tokens
  themes.ts             The MUI theme
  ThemeContext.tsx      Colour-scheme provider/hooks (light/dark/system)
  storageKeys.ts        Canonical localStorage key names
  time.ts               Europe/London formatting helpers
  londonDate.ts         London calendar-day helpers (React-free, so the server route can use them)
  format.ts             Duration and "data as of" formatting
  useTooltipDismiss.ts  Closes a recharts tooltip on an outside press

types/
  index.ts              All shared TypeScript types

data/
  water-quality/        Hand-downloaded SAS CSV exports + README on adding them

public/                 Static assets – icons, favicon, sw.js (offline shell)
docs/                   Reference documents
```

---

## Key Files to Understand First

| File             | Why                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------- |
| `lib/config.ts`  | Every location constant – catchment waypoints, gauge IDs, endpoints, outbound links |
| `lib/hooks.ts`   | Entry point for all data – fetch, cache, offline fallback, staleness, state shape   |
| `lib/themes.ts`  | Why every component looks the way it does                                           |
| `types/index.ts` | The full type vocabulary – read this before touching any data flow                  |
| `app/page.tsx`   | The single page – which cards exist and in what order                               |

---

## Data Sources

| Data                          | Source                                                                                     | Notes                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| CSO spill status              | Severn Trent Water Storm Overflow Activity feed (public ArcGIS FeatureServer)              | No key; filtered to the catchment corridor              |
| Outfall place names           | Nominatim reverse geocoding                                                                | Only for Ongoing/Recent, capped by `SEWAGE_MAX_RESULTS` |
| Rainfall                      | Environment Agency real-time rainfall network (`environment.data.gov.uk/flood-monitoring`) | 15-min readings, three gauges                           |
| Rainfall forecast             | Open-Meteo `api.open-meteo.com/v1/forecast`                                                | Single point for Worcester, not per-gauge               |
| Citizen science water quality | Surfers Against Sewage Water Quality map (Cartographer embed)                              | UK-wide, embedded as-is                                 |
| Grandstand Road samples       | SAS CSV export, committed to `data/water-quality/`                                         | No API; updated by hand. Static route, built at deploy  |

---

## State Management

`lib/hooks.ts` contains `useSevernData()`, the single source of truth, wrapped
in Context by `lib/SevernDataContext.tsx` so the cards and the nav bar all read
one fetch rather than three.

```ts
{
  cso: CsoResponse | null
  rainfall: RainfallResponse | null
  waterQuality: WaterQualityResponse | null
  csoError: boolean          // that source failed AND had no cache to fall back on
  rainfallError: boolean
  waterQualityError: boolean
  loading: boolean           // true only when there is genuinely nothing to render
  isRefreshing: boolean      // any fetch in flight
  isOffline: boolean
  usingCachedData: boolean
  lastUpdated: string | null // newest asOf across the live sources (not water quality)
  error: string | null       // set only when offline with no cache at all
  refetch: () => void
}
```

The three sources are fetched independently, each falling back to its own
`localStorage` copy on failure, so one feed blipping doesn't discard data that
arrived fine from the other.

There is **no background poll**, matching Paddlecheck. Data is fetched on load,
on a manual refresh, and when the reader comes back to the app — tab shown,
window focused, signal regained, or page restored from the back/forward cache —
with data older than 5 minutes (the sewage route's cache window). Every fetch
puts the cards into their skeletons (they read `isRefreshing`), so the
skeletons clearing means what's on screen just came from the network; a poll
would blank the page under whoever was reading it.

Freshness is communicated by the nav bar's "Updated HH:MM (n min ago)" line,
the "As of" caption under the rainfall chart (the age of the newest gauge
reading, which the EA typically receives only once or twice a day), and a
banner above the app bar. That banner says "Live update failed" only when a
fetch actually fell back to the cache; data that is merely past
`DATA_STALE_THRESHOLD_MS` because nobody has refreshed gets "Showing data from
… – refresh for the latest" instead.

---

## Local Storage Keys

Canonical names live in `lib/storageKeys.ts`.

| Key                            | Value                                                     |
| ------------------------------ | --------------------------------------------------------- |
| `themeMode`                    | `"light"` \| `"dark"` \| `"system"` (read/written by MUI) |
| `rainfallRange`                | `"forecast"` \| `"1h"` \| `"8h"` \| `"24h"` \| `"7d"`     |
| `severnwatch_csoData`          | Last successful `/api/sewage` response                    |
| `severnwatch_rainfallData`     | Last successful `/api/rainfall` response                  |
| `severnwatch_waterQualityData` | Last successful `/api/water-quality` response             |
| `sampleHistoryIndicator`       | `"eColi"` \| `"enterococci"`                              |

---

## Timezone & Localization

- All time-based logic and comparisons with external API data use the
  **`Europe/London`** timezone, to stay consistent with the Worcester location.
  Helpers are in `lib/time.ts`; don't reach for the runtime's local zone.
- The project adheres to **UK English** spelling (e.g. 'Licence', 'Customise',
  'Colour').

---

## Development Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint check
```

Pre-commit lint runs via Husky. A `commit-msg` hook also runs commitlint,
rejecting commits whose first line isn't a valid Conventional Commit
(`type: subject`, type one of `feat`/`fix`/`perf`/`refactor`/`docs`/`chore`/
`style`/`test`/`build`/`ci`/`revert`). Merge commits are exempt.

---

## CI Pipeline

- **ci.yml** – runs `lint` then `build` on every push/PR to `main` (Node 22)
- **auto-tag.yml** – on every push to `main` (i.e. right after a PR merges),
  runs `commit-and-tag-version` to bump `package.json`'s version, update
  `CHANGELOG.md`, commit both directly to `main`, and push a
  `severnwatch-vX.Y.Z` tag. No release PR, no approval step. `feat:` commits
  get a minor bump, `fix:`/`perf:`/etc. get a patch bump with a changelog
  entry, and a `BREAKING CHANGE:` footer bumps major. The job skips itself when
  the triggering commit is its own `chore(release): ...` commit, to avoid a
  loop.
- **keep-alive.yml** – every 5 minutes, pings the deployed site and asserts
  that both API routes still return usable data. It is **inert until a
  repository variable named `SITE_URL` is set**, so it does nothing on a repo
  that isn't deployed yet. The 5-minute cadence matches the sewage route's own
  `revalidate` window, so each ping rebuilds that cache as it expires — worth
  doing because a cold rebuild reverse-geocodes sequentially at 1 request per
  second and can take ~15s. It deliberately does **not** assert on `asOf`:
  both routes stamp that with the time they built the response, not the time
  the readings were collected, so it is fresh by construction.

`ci.yml` and `auto-tag.yml` install through `.github/actions/npm-install`
rather than calling `npm ci` directly. See below for why. (`keep-alive.yml`
only curls the public site and checks out nothing.)

The Node version is pinned to 22 in both workflows and declared as
`engines.node` in `package.json`, which is also what Vercel reads when picking
a build image. Node 20 reached end of life in April 2026, and parts of the
release toolchain already require `node >=22`. Keep the two workflows, the
`engines` field, and the README in step with each other.

`ci.yml` cancels superseded runs on the same ref. `auto-tag.yml` deliberately
does **not** cancel: releases are queued one at a time so two quick merges
cannot bump from the same base and race each other's tag push.

### Dependabot and the lockfile

Dependabot regenerates `package-lock.json` with its own resolver, and that
resolver does not write **nested optional peer dependencies** that npm itself
installs ([dependabot-core#6317](https://github.com/dependabot/dependabot-core/issues/6317)).
`npm ci` then rejects the lockfile as out of sync and the PR fails on a build
error that has nothing to do with the package being bumped.

Two things keep this from recurring:

1. **`conventional-commits-filter` and `conventional-commits-parser` are direct
   `devDependencies`.** Nothing in this repo imports them. They are declared so
   that npm resolves them at the top level instead of nesting them under
   `@commitlint/read` to satisfy the optional peer dependencies of
   `@conventional-changelog/git-client`. A nested optional peer is the exact
   shape Dependabot drops; a direct dependency is one it must keep. Removing
   these two entries as "unused" reintroduces the failure —
   `commit-and-tag-version` pulls in the older v3/v4 line of the same packages,
   which is what forces the nesting.
2. **`.github/actions/npm-install` heals an out-of-sync lockfile** rather than
   failing, but only for Dependabot's own runs (and always in `auto-tag.yml`).
   For anyone else a lockfile that does not match the manifest is still a hard
   error, because there it means the lockfile was not committed.

Related: the `postcss` entry under `overrides` is bounded to `^8.5.10` rather
than `>=8.5.10`. An override replaces the range **every** package in the tree
asked for, so an open-ended `>=` would pull in a future postcss 9 the day it
ships and hand it to Next's build with nothing to catch it. Keep overrides
bounded to a major.

---

## Troubleshooting Husky Hooks

If Git hooks are not firing:

1. Run `npm install`.
2. Check if `.husky/_` exists and contains the hook wrappers.
3. Verify `git config core.hooksPath` is set to `.husky/_`.

---

## What This Project Does Not Have

- No database and no historical ingestion — everything is live-fetched, apart
  from the hand-committed sample CSVs in `data/water-quality/`
- No authentication
- No automated tests (Jest/Vitest/Playwright)
- No environment variables required
- No multi-location support (hardcoded to Worcester)
- No analytics
