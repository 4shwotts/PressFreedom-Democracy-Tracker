# Global Press Freedom & Democracy Tracker

A full-stack data visualisation dashboard tracking democracy and press freedom scores across 161 countries from 2013 to 2023.

**Live demo:** [press-freedom-democracy-tracker.vercel.app](https://press-freedom-democracy-tracker.vercel.app)

---

## Overview

The dashboard visualises two independent datasets — V-Dem democracy scores (0–10) and Reporters Without Borders press freedom scores (0–100) — merged across a shared country/year index. Four tabs offer different analytical lenses on the same underlying data.

---

## Features

- **Global Map** — choropleth world map showing either metric by country for any year in the dataset. Colour scale runs dark red (lowest) to dark navy (highest). Supports zoom and pan.
- **Country Trends** — dual-axis line chart tracking how a selected country's democracy and press freedom scores have changed over the full period of available data, with automated contextual insights.
- **Correlation** — scatter plot showing the statistical relationship between democracy and press freedom scores, with a fitted OLS trendline, Pearson r, and R². Supports year filtering.
- **Data Summary** — score distribution histograms and top/bottom 10 country rankings based on a combined freedom index.

Each tab has a sidebar that generates contextual insights from the current data — most improved country, sharpest decline, global standing, explained variance, and so on.

---

## Tech stack

**Frontend**
- React 18 + Vite
- Recharts (line chart, scatter plot, bar chart)
- react-simple-maps + d3-scale (choropleth world map)
- CSS custom properties for design system and full dark/light mode

**Backend**
- Python / Flask
- pandas + numpy (data processing and aggregation)
- flask-cors
- gunicorn (production server)

**Data**
- ~1,732 country-year observations
- Democracy scores: V-Dem dataset (0–10 scale)
- Press freedom scores: Reporters Without Borders (0–100 scale)

---

## Design

- Inter (UI), Newsreader (display headings), IBM Plex Mono (data figures)
- Accent colour: `#2D7DD2`
- Light mode default with full dark mode via CSS variables
- Insight sidebar uses a vertical timeline rail with coloured marker dots

---

## Running locally

**Prerequisites:** Node.js 18+, Python 3.10+

**Backend**
```bash
cd freedom-tracker/backend
pip install -r requirements.txt
python app.py
```
Runs on `http://localhost:5000`

**Frontend**
```bash
cd freedom-tracker/frontend
npm install
npm run dev
```
Runs on `http://localhost:5173` — Vite proxies `/api` requests to Flask automatically.

---

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/meta` | Global stats (country count, year range, top/bottom country) |
| `GET /api/map?year=&metric=` | Per-country scores and year-on-year changes for the map |
| `GET /api/countries` | Sorted list of all country names |
| `GET /api/country/:name` | Full time series and stats for one country |
| `GET /api/correlation?year=` | Scatter data, Pearson r, R², OLS trendline |
| `GET /api/summary` | Histograms, top/bottom 10 rankings, dataset totals |

---

## Project structure

```
freedom-tracker/
├── backend/
│   ├── app.py                        # Flask API
│   ├── data.py                       # Data merge and cleaning logic
│   ├── democracy_index.csv           # Raw V-Dem democracy dataset
│   ├── press_freedom_index.csv       # Raw RSF press freedom dataset
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/                    # GlobalMapPage, CountryTrendsPage, CorrelationPage, DataSummaryPage
        ├── components/               # TopBar, TabNav, StatCard, InsightPanel
        ├── styles/                   # tokens.css, layout.css, components.css
        ├── App.jsx
        ├── ThemeContext.jsx
        └── api.js
```

---

## License

MIT