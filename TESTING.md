# Testing

How the Global Press Freedom & Democracy Tracker is tested, what each level covers, what deliberately
isn’t tested, and how to run everything on Windows.

## Strategy: data correctness first

A dashboard like this can look right and still be wrong: a merge that silently drops countries, a change
calculated across a methodology break, a rank out of a different number of countries than the reader
assumes. So the tests concentrate on **whether the numbers are right**, at every step from the downloaded
files to the screen:

1. **The source files** — data quality tests run against the real files and fail loudly if a file is ever
   replaced with one that’s incomplete, out of range or shaped differently.
2. **The merge** — it must keep every score exactly as published; a test traces every merged score back to
   its source file, and another checks the tracked merged file equals a fresh rebuild.
3. **The calculations** — ranks, changes, averages and correlation are tested against small datasets
   whose results are **worked out by hand**, with the working written next to each expected value. Edge
   cases are deliberate: ties, missing scores, a single country, an empty selection, the 2022 RSF
   methodology change.
4. **The API** — every endpoint returns the right shape and status; bad input gets a clean 400 or 404 with
   a JSON error, never a stack trace; every response is strict JSON (no `NaN` or `Infinity`).
5. **The screen** — the browser journeys compare what the page shows with the API’s own response, rather
   than with hard-coded numbers.

Alongside correctness: accessibility (axe on every view, plus jsx-a11y linting), phones and tablets,
privacy (no third-party requests, nothing stored on the device) and the sleeping-server experience.

Every bug found was proven with a failing test before it was fixed, and that test stays as a guard — see
[BUGS.md](BUGS.md).

## The levels

| Level | Tool | Tests | Where |
|---|---|---|---|
| Backend unit | pytest | 82 | `freedom-tracker/backend/tests/` |
| Backend data quality (real files) | pytest | 20 | `test_data_quality.py` |
| Backend API and bug regressions | pytest + Flask test client | 86 | `test_api.py`, `test_regressions.py` |
| Documentation | pytest | 7 | `test_docs.py` |
| Frontend components | Vitest + Testing Library | 161 | `freedom-tracker/frontend/src/**/*.test.*` |
| Browser | Playwright (Chromium and WebKit) + axe-core | 113 | `freedom-tracker/frontend/e2e/` |
| **Total** | | **469** | |
| Image size checks (counted separately) | Vitest | 3 | `freedom-tracker/frontend/checks/` |

All 469 tests pass. The image size checks are 3 when a production build exists (`dist/` adds a file to
check) and 2 without one.

**Coverage:** backend **100%** of statements (245/245) and branches (58/58). Frontend **94.7%** of statements
(575/607), **83.5%** of branches (319/382), **92.8%** of functions and **97.2%** of lines. Coverage is a guide
to what’s untested, not a target in itself. The frontend figure leaves out only the test files themselves,
the entry point (`main.jsx`) and the generated ISO code lookup table (`isoCodes.js`); the lines it misses are
mostly chart rendering that only Playwright can exercise.

### Backend unit tests (82)

- **Cleaning and merging (15):** aggregates and blank rows are removed; scores are never changed; the
  join uses ISO code and year, so renamed and corrupted country names don’t lose rows; only country-years
  in both files are kept; files load from any working directory; an out-of-date merged file is rebuilt.
- **Calculations (36):** hand-worked fixtures for averages, changes, the largest one-year fall (including the
  2022 break and equal falls), period changes, the map’s largest increase and decrease with ties, Pearson’s r,
  R² and the least-squares line (a perfect line, a worked three-point example, a negative relationship and
  every case where they can’t be calculated), histograms, the combined score and the headline figures.
- **Ranking (14):** order, ties (1, 2, 2, 4), alphabetical order within ties, missing scores excluded and never
  ranked, a single country, an empty selection, ties at the top-10 cut-off.
- **JSON provider (17):** every NumPy number type, NaN and ±infinity (as Python, NumPy float64 and float32,
  and nested in lists, tuples, dicts and arrays) become valid JSON; unsupported types still raise.

### Data quality tests (20)

These run against the real files, with the expected counts written into the test. They check the columns,
that there are no missing values, that every country has a valid ISO code (one per country), that scores are
within 0–10 and 0–100, that there are no duplicate country-years, that the years are 2013–2023, that there
are 167 countries with 148 in 2023 (the documented gap), that no country has a gap in the middle of its years,
that every merged score can be traced unchanged to its source file, and that the merged file matches a
fresh rebuild.

### API tests (86)

Every endpoint’s shape and status code, including country names with spaces and apostrophes; 13 kinds of
bad query parameter; unknown countries, unknown routes and wrong methods; an unexpected server error (which
must not reveal its details); CORS (allowed origins, other origins, the environment variable and the
default); and every endpoint and all 167 country pages on the real data, parsed as strict JSON. Ten of these
are the regression tests for bugs 1–4.

### Documentation tests (7)

The README must credit the EIU and RSF, name both Kaggle uploads and their licence position, quote country,
observation and year figures that match the data, and claim no licence for the code.

### Frontend component tests (161)

Charts and the map can’t lay themselves out in jsdom, so component tests stub them and test everything around
them; Playwright tests the real rendering.

- **Data preparation (27):** formatting, map colours and legend positions, merging two countries’ series by
  year, the press freedom period text, the country search (case- and accent-insensitive), scatter-point
  jitter (small, stable, within the axes), tick values and histogram labels.
- **Insight text (21):** the content of every insight, the methodology and rank notes, correlation strength
  thresholds, the corrected skew explanation, and a check that no insight uses judgemental wording.
- **Pages (25), app (6), about page and footer (23):** filters, country selection and comparison, the year
  slider, data tables, loading, empty and error states with Retry, tabs linked to their panels, the theme
  switch, credits and their links, the disclaimer, the privacy note, and navigation to and from
  `/about-the-data` (including the browser’s back button).
- **Hooks and helpers:** the data-loading hook ignores out-of-date responses (6); zoom and pan never go past
  the full view, zoom towards the cursor and tell a tap from a drag (13); the API client (5); shared
  components (18).
- **Sleeping server (8), with a fake clock:** no message in the first 2 seconds; “Waking the server — this
  can take up to a minute” after 2 seconds; the dashboard once a slow server answers; retries after failed
  checks; a hung check abandoned and retried; Retry after the time limit.
- **Bug regressions (9):** bugs 5, 7, 8, 9 and 11.

### Browser tests (113)

Playwright starts the real Flask API and a production build, so these test the actual app.

- **Journeys (15, Chromium)** — each compares the page with the API’s own response:
  the map opens on the latest year with matching headline figures; colours every country with data and only
  those; changing the year updates the data; hovering a country shows its scores; press freedom shows the
  methodology note and no 2022 changes; selecting a country shows its figures and dashboard rank; comparing
  two countries shows both in the chart and the table; searching filters the list, with an empty state;
  press freedom changes are split at 2022; changing the correlation year shows that year’s statistics; zoom
  never goes past the full view; the top and bottom 10 match the API exactly; a failed request recovers with
  Retry; every chart is drawn at a usable size on a laptop screen; the tabs work with the arrow keys.
- **Accessibility (11, Chromium):** axe (WCAG 2.0, 2.1 and 2.2 A/AA, plus best practice) on every view in light
  and dark mode with the data tables open, the about-the-data page in both modes, and the waking-server and
  error states. **Any violation fails the run.**
- **Privacy and about page (4, Chromium):** no request goes to another site; no cookies, local storage, session
  storage or IndexedDB after using every view; `/about-the-data` loads directly; the footer credits stay
  visible.
- **Sleeping server (3, Chromium):** with Playwright’s fake clock and a held-back health check.
- **Phones and tablets (80):** 8 checks at 320×568, 390×844, 844×390, 820×1180 and 1024×768, in **both
  Chromium and WebKit** — nothing runs off the screen, the ranking tables fit their cards, the tabs and title
  are fully visible, the about page fits, and tapping the map and the scatter dots, the filters and comparing
  countries all work by touch.

### Image size checks (3)

Every image and icon in `public/`, `src/` and the production build must be under 200 kB. A first check
confirms the images are really being found, so the suite can’t pass by checking nothing.

## What’s deliberately not tested

- **Recharts’ and react-simple-maps’ own drawing** in component tests — they’re third-party libraries that
  need a real browser; the browser tests check their output instead.
- **Firefox, real phones and tablets** — browser tests use emulated screen sizes in Chromium and WebKit.
- **Screen reader use** — accessibility is checked automatically with axe and jsx-a11y, which find many but
  not all problems. There’s been no testing with a screen reader user.
- **Visual regression** (pixel comparisons) — layout is checked by measuring elements, and by looking at
  screenshots during development.
- **Performance and load** — the API is a small read-only service on a free host.
- **The live hosting** (Vercel, Render) — tests run against local servers; CI runs the same tests on Linux.
- **The print layout** behind “Print or save as PDF” — only that the button opens the print dialog.
- **The source organisations’ figures** — the data is checked for internal consistency and against the
  downloaded files, not against the EIU’s and RSF’s own publications (except the spot checks described on
  the about-the-data page).

## How to run everything on Windows

You need **Python 3.13** and **Node.js 24**. Use **PowerShell or Command Prompt** — Vitest doesn’t start under
Git Bash on Windows.

**Backend** (from the repository folder):

```powershell
cd freedom-tracker\backend
py -3.13 -m venv .venv                                   # first time only
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\ruff check . ..\..\.github\scripts       # lint
.\.venv\Scripts\python -m pytest --cov --cov-report=term-missing
.\.venv\Scripts\python -m pytest -m data_quality         # just the checks on the real data files
```

Passing looks like `All checks passed!` from ruff, and **195 passed** with **100%** for `analysis.py`, `app.py`
and `data.py`.

**Frontend** (the browser tests need the backend `.venv` above, because Playwright starts Flask from it):

```powershell
cd freedom-tracker\frontend
npm install
npx playwright install chromium webkit                   # first time only
npm run lint                                             # no output means no problems
npm test                                                 # component tests
npm run test:coverage                                    # the same, with coverage
npm run test:images                                      # image size checks
npm run test:e2e                                         # browser tests (starts both servers itself)
npm run test:e2e:report                                  # open the last browser test report
```

Passing looks like **161 passed** from `npm test`, about **94.7%** on the coverage “All files” line, **3
passed** from `npm run test:images` (2 if you haven’t built the site), and **113 passed** from
`npm run test:e2e`.

**In CI** (GitHub Actions, `.github/workflows/ci.yml`), the same steps run on every push and pull request on
Linux: lint, the backend and frontend tests with coverage, the build, the image checks and the browser tests
in Chromium and WebKit. The reports are kept as artifacts for 14 days, and the coverage badges in the README
update after each fully passing run on `main`.
