# Severnwatch

A water quality dashboard for the River Severn at Worcester, UK. It shows a pollution risk rating built from live sewage overflow (CSO) spill reports, rainfall upstream and weekly citizen science water samples.

Sibling project to [Paddlecheck](https://github.com/Triafon-Labs/Paddlecheck), the Worcester Canoe Club paddling conditions app. The two share a tech stack, design and release setup, but they're separate apps.

> **Note:** This is primarily a hobby project, vibe coded for fun. Expect rough edges, and feel free to use it as inspiration for your own projects.

> **Safety:** Severnwatch is an unofficial guide. Its pollution risk is an estimate from spill reports, rainfall and volunteer samples, so it can't tell you the water is clean. Outfalls without a monitor never show up, and monitors can be offline or wrong. Use your own judgement before going in or on the river.

## Features

- **Pollution risk**: High, Raised or Low, with the reasons behind it
- **Sewage overflows**: every monitored outfall on the Severn from Bewdley down to Worcester, and on the Stour and Salwarpe, drawn as a river diagram, with which are spilling now, which spilled recently and which monitors are offline
- **Rainfall**: three Environment Agency gauges upstream, the last 7 days, plus a 48-hour forecast
- **Latest sample and sample history**: E. coli and Enterococci from the Surfers Against Sewage (SAS) volunteers at Grandstand Road, graded against the inland bathing water limits
- **Rain vs Water Quality**: each sample plotted against the rain, spills or river flow in the days before it
- **Share** a text summary of the current risk
- **PWA**: installable on a phone's home screen, and opens offline with the last data it fetched
- **Light/dark/system theme**

## How It Works

The browser only talks to the app's own API routes. Each route fetches its source server-side and caches the result for 15 minutes, so the number of visitors doesn't change how often the upstream services are hit.

| Data                         | Source                                                                                                                       | Key needed |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- |
| CSO spill status             | Severn Trent Water's public storm overflow feed (ArcGIS)                                                                     | No         |
| Outfall place names          | [Nominatim](https://nominatim.org/) (OpenStreetMap), cached for 30 days                                                      | No         |
| Rainfall                     | [Environment Agency flood-monitoring API](https://environment.data.gov.uk/flood-monitoring/doc/rainfall), 15-minute readings | No         |
| Rainfall forecast            | [Open-Meteo](https://open-meteo.com/), one point for Worcester                                                               | No         |
| Rain and flow before samples | [Environment Agency Hydrology API](https://environment.data.gov.uk/hydrology/doc/reference), rain gauges and Bewdley flow    | No         |
| Water samples                | SAS's Water Quality Surveys CSV export, uploaded by hand each week (SAS has no API)                                          | No         |

The risk rating:

- **High**: a monitored outfall in Worcester (Bevere to Diglis) is discharging now, or a Poor sample was taken in the last 2 days.
- **Raised**: water from a spill upstream is estimated to be passing Worcester or still on its way (at about 0.7 km/h), a spill stopped in the last 48 hours, 5 mm or more of rain has fallen or is forecast over 6 hours (or 4 mm/hr in a burst), or a Poor sample was taken in the last 7 days.
- **Low**: none of the above.

If one source fails, the others still load, and the browser falls back to its own last copy of the one that failed.

There's no database. The exceptions are the uploaded sample CSVs and the app's own hourly record of spills and rainfall (used by the Rain vs Water Quality card), both kept in a private [Vercel Blob](https://vercel.com/docs/vercel-blob) store.

## Tech Stack

- [Next.js](https://nextjs.org/) 16 (App Router) and React 19
- [Material UI (MUI)](https://mui.com/), themed to Material Design 3
- [TypeScript](https://www.typescriptlang.org/)
- [Recharts](https://recharts.org/): charts
- [Vercel Blob](https://vercel.com/docs/vercel-blob): uploaded samples and the spill record
- A small hand-written service worker (`public/sw.js`) for offline support

There's no login and no automated test suite.

## Getting Started

### Prerequisites

- Node.js v22 or later (matches CI and `engines.node` in `package.json`)
- npm
- Git

### Installation

```bash
git clone https://github.com/Triafon-Labs/Severnwatch.git
cd Severnwatch
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Everything works with no environment variables, apart from the sample cards: no samples are committed (the SAS exports name the volunteers), so they're empty until you upload one. The spill record is kept in `data/risk-history/` (gitignored).

To try the upload page locally, put `UPLOAD_PASSCODE=anything` in `.env.local` and restart. Uploads then go to `data/water-quality/uploads/` (also gitignored).

### Commands

```bash
npm run dev     # Development server at http://localhost:3000
npm run build   # Production build
npm start       # Serve the production build
npm run lint    # ESLint
```

The service worker only registers in a production build, so use `npm run build && npm start` to test offline behaviour or installing the app.

## Adding Water Samples

Each week a tester downloads the SAS export and uploads it at `/upload` (also linked from **Settings → Info → For Testers**). The page checks the file, says how many samples are new, and the site shows them within a minute with no redeploy. [`data/water-quality/README.md`](data/water-quality/README.md) covers which file to download, what's read from it, and how to undo a bad upload.

## Using It Elsewhere

Severnwatch is built for one place and isn't designed to be adapted. Everything location-specific is in `lib/config.ts`: the river's waypoints and branches that decide which outfalls count, the rain gauges, the SAS sampling site and the travel-time model. Moving it to another river means redoing all of that by hand. The spill feed is Severn Trent's alone; other water companies publish theirs separately, in different formats. Forks are welcome, but you'd be on your own.

[`AGENTS.md`](AGENTS.md) is the full technical reference: how data flows, how the risk and spill record work, and the design system rules. It's written for AI coding assistants, but reads fine for people too.

## Hosting

The app needs a server (the API routes fetch and cache the data), so a static host such as GitHub Pages won't work.

### Vercel (recommended)

1. Sign in to [Vercel](https://vercel.com) with GitHub, **Add New → Project**, and import the repository.
2. Deploy. It builds and runs with no settings.
3. For uploads and the spill record, connect a Blob store (**Storage → Create → Blob**, **Private** access). That sets `BLOB_READ_WRITE_TOKEN` for you.
4. For uploads, also set `UPLOAD_PASSCODE` under **Settings → Environment Variables**, then redeploy.

Until steps 3 and 4 are done, `/upload` says uploads aren't set up, and the sample cards are empty.

The app includes [Vercel Web Analytics](https://vercel.com/docs/analytics) and [Speed Insights](https://vercel.com/docs/speed-insights). They do nothing until you enable them in the Vercel dashboard. To remove them, delete `<Analytics />` and `<SpeedInsights />` from `app/layout.tsx`. Vercel's free Hobby plan is for personal, non-commercial use; check [their terms](https://vercel.com/docs/limits/fair-use-guidelines).

### Elsewhere

Any host that runs Node 22 works for the live data. Uploads and the spill record are written for Vercel Blob, so off Vercel they fall back to local folders, which only make sense on a server with a persistent disk. Serve the site over HTTPS, or the service worker won't register.

## GitHub Actions in a Fork

GitHub turns Actions off in a new fork until you enable them on the **Actions** tab. Once on:

| Workflow         | What it does                                                                                                                                  | In your fork                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`         | Lint and build on every push and pull request                                                                                                 | Keep it                                                                                                                                            |
| `auto-tag.yml`   | On every push to `main`, bumps the version, updates `CHANGELOG.md` and pushes a tag                                                           | Skips itself – it only runs in this repository                                                                                                     |
| `keep-alive.yml` | Every 15 minutes, checks the site and its API routes return data (a failed run sends you a GitHub notification) and records the hour's spills | Add a repository variable `SITE_URL` with your site's address (Settings → Secrets and variables → Actions → Variables). Until then it skips itself |

Dependabot is [off by default in forks](https://github.blog/changelog/2022-11-07-dependabot-pull-requests-off-by-default-for-forks/), and best left that way.

## Development Notes

- Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`, `fix: ...`); a Git hook rejects anything else. The version bump and changelog are generated from them. A `Release-As: x.y.z` footer sets the next version outright.
- UK English throughout ("colour", "licence").
- All times are handled in `Europe/London` (`lib/time.ts`).

## Data Sources and Licences

The About section of the Settings sheet carries the credits these licences ask for. Keep it if you change that screen. If you deploy your own copy, you're responsible for meeting each source's terms:

- **Environment Agency** data is under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/), which requires the statement: _"This uses Environment Agency flood and river level data from the real-time data API (Beta)."_
- **Severn Trent Water**'s storm overflow data is under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit Severn Trent.
- **Open-Meteo**'s free API is for [non-commercial use](https://open-meteo.com/en/terms), with data under CC BY 4.0. Credit Open-Meteo.
- **Nominatim** place names are OpenStreetMap data under the [ODbL](https://www.openstreetmap.org/copyright), credited as "© OpenStreetMap contributors". Its [usage policy](https://operations.osmfoundation.org/policies/nominatim/) limits requests to one a second, which the app keeps to.
- **Surfers Against Sewage** samples are volunteers' citizen science results, credited to SAS. The exports include the surveyors' names, so they're kept in the private Blob store, not in this repository. The app doesn't read or show those names.

## Licence

[MIT](LICENSE). You can use, change and redistribute this freely, as long as the licence notice stays with the code.
