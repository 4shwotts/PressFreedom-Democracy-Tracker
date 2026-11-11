"""
Calculations behind each API endpoint, kept free of Flask so they can be unit
tested against small hand-worked datasets.

Rules used throughout (also explained on the about-the-data page):

Ranks
  Countries are ranked among the countries in this dashboard that have both
  scores in the same year — these are not the official EIU or RSF ranks.
  Higher score = better rank. Ties share the better rank and the next rank is
  skipped (competition ranking: 1, 2, 2, 4). Tied countries are listed
  alphabetically. Countries with a missing score are excluded, never ranked.

RSF methodology change
  RSF changed its press freedom methodology in 2022, so scores from 2021 and
  earlier aren't directly comparable with 2022 onwards. Press freedom changes
  are never calculated across that break: year-on-year changes from 2021 to
  2022 are left out, and changes over the full period are split into one
  period before the break and one from it onwards. Democracy scores are not
  affected.
"""
import math

import numpy as np
import pandas as pd

RSF_METHODOLOGY_CHANGE_YEAR = 2022

DEMOCRACY = 'DemocracyScore'
PRESS = 'PressFreedomScore'
METRICS = (DEMOCRACY, PRESS)


def crosses_methodology_change(from_year: int, to_year: int) -> bool:
    """True if comparing press freedom scores across these years spans RSF's 2022 change."""
    return from_year < RSF_METHODOLOGY_CHANGE_YEAR <= to_year


def comparable(metric: str, from_year: int, to_year: int) -> bool:
    """Whether two scores of this metric from these years can be compared."""
    return metric != PRESS or not crosses_methodology_change(from_year, to_year)


def _round(value, digits):
    """Rounds to a plain float, passing None and NaN through as None."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return round(float(value), digits)


# ---------------------------------------------------------------- ranking

def rank_countries(df: pd.DataFrame, column: str) -> pd.DataFrame:
    """
    Ranks the rows of `df` (normally one year) by `column`, highest first.
    Returns the rows with a missing score dropped, sorted by rank and then
    alphabetically, with an integer 'rank' column added. An empty input gives
    an empty result.
    """
    ranked = df.dropna(subset=[column]).copy()
    if ranked.empty:
        return ranked.assign(rank=pd.Series(dtype=int))
    ranked['rank'] = ranked[column].rank(ascending=False, method='min').astype(int)
    return ranked.sort_values(['rank', 'Country']).reset_index(drop=True)


def combined_score(df: pd.DataFrame) -> pd.Series:
    """Equal-weighted average of democracy (0-10) and press freedom rescaled to 0-10."""
    return (df[DEMOCRACY] + df[PRESS] / 10) / 2


# ---------------------------------------------------------------- per country

def sharpest_press_drop(series: pd.DataFrame):
    """
    Largest fall in press freedom between consecutive data points for one
    country (rows sorted by year), ignoring any pair that crosses the 2022
    methodology change. Returns None if there is no comparable fall. If two
    falls are equal, the earliest is reported.
    """
    best = None
    rows = series.sort_values('Year')[['Year', PRESS]].to_numpy()
    # pairs each data point with the next one (lengths differ by one by design)
    for (y0, s0), (y1, s1) in zip(rows, rows[1:], strict=False):
        if crosses_methodology_change(int(y0), int(y1)):
            continue
        delta = s1 - s0
        if delta < 0 and (best is None or delta < best['delta']):
            best = {'fromYear': int(y0), 'toYear': int(y1), 'delta': delta}
    if best:
        best['delta'] = _round(best['delta'], 1)
    return best


def press_change_periods(series: pd.DataFrame) -> list:
    """
    Change in press freedom over each period either side of the 2022 methodology
    change (first to last data point within the period). A period needs at least
    two data points to have a change.
    """
    series = series.sort_values('Year')
    periods = []
    for part in (series[series['Year'] < RSF_METHODOLOGY_CHANGE_YEAR],
                 series[series['Year'] >= RSF_METHODOLOGY_CHANGE_YEAR]):
        if len(part) >= 2:
            first, last = part.iloc[0], part.iloc[-1]
            periods.append({
                'fromYear': int(first['Year']),
                'toYear':   int(last['Year']),
                'change':   _round(last[PRESS] - first[PRESS], 2),
            })
    return periods


def change_vs_previous(series: pd.DataFrame, metric: str):
    """Latest score minus the previous data point, or None if not comparable."""
    series = series.sort_values('Year')
    if len(series) < 2:
        return None
    prev, last = series.iloc[-2], series.iloc[-1]
    if not comparable(metric, int(prev['Year']), int(last['Year'])):
        return None
    return _round(last[metric] - prev[metric], 2)


def country_trend(df: pd.DataFrame, country: str):
    """Everything the Country Trends tab shows for one country, or None if unknown."""
    sub = df[df['Country'] == country].sort_values('Year').reset_index(drop=True)
    if sub.empty:
        return None
    first, last = sub.iloc[0], sub.iloc[-1]

    # rank against every country with both scores in this country's latest year
    ranking_year = int(last['Year'])
    year_df = df[df['Year'] == ranking_year]
    dem_ranks = rank_countries(year_df, DEMOCRACY).set_index('Country')['rank']
    press_ranks = rank_countries(year_df, PRESS).set_index('Country')['rank']

    return {
        'country': country,
        'series': [
            {'year': int(r['Year']),
             'democracyScore': _round(r[DEMOCRACY], 2),
             'pressFreedomScore': _round(r[PRESS], 2)}
            for _, r in sub.iterrows()
        ],
        'latestDemocracy': _round(last[DEMOCRACY], 2),
        'latestPress': _round(last[PRESS], 2),
        'democracyChangeVsPrevYear': change_vs_previous(sub, DEMOCRACY),
        'pressChangeVsPrevYear': change_vs_previous(sub, PRESS),
        # democracy has no methodology break, so its change runs first to last
        'tenYearChangeDemocracy': _round(last[DEMOCRACY] - first[DEMOCRACY], 2),
        # press freedom changes are split either side of the 2022 methodology change
        'pressChangePeriods': press_change_periods(sub),
        'avgDemocracy': _round(sub[DEMOCRACY].mean(), 2),
        'avgPress': _round(sub[PRESS].mean(), 2),
        'sharpestDrop': sharpest_press_drop(sub),
        'ranking': {
            'democracyRank': int(dem_ranks[country]),
            'pressRank': int(press_ranks[country]),
            'totalCountries': int(len(year_df)),
            'rankingYear': ranking_year,
        },
        'yearsAvailable': int(len(sub)),
    }


# ---------------------------------------------------------------- map

def map_view(df: pd.DataFrame, year: int, metric: str) -> dict:
    """Per-country values for one year and metric, with year-on-year changes."""
    year_df = df[df['Year'] == year].sort_values('Country')
    prev_df = df[df['Year'] == year - 1]
    # a press freedom change into 2022 would span the methodology change
    can_compare = comparable(metric, year - 1, year)

    prev_values = prev_df.set_index('ISO')[metric] if can_compare else pd.Series(dtype=float)
    rows = []
    for _, r in year_df.iterrows():
        change = r[metric] - prev_values[r['ISO']] if r['ISO'] in prev_values.index else None
        rows.append({
            'country': r['Country'],
            'iso': r['ISO'],
            'democracyScore': _round(r[DEMOCRACY], 2),
            'pressFreedomScore': _round(r[PRESS], 2),
            'value': _round(r[metric], 2),
            'change': _round(change, 2),
        })

    # biggest rise and fall; ties go to the country first in alphabetical order
    changes = [r for r in rows if r['change'] is not None]
    most_improved = most_declined = None
    if changes:
        best = max(changes, key=lambda r: r['change'])
        worst = min(changes, key=lambda r: r['change'])
        most_improved = {'country': best['country'], 'delta': best['change']}
        most_declined = {'country': worst['country'], 'delta': worst['change']}

    # countries with data in other years but not this one — the map explains the gap
    missing = df[~df['ISO'].isin(year_df['ISO'])].groupby(['ISO', 'Country'])['Year']
    no_data = [
        {'country': country, 'iso': iso, 'yearFrom': int(years.min()), 'yearTo': int(years.max())}
        for (iso, country), years in missing
    ]

    return {
        'year': year,
        'metric': metric,
        'rows': rows,
        'globalAverage': _round(year_df[metric].mean(), 2),
        'mostImproved': most_improved,
        'mostDeclined': most_declined,
        'countryCount': len(rows),
        'noDataThisYear': no_data,
        # false when the previous year can't be compared (press freedom 2021 -> 2022)
        'yearOnYearComparable': can_compare,
    }


# ---------------------------------------------------------------- correlation

def correlation_stats(df: pd.DataFrame) -> dict:
    """
    Pearson r, R² and the least-squares line of press freedom on democracy.
    Each value is None when it can't be calculated (fewer than two points, or
    no variation in a score).
    """
    x = df[DEMOCRACY].to_numpy(dtype=float)
    y = df[PRESS].to_numpy(dtype=float)
    r = slope = intercept = None
    if len(x) >= 2 and np.ptp(x) > 0:
        slope, intercept = np.polyfit(x, y, 1)
        if np.ptp(y) > 0:
            r = float(np.corrcoef(x, y)[0, 1])
    return {
        'pearsonR': _round(r, 3),
        'rSquared': _round(r ** 2 if r is not None else None, 3),
        'sampleSize': int(len(df)),
        'trendline': None if slope is None else {
            'slope': _round(slope, 4), 'intercept': _round(intercept, 4)
        },
    }


# ---------------------------------------------------------------- summary

def histogram(values: pd.Series, bins: int = 10) -> list:
    """Equal-width histogram as {binStart, binEnd, count} dicts."""
    values = values.dropna()
    if values.empty:
        return []
    counts, edges = np.histogram(values, bins=bins)
    return [
        {'binStart': _round(edges[i], 1), 'binEnd': _round(edges[i + 1], 1), 'count': int(counts[i])}
        for i in range(len(counts))
    ]


def summary_view(df: pd.DataFrame, year: int, n: int = 10) -> dict:
    """Top and bottom n countries by combined score in one year, plus histograms."""
    year_df = df[df['Year'] == year].copy()
    year_df['combinedScore'] = combined_score(year_df)
    ranked = rank_countries(year_df, 'combinedScore')

    def to_rows(sub):
        return [
            {'rank': int(r['rank']),
             'country': r['Country'],
             'democracyScore': _round(r[DEMOCRACY], 1),
             'pressFreedomScore': _round(r[PRESS], 1),
             'combinedScore': _round(r['combinedScore'], 1)}
            for _, r in sub.iterrows()
        ]

    top = ranked.head(n)
    # lowest first; ties among the lowest are still listed alphabetically
    bottom = ranked.sort_values(['combinedScore', 'Country'], ascending=[True, True]).head(n)

    biggest_gap = None
    if not year_df.empty:
        gaps = (year_df[DEMOCRACY] - year_df[PRESS] / 10).abs()
        row = year_df.loc[gaps.idxmax()]
        biggest_gap = {
            'country': row['Country'],
            'democracyScore': _round(row[DEMOCRACY], 1),
            'pressFreedomScore': _round(row[PRESS], 1),
        }

    gap = top['combinedScore'].mean() - bottom['combinedScore'].mean() if len(ranked) else None
    return {
        'year': year,
        'totalCountries': int(df['Country'].nunique()),
        'totalYears': int(df['Year'].nunique()),
        'totalRecords': int(len(df)),
        'rankedCountries': int(len(ranked)),
        'democracyHistogram': histogram(year_df[DEMOCRACY]),
        'pressHistogram': histogram(year_df[PRESS]),
        'top10': to_rows(top),
        'bottom10': to_rows(bottom),
        'biggestGapCountry': biggest_gap,
        'scoreGapTopVsBottom': _round(gap, 1),
    }


# ---------------------------------------------------------------- meta

def meta_view(df: pd.DataFrame) -> dict:
    """Headline figures for the stat cards: latest-year average and top/bottom country."""
    year_min, year_max = int(df['Year'].min()), int(df['Year'].max())
    latest = rank_countries(df[df['Year'] == year_max], DEMOCRACY)
    top, bottom = latest.iloc[0], latest.sort_values([DEMOCRACY, 'Country']).iloc[0]
    return {
        'countriesAnalysed': int(df['Country'].nunique()),
        'avgDemocracyScore': _round(latest[DEMOCRACY].mean(), 1),
        # the average covers only countries with a score in the latest year
        'avgDemocracyYear': year_max,
        'avgDemocracyCountryCount': int(len(latest)),
        'topCountry': top['Country'],
        'topScore': _round(top[DEMOCRACY], 1),
        'bottomCountry': bottom['Country'],
        'bottomScore': _round(bottom[DEMOCRACY], 1),
        'yearMin': year_min,
        'yearMax': year_max,
        'yearsAvailable': year_max - year_min + 1,
    }
