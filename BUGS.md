# Bugs found and fixed

Fourteen bugs found in the original app (commit `31c65c5`, before the testing work). Each one was
**proven by a test that failed on the original code** before it was fixed (bug 12, a configuration
problem, is the exception — see its entry), and that test now guards against it returning.

Steps to reproduce refer to the original code. Backend tests live in `freedom-tracker/backend/tests/`,
component tests in `freedom-tracker/frontend/src/`, and browser tests in `freedom-tracker/frontend/e2e/`.

| # | Bug | Area | How found |
|---|---|---|---|
| [1](#1-a-non-numeric-year-returns-a-500-error-page) | A non-numeric year returns a 500 error page | API | Code review |
| [2](#2-years-outside-the-data-are-handled-inconsistently) | Years outside the data are handled inconsistently | API | Code review |
| [3](#3-unknown-routes-and-wrong-methods-return-html) | Unknown routes and wrong methods return HTML | API | Code review |
| [4](#4-press-freedom-changes-cross-rsfs-2022-methodology-change) | Press freedom changes cross RSF’s 2022 methodology change | Data | Data audit |
| [5](#5-ranks-and-averages-dont-say-what-they-cover) | Ranks and averages don’t say what they cover | Data / UI | Data audit |
| [6](#6-the-merge-script-only-works-from-the-backend-folder) | The merge script only works from the backend folder | Data | Code review |
| [7](#7-an-older-response-can-overwrite-a-newer-selection) | An older response can overwrite a newer selection | Frontend | Code review |
| [8](#8-the-histogram-explanation-describes-skew-backwards) | The histogram explanation describes skew backwards | Content | Wording review |
| [9](#9-dropdowns-and-the-year-slider-have-no-accessible-name) | Dropdowns and the year slider have no accessible name | Accessibility | Audit, axe |
| [10](#10-the-readme-names-the-wrong-democracy-source) | The README names the wrong democracy source | Docs | Data audit |
| [11](#11-the-export-button-only-opens-the-print-dialog) | The “Export” button only opens the print dialog | UI | Code review |
| [12](#12-the-merged-data-file-is-tracked-by-accident) | The merged data file is tracked by accident | Config | Code review |
| [13](#13-ranking-table-columns-are-cut-off-at-tablet-width) | Ranking table columns are cut off at tablet width | Layout | Playwright |
| [14](#14-low-contrast-text-unreachable-scrolling-areas-and-skipped-headings) | Low-contrast text, unreachable scrolling areas and skipped headings | Accessibility | axe |

---

## 1. A non-numeric year returns a 500 error page

**Steps to reproduce:** request `/api/map?year=abc`, `/api/map?year=` or `/api/correlation?year=abc`.

**Expected:** a 400 response with a JSON error saying what a valid year is.

**Actual:** a 500 Internal Server Error as an HTML page. With the Flask debugger on, the page includes the
Python stack trace (`ValueError: invalid literal for int() with base 10`).

**Root cause:** the year query parameter was passed straight to `int()` with no validation.

**Fix:** a `parse_year` helper in the app factory turns any invalid year into a 400 JSON error.

**Guarded by:** `test_regressions.py::test_bug1_non_numeric_year_is_a_400_json_error_not_a_500`;
`test_api.py::test_bad_query_parameters_get_a_clean_400` (13 bad inputs, each checked for a JSON body and
no stack trace).

## 2. Years outside the data are handled inconsistently

**Steps to reproduce:** request `/api/map?year=2030`, then `/api/correlation?year=1999`.

**Expected:** the same clear error for both: the year must be within the data’s range.

**Actual:** the map returned **200** with empty rows and a null average; the correlation endpoint returned
**404**.

**Root cause:** each endpoint filtered by year without checking the year existed, and handled an empty
result differently.

**Fix:** both validate the year against the range in the data, and return 400 with the message
“year must be a whole number between 2013 and 2023”. The range comes from the data, so the message stays
right if years are added.

**Guarded by:** `test_regressions.py::test_bug2_year_outside_the_data_is_a_400_json_error`;
`test_api.py::test_year_error_message_states_the_range_from_the_data` and
`test_year_range_follows_the_data_if_years_are_added`.

## 3. Unknown routes and wrong methods return HTML

**Steps to reproduce:** request `/api/does-not-exist`, or send `POST /api/countries`.

**Expected:** a JSON error (404 and 405), like every other API response.

**Actual:** Flask’s default HTML error pages.

**Root cause:** no error handlers were registered.

**Fix:** handlers return JSON for every HTTP error, and a generic `{"error": "Internal server error"}` for
anything unexpected — never the exception’s details.

**Guarded by:** `test_regressions.py::test_bug3_unknown_api_route_returns_json_not_html` and
`test_bug3_wrong_method_returns_json_not_html`; `test_api.py::test_unknown_route_gets_a_json_404`,
`test_wrong_method_gets_a_json_405` and `test_unexpected_server_error_is_json_without_a_stack_trace`.

## 4. Press freedom changes cross RSF’s 2022 methodology change

**Steps to reproduce:** open Country Trends for almost any country, e.g. Afghanistan. Read the “Sharpest
drop” insight and the year-on-year press freedom change.

**Expected:** no change calculated between 2021 and 2022, because RSF changed its methodology in 2022 and
the scores either side aren’t directly comparable.

**Actual:** for **106 of 167 countries** the “sharpest single-year decline” was 2021→2022. Afghanistan showed
a −21.54 year-on-year change between the two methodologies. The map’s “most improved/declined” for 2022 and
the 11-year change also crossed the break.

**How found:** the data audit showed the typical year-on-year change in press freedom scores is about 1 point,
except 2021→2022, where it is 6.84.

**Root cause:** the calculations treated the press freedom series as one continuous scale.

**Fix:** a documented rule in `analysis.py`: press freedom changes are never calculated across 2022. The
largest fall skips the 2021→2022 pair; the period change is split into 2013–2021 and 2022–2023; the map shows
no 2022 changes for press freedom and explains why; a methodology note appears on every chart that compares
press freedom across years.

**Guarded by:** `test_regressions.py::test_bug4_no_sharpest_drop_spans_the_2022_methodology_change`,
`test_bug4_map_has_no_press_freedom_changes_into_2022` and
`test_bug4_press_change_vs_previous_year_not_across_the_change`; the hand-worked methodology-change,
largest-fall, period-change and map tests in `test_calculations.py`; the browser journey “press freedom changes
are split at the 2022 methodology change”.

## 5. Ranks and averages don’t say what they cover

**Steps to reproduce:** open Country Trends for the United States, then for Afghanistan, and read “Global
Standing”. On the map, compare “Avg Democracy Score” with “Countries Analysed”.

**Expected:** each rank says how many countries, in which year, and that it isn’t an official rank; the
average says which year and how many countries it covers.

**Actual:** the US was “29/148” and Afghanistan “167/167” — different denominators, because Afghanistan has
no 2023 democracy score — with nothing to explain it. The average covered 148 countries next to a card saying
167.

**Root cause:** ranks are taken among countries with data in the same year (correct), but the labels didn’t
say so, and could be mistaken for the official EIU or RSF ranks.

**Fix:** every rank reads “N of M”, with the year and “among the M countries in this dashboard … not the
official EIU or RSF ranks”. The API now also returns how many countries and which year the average covers.
The rule (ties 1, 2, 2, 4, then alphabetical) is documented on the about-the-data page.

**Guarded by:** `src/test/regressions.test.jsx` “BUG-5” (2 tests); `test_ranking.py` (14 tests, including ties,
missing scores, a single country and an empty selection); the browser journeys that compare ranks with the API.

## 6. The merge script only works from the backend folder

**Steps to reproduce:** from the repository root, run Python and call `load_and_merge()` from `data.py`.

**Expected:** the merged dataset.

**Actual:** `FileNotFoundError: Could not find press freedom data file`. The script also printed a directory
listing every time it ran.

**Root cause:** the file paths were relative to the current working directory.

**Fix:** paths are relative to `data.py` itself; the debugging output was removed; the merge is split into
small, tested functions.

**Guarded by:** `test_data_cleaning.py::test_load_and_merge_works_from_any_working_directory`.

## 7. An older response can overwrite a newer selection

**Steps to reproduce:** on a slow connection, move the map’s year slider quickly from 2023 to 2015, or pick two
countries in quick succession on Country Trends.

**Expected:** the page shows the last year or country you chose.

**Actual:** if the first request finished last, its data replaced the newer data — the slider said 2015 while
the map showed 2023.

**Root cause:** each response was stored when it arrived, without checking it was still the one wanted.

**Fix:** one data-loading hook (`useApi`) for every view ignores responses for a selection that has since
changed.

**Guarded by:** `src/test/regressions.test.jsx` “BUG-7” (map and country trends, with responses deliberately
returned out of order); `src/lib/useApi.test.jsx` “ignores a response for deps that have since changed”.

## 8. The histogram explanation describes skew backwards

**Steps to reproduce:** open Data Summary and read “Reading the Distributions”.

**Expected:** a left-skewed distribution (long tail to the left) has most countries at the **higher** end.

**Actual:** the text said a left-skewed distribution means most countries score **low**.

**Root cause:** a factual error in the insight text.

**Fix:** corrected text, which now names the tail’s direction explicitly.

**Guarded by:** `src/test/regressions.test.jsx` “BUG-8”; `src/lib/insights.test.js` “explains skew correctly”.

## 9. Dropdowns and the year slider have no accessible name

**Steps to reproduce:** use a screen reader, or run axe, on the map, country trends or correlation view.

**Expected:** every form control announces what it is (“Metric”, “Year”, “Country”).

**Actual:** the visible labels weren’t linked to their controls. axe reported `select-name` (critical) on 6
views and `label` (critical) on the year slider.

**Root cause:** `<label>` elements had no `htmlFor`, and the slider had no label at all.

**Fix:** labels linked by ID, a (visually hidden) label for the slider, and `aria-valuetext` for its value.

**Guarded by:** `src/test/regressions.test.jsx` “BUG-9” (3 tests); the axe scans in `e2e/a11y.spec.js`.

## 10. The README names the wrong democracy source

**Steps to reproduce:** read the original `freedom-tracker/README.md`.

**Expected:** the democracy scores credited to the Economist Intelligence Unit, with counts that match the
data.

**Actual:** the scores were credited to **V-Dem**, a different index, and the README gave 161 countries and
about 1,732 observations — the figures from before the merge was fixed.

**Root cause:** documentation written before the data was checked, and never compared with it.

**Fix:** a rewritten README with full attribution, and tests that check its figures against the data.

**Guarded by:** `test_docs.py` (7 tests: the credits, no V-Dem, both Kaggle uploads and their licences, and the
country count, observation count and year range all match the data). On the original README, 6 of them fail.

## 11. The “Export” button only opens the print dialog

**Steps to reproduce:** click the top bar’s “Export current view” button.

**Expected:** what the label promises, or a label that says what happens.

**Actual:** it called `window.print()`, so there was no export.

**Root cause:** a misleading label.

**Fix:** the button is now “Print or save as PDF”, with a print icon. Browsers’ print dialogs can save as PDF,
so the feature is still there under an accurate name.

**Guarded by:** `src/test/regressions.test.jsx` “BUG-11”; `src/App.test.jsx` “the print button opens the print
dialog”.

## 12. The merged data file is tracked by accident

**Steps to reproduce:** read `.gitignore`. It lists `backend/democracy_press_freedom_data.csv`, but the file is
at `freedom-tracker/backend/…`, so the rule never matched.

**Expected:** a deliberate decision about whether the generated file is version-controlled.

**Actual:** the “generated” file was committed by accident, and production served that committed copy, so
it could drift from the raw files without anyone noticing.

**Root cause:** the wrong path in `.gitignore`.

**Fix:** the file stays tracked on purpose, because production serves it. The misleading rule is replaced
with a comment explaining why, and a test checks that the tracked file always equals a fresh rebuild from the
raw files. This is a configuration problem rather than a runtime failure, so there was no failing test on the
original code; the rebuild test guards it from now on.

**Guarded by:** `test_data_quality.py::test_tracked_processed_file_matches_a_fresh_rebuild` and
`test_every_processed_score_is_traceable_to_the_raw_files`.

## 13. Ranking table columns are cut off at tablet width

**Steps to reproduce:** open Data Summary in a 1024×768 window (a tablet in landscape, or a small laptop).

**Expected:** all five columns of both ranking tables visible.

**Actual:** the **Press** and **Combined** columns were pushed past the edge of their card and hidden. Checked
on the original build in both Chromium and WebKit.

**How found:** the Playwright phone and tablet checks, in WebKit.

**Root cause:** the two tables sit side by side at this width, the table layout was automatic with generous
padding, and the card hid anything that overflowed it.

**Fix:** a container query switches each table to a compact fixed layout (narrow rank column, shorter headings,
country names that wrap) whenever its own card is narrow, at any screen size.

**Guarded by:** `e2e/responsive.spec.js` “the ranking tables fit inside their cards, with no clipped columns”,
at five screen sizes in Chromium and WebKit.

## 14. Low-contrast text, unreachable scrolling areas and skipped headings

**Steps to reproduce:** run axe (WCAG 2.1 A and AA plus best practice) on each view of the original build, in
light and dark mode.

**Expected:** no violations.

**Actual (besides bug 9):**
- `color-contrast` (serious) — 89 elements across all 8 views. The light grey label text was about
  2.6:1 against white, against a minimum of 4.5:1.
- `scrollable-region-focusable` (serious) — the scrolling insight panel couldn’t be reached by keyboard.
- `heading-order` (moderate) — heading levels skipped on every view.

**Root cause:** colours chosen by eye, and markup structure not checked.

**Fix:** contrast-checked colour tokens for both themes, focusable named scroll regions, a corrected heading
structure, chart data tables and a skip link. ESLint’s jsx-a11y rules now catch many of these problems before
they reach the browser.

**Guarded by:** `e2e/a11y.spec.js` — 11 axe scans (every view in light and dark mode, the about-the-data page,
and the waking-server and error states), which fail on **any** violation.
