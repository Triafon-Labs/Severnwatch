# Severnwatch

A dashboard for river water quality conditions on the River Severn at Worcester, UK: combined sewer overflow (CSO) spill status, upstream rainfall, and citizen science water quality data.

Sibling project to [Paddlecheck](https://github.com/dylanr97/Paddlecheck) (the Worcester Canoe Club kayaking conditions app) — shares its tech stack, Material Design 3 theme and release conventions, but is a separate app with its own scope.

## Tech Stack

| Layer         | Technology                                                                    |
| ------------- | ----------------------------------------------------------------------------- |
| Framework     | Next.js 16 (App Router, Turbopack)                                            |
| Library       | React 19                                                                      |
| Language      | TypeScript 6 (strict mode)                                                    |
| UI Library    | Material UI (MUI) 7 + Emotion, themed to Material Design 3                    |
| Charts        | Recharts 3                                                                    |
| Date handling | date-fns 4                                                                    |
| PWA           | Web manifest + hand-rolled service worker                                     |
| Linting       | ESLint 10, Prettier 3                                                         |
| Git hooks     | Husky 9 + commitlint (Conventional Commits)                                   |
| CI            | GitHub Actions (lint + build on PR, opt-in uptime + health ping)              |
| Releases      | commit-and-tag-version (auto version bump + changelog + tag on merge to main) |

Node 22 or newer is required (`engines.node` in `package.json`, and what both CI workflows pin).

## Data Sources

| Data                          | Source                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| CSO spill status              | Severn Trent Water Storm Overflow Activity feed (public ArcGIS FeatureServer)              |
| Rainfall                      | Environment Agency real-time rainfall network (`environment.data.gov.uk/flood-monitoring`) |
| Rainfall forecast             | Open-Meteo (single point for Worcester)                                                    |
| Citizen science water quality | Surfers Against Sewage (SAS) CSV export, downloaded by hand into `data/water-quality/`     |

There's no database. Spills and rainfall are fetched live server-side and displayed, and responses are mirrored into `localStorage` purely as an offline fallback.

The one exception is the Grandstand Road sample results. SAS has no public API for them, so the CSV export is committed to `data/water-quality/` and read at build time. See [`data/water-quality/README.md`](data/water-quality/README.md) for how to add new results.

## Getting Started

```bash
npm install
npm run dev
```

No environment variables are needed.

## Commits and Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and are enforced by a `commit-msg` hook. Merging to `main` triggers `auto-tag.yml`, which bumps the version, writes `CHANGELOG.md` and pushes a `severnwatch-vX.Y.Z` tag — `feat:` for a minor bump, `fix:`/`perf:`/`refactor:` for a patch.

## Design System

The interface is Material Design 3, built as a single MUI theme carrying both colour schemes as CSS variables:

- `lib/statusColors.ts` — the status colour vocabulary (red/amber/yellow/green/grey), deliberately scheme-independent so a spill reads the same colour in either theme
- `lib/m3-palette.ts` — M3 tonal tokens for both schemes, seeded from the brand teal `#006C7F`, plus M3 Expressive motion springs
- `lib/themes.ts` — the type scale, transitions and every component override

See `AGENTS.md` for the rules that the rest of the code relies on (tonal surfaces vs state layers, why dark-scheme overrides out-specify `sx`, how colours reach Recharts).

## Directory Structure

```
app/
  api/            Server-side routes proxying/shaping external API data
  layout.tsx      Root layout - ThemeRegistry, data provider, safe-area frame
  page.tsx        Home page
  manifest.ts     PWA web manifest
  globals.css     Global resets only

components/       UI components, one concern per file

lib/
  config.ts       Catchment waypoints, gauge IDs, API endpoints, links
  hooks.ts        useSevernData - all fetching, caching and offline state
  themes.ts       MUI theme (Material Design 3, light/dark/system)

types/
  index.ts        Shared TypeScript types

docs/             Reference documents (e.g. bathing water classification explainer)
```
