# Severnwatch

A dashboard for river water quality conditions on the River Severn at Worcester, UK: combined sewer overflow (CSO) spill status, upstream rainfall, and citizen science water quality data.

Sibling project to [Paddlecheck](https://github.com/dylanr97/Paddlecheck) (the Worcester Canoe Club kayaking conditions app) - shares its tech stack and conventions, but is a separate app with its own scope.

## Tech Stack

| Layer      | Technology                    |
| ---------- | ------------------------------ |
| Framework  | Next.js 16 (App Router)        |
| Library    | React 19                       |
| Language   | TypeScript 6 (strict mode)     |
| UI Library | Material UI (MUI) 7 + Emotion  |
| Date handling | date-fns 4                  |
| Linting    | ESLint 10, Prettier 3          |

## Data Sources

| Data                          | Source                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| CSO spill status               | Severn Trent Water Storm Overflow Activity feed (public ArcGIS FeatureServer)             |
| Rainfall                       | Environment Agency real-time rainfall network (`environment.data.gov.uk/flood-monitoring`) |
| Citizen science water quality  | Surfers Against Sewage (SAS) Water Quality map (Cartographer embed)                        |

There's no database - everything is fetched live server-side and displayed. No persistence, no historical ingestion.

## Getting Started

```bash
npm install
npm run dev
```

## Directory Structure

```
app/
  api/            Server-side routes proxying/shaping external API data
  layout.tsx       Root layout - ThemeRegistry, TopNavBar
  page.tsx         Home page
  globals.css      Global resets and Roboto Flex font

components/        UI components, one concern per file

lib/
  config.ts         Station IDs, catchment definitions, API endpoints
  theme.ts           MUI theme (light/dark via system preference)

types/
  index.ts           Shared TypeScript types

docs/               Reference documents (e.g. bathing water classification explainer)
```
