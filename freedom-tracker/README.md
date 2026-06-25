# Global Freedom Tracker — Democracy & Press Freedom

A React + Flask rebuild of the original Dash dashboard, restyled around your
Figma design with a custom design system (Newsreader/Inter/IBM Plex Mono
type pairing, light + dark themes, and a signature "insight rail" sidebar).

## Architecture

```
freedom-tracker/
├── backend/              ← Flask API, serves JSON only
│   ├── app.py             ← all 5 endpoints (meta, map, countries, correlation, summary)
│   ├── data.py             ← YOUR existing merge logic (drop in your copy)
│   ├── democracy_index.csv         ← YOUR raw data (drop in your copy)
│   ├── press_freedom_index.csv     ← YOUR raw data (drop in your copy)
│   ├── democracy_press_freedom_data.csv  ← pre-merged data (drop in your copy, or it auto-builds from the two above)
│   └── requirements.txt
└── frontend/              ← React + Vite, Recharts, react-simple-maps
    └── src/
        ├── App.jsx
        ├── ThemeContext.jsx
        ├── api.js
        ├── components/    ← TopBar, TabNav, StatCard, InsightPanel
        ├── pages/         ← GlobalMapPage, CountryTrendsPage, CorrelationPage, DataSummaryPage
        └── styles/        ← tokens.css (design system), layout.css, components.css
```

## What you need to do before running

Copy your **existing** `data.py`, `democracy_index.csv`, `press_freedom_index.csv`,
and `democracy_press_freedom_data.csv` files into the `backend/` folder. The
Flask app reads these exactly the same way your original `main.py` did —
nothing about your data logic changed, only how it's served (JSON instead of
server-rendered Dash components).

## Running it

**Terminal 1 — backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Runs on `http://localhost:5000`.

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173` and proxies `/api/*` requests to the Flask
backend automatically (configured in `vite.config.js`).

Open `http://localhost:5173` in your browser.

## Design system

- **Display type** (big numbers, panel titles): Newsreader, a serif with
  editorial/data-journalism character — distinct from generic dashboard sans-serifs.
- **Body/UI type**: Inter.
- **Data/figures**: IBM Plex Mono — every score, rank, and stat card value
  uses this so numbers visually read as "precise data" against prose.
- **Color**: blue accent (`#2D7DD2`) matching your Figma, navy for emphasis,
  red/green/amber semantic tones for decline/improvement/neutral insights.
- **Signature element**: the "Key Insights" sidebar uses a vertical rail with
  colored marker dots (not plain boxed text) — reinforces the dashboard's
  core theme of tracking change over time, even in a static sidebar.
- **Dark mode**: full theme via CSS variables, toggled with the moon/sun icon
  top-right. No page reload, no flash.

## API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/meta` | Global stats for default stat-card footer |
| `GET /api/map?year=&metric=` | Map data + year-over-year movers for Global Map tab |
| `GET /api/countries` | List of all countries for the dropdown |
| `GET /api/country/<name>` | Full time series + computed insights for one country |
| `GET /api/correlation?year=` | Scatter data, Pearson r, R², OLS trendline |
| `GET /api/summary` | Histograms, top/bottom 10 rankings, dataset-wide stats |

All numeric values are explicitly cast to native Python types before
serialization (see `NumpyJSONProvider` in `app.py`) — pandas/numpy scalar
types aren't JSON-serializable by default and this was caught and fixed
during testing.

## What's contextual per tab (per your brief)

- **Sidebar insights** — different on every tab, computed from whatever data
  is currently shown (selected country, selected year, etc.)
- **Stat card footer** — also contextual per tab (not a static repeated
  footer): Global Map shows global stats, Country Trends shows that
  country's stats, Correlation shows the statistical summary, Data Summary
  shows dataset-wide totals.
- **Data Summary tab** — fully custom layout (histograms + ranking tables),
  no Figma reference was provided for this page.
