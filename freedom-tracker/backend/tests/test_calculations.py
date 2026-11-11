"""
Calculated values checked against results worked out by hand for small datasets.
The hand calculation is written next to each expected value.
"""
import pandas as pd
import pytest

import analysis


def series(rows):
    """One country's rows as (year, democracy, press freedom)."""
    return pd.DataFrame(
        [('X', 'XXX', y, d, p) for y, d, p in rows],
        columns=['Country', 'ISO', 'Year', 'DemocracyScore', 'PressFreedomScore'])


# ---------------------------------------------------------------- methodology change helpers

@pytest.mark.parametrize('from_year, to_year, crosses', [
    (2020, 2021, False), (2021, 2022, True), (2022, 2023, False), (2019, 2023, True), (2013, 2021, False),
])
def test_crosses_methodology_change(from_year, to_year, crosses):
    assert analysis.crosses_methodology_change(from_year, to_year) is crosses


def test_democracy_is_always_comparable_across_2022():
    assert analysis.comparable('DemocracyScore', 2021, 2022)
    assert not analysis.comparable('PressFreedomScore', 2021, 2022)


# ---------------------------------------------------------------- sharpest drop

def test_sharpest_drop_ignores_the_fall_across_the_methodology_change(fixture_df):
    # Alpha press: 80 -> 70 (-10), 70 -> 50 (-20, but 2021->2022 crosses the change), 50 -> 56
    alpha = fixture_df[fixture_df['Country'] == 'Alpha']
    assert analysis.sharpest_press_drop(alpha) == {'fromYear': 2020, 'toYear': 2021, 'delta': -10.0}


def test_sharpest_drop_is_none_when_the_only_fall_crosses_the_change(fixture_df):
    # Echo press: 20 -> 25 (rise), 25 -> 20 (fall, but 2021->2022)
    echo = fixture_df[fixture_df['Country'] == 'Echo']
    assert analysis.sharpest_press_drop(echo) is None


def test_sharpest_drop_none_when_scores_never_fall():
    assert analysis.sharpest_press_drop(series([(2013, 5, 50), (2014, 5, 55), (2015, 5, 55)])) is None


def test_sharpest_drop_equal_falls_reports_the_earliest():
    s = series([(2013, 5, 60), (2014, 5, 55), (2015, 5, 50)])  # -5 then -5
    assert analysis.sharpest_press_drop(s) == {'fromYear': 2013, 'toYear': 2014, 'delta': -5.0}


def test_sharpest_drop_single_data_point():
    assert analysis.sharpest_press_drop(series([(2023, 5, 50)])) is None


# ---------------------------------------------------------------- period changes

def test_press_change_split_either_side_of_2022(fixture_df):
    # Alpha: 2020-2021: 70 - 80 = -10;  2022-2023: 56 - 50 = +6
    alpha = fixture_df[fixture_df['Country'] == 'Alpha']
    assert analysis.press_change_periods(alpha) == [
        {'fromYear': 2020, 'toYear': 2021, 'change': -10.0},
        {'fromYear': 2022, 'toYear': 2023, 'change': 6.0},
    ]


def test_press_change_period_needs_two_points(fixture_df):
    # Echo has a single year (2022) from the change onwards, so only one period
    echo = fixture_df[fixture_df['Country'] == 'Echo']
    assert analysis.press_change_periods(echo) == [{'fromYear': 2020, 'toYear': 2021, 'change': 5.0}]


def test_change_vs_previous_year(fixture_df):
    alpha = fixture_df[fixture_df['Country'] == 'Alpha']
    assert analysis.change_vs_previous(alpha, 'DemocracyScore') == 0.6   # 7.6 - 7.0
    assert analysis.change_vs_previous(alpha, 'PressFreedomScore') == 6.0  # 56 - 50


def test_change_vs_previous_press_is_none_across_the_change(fixture_df):
    # Echo's latest two points are 2021 and 2022
    echo = fixture_df[fixture_df['Country'] == 'Echo']
    assert analysis.change_vs_previous(echo, 'PressFreedomScore') is None
    assert analysis.change_vs_previous(echo, 'DemocracyScore') == 0.0


def test_change_vs_previous_with_one_data_point():
    assert analysis.change_vs_previous(series([(2023, 5, 50)]), 'DemocracyScore') is None


# ---------------------------------------------------------------- country trend

def test_country_trend_values(fixture_df):
    t = analysis.country_trend(fixture_df, 'Alpha')
    assert t['latestDemocracy'] == 7.6 and t['latestPress'] == 56.0
    assert t['avgDemocracy'] == 7.65       # (8 + 8 + 7 + 7.6) / 4 = 30.6 / 4
    assert t['avgPress'] == 64.0           # (80 + 70 + 50 + 56) / 4 = 256 / 4
    assert t['tenYearChangeDemocracy'] == -0.4   # 7.6 - 8.0
    assert t['yearsAvailable'] == 4
    assert [p['year'] for p in t['series']] == [2020, 2021, 2022, 2023]


def test_country_trend_unknown_country_is_none(fixture_df):
    assert analysis.country_trend(fixture_df, 'Atlantis') is None


# ---------------------------------------------------------------- map

def test_map_democracy_changes_and_extremes(fixture_df):
    m = analysis.map_view(fixture_df, 2023, 'DemocracyScore')
    # changes vs 2022: Alpha 7.6-7 = +0.6, Bravo 0, Charlie 2-3 = -1, Delta 0
    assert {r['country']: r['change'] for r in m['rows']} == {
        'Alpha': 0.6, 'Bravo': 0.0, 'Charlie': -1.0, 'Delta': 0.0}
    assert m['mostImproved'] == {'country': 'Alpha', 'delta': 0.6}
    assert m['mostDeclined'] == {'country': 'Charlie', 'delta': -1.0}
    assert m['globalAverage'] == 5.4       # (7.6 + 6 + 2 + 6) / 4 = 21.6 / 4
    assert m['countryCount'] == 4
    assert m['yearOnYearComparable'] is True


def test_map_lists_countries_missing_the_year(fixture_df):
    m = analysis.map_view(fixture_df, 2023, 'DemocracyScore')
    assert m['noDataThisYear'] == [{'country': 'Echo', 'iso': 'EEE', 'yearFrom': 2020, 'yearTo': 2022}]


def test_map_press_freedom_has_no_changes_into_2022(fixture_df):
    m = analysis.map_view(fixture_df, 2022, 'PressFreedomScore')
    assert all(r['change'] is None for r in m['rows'])
    assert m['mostImproved'] is None and m['mostDeclined'] is None
    assert m['yearOnYearComparable'] is False


def test_map_democracy_still_has_changes_into_2022(fixture_df):
    m = analysis.map_view(fixture_df, 2022, 'DemocracyScore')
    assert m['yearOnYearComparable'] is True
    assert m['mostDeclined'] == {'country': 'Alpha', 'delta': -1.0}   # 7 - 8


def test_map_ties_for_most_improved_go_alphabetically(fixture_df):
    # 2021 press vs 2020: Alpha -10, Bravo +2, Charlie +5, Delta 0, Echo +5 -> Charlie (tie with Echo)
    m = analysis.map_view(fixture_df, 2021, 'PressFreedomScore')
    assert m['mostImproved'] == {'country': 'Charlie', 'delta': 5.0}
    assert m['mostDeclined'] == {'country': 'Alpha', 'delta': -10.0}


def test_map_first_year_has_no_changes(fixture_df):
    m = analysis.map_view(fixture_df, 2020, 'DemocracyScore')
    assert all(r['change'] is None for r in m['rows'])
    assert m['mostImproved'] is None


# ---------------------------------------------------------------- correlation

def test_correlation_perfect_line():
    # y = 10x exactly: r = 1, slope 10, intercept 0
    s = series([(2020, 1, 10), (2021, 2, 20), (2022, 3, 30), (2023, 4, 40)])
    stats = analysis.correlation_stats(s)
    assert stats['pearsonR'] == 1.0 and stats['rSquared'] == 1.0
    assert stats['trendline'] == {'slope': 10.0, 'intercept': 0.0}
    assert stats['sampleSize'] == 4


def test_correlation_hand_worked_example():
    # x = 1, 2, 3; y = 2, 4, 7.  mean x = 2, mean y = 13/3
    # Sxy = (-1)(-7/3) + 0 + (1)(8/3) = 5;  Sxx = 2;  Syy = 49/9 + 1/9 + 64/9 = 114/9
    # r = 5 / sqrt(2 * 114/9) = 0.99340;  r² = 0.98684
    # slope = Sxy / Sxx = 2.5;  intercept = 13/3 - 2.5 * 2 = -0.66667
    s = series([(2020, 1, 2), (2021, 2, 4), (2022, 3, 7)])
    stats = analysis.correlation_stats(s)
    assert stats['pearsonR'] == 0.993
    assert stats['rSquared'] == 0.987
    assert stats['trendline'] == {'slope': 2.5, 'intercept': -0.6667}


def test_correlation_negative_relationship():
    s = series([(2020, 1, 30), (2021, 2, 20), (2022, 3, 10)])
    assert analysis.correlation_stats(s)['pearsonR'] == -1.0


@pytest.mark.parametrize('rows', [
    [],                                         # no points
    [(2023, 5, 50)],                            # one point
    [(2022, 5, 40), (2023, 5, 60)],             # no variation in democracy
])
def test_correlation_undefined_cases_return_none_not_an_error(rows):
    stats = analysis.correlation_stats(series(rows))
    assert stats['pearsonR'] is None and stats['rSquared'] is None
    assert stats['trendline'] is None


def test_correlation_with_no_variation_in_press_freedom():
    # a flat line: slope 0, but r is undefined (division by zero variance)
    stats = analysis.correlation_stats(series([(2022, 4, 50), (2023, 6, 50)]))
    assert stats['pearsonR'] is None
    assert stats['trendline'] == {'slope': 0.0, 'intercept': 50.0}


# ---------------------------------------------------------------- summary, histogram, meta

def test_summary_gaps_by_hand(fixture_df):
    s = analysis.summary_view(fixture_df, 2023, n=2)
    # top 2: Alpha 6.6, Delta 6.1 -> mean 6.35; bottom 2: Charlie 2.5, Bravo 6.0 -> mean 4.25
    assert s['scoreGapTopVsBottom'] == 2.1
    # |democracy - press/10|: Alpha |7.6 - 5.6| = 2.0 is the largest
    assert s['biggestGapCountry'] == {'country': 'Alpha', 'democracyScore': 7.6, 'pressFreedomScore': 56.0}


def test_summary_totals(fixture_df):
    s = analysis.summary_view(fixture_df, 2023)
    assert (s['totalCountries'], s['totalYears'], s['totalRecords']) == (5, 4, 19)


def test_histogram_counts_and_edges():
    # values 0..9 in 3 equal bins of width 3: [0,3) [3,6) [6,9] -> 3, 3, 4
    h = analysis.histogram(pd.Series(range(10), dtype=float), bins=3)
    assert [b['count'] for b in h] == [3, 3, 4]
    assert (h[0]['binStart'], h[-1]['binEnd']) == (0.0, 9.0)
    assert sum(b['count'] for b in h) == 10


def test_histogram_of_nothing_is_empty():
    assert analysis.histogram(pd.Series([], dtype=float)) == []


def test_meta_values(fixture_df):
    m = analysis.meta_view(fixture_df)
    assert m == {
        'countriesAnalysed': 5,
        'avgDemocracyScore': 5.4,         # 2023: (7.6 + 6 + 2 + 6) / 4
        'avgDemocracyYear': 2023,
        'avgDemocracyCountryCount': 4,    # Echo has no 2023 data
        'topCountry': 'Alpha', 'topScore': 7.6,
        'bottomCountry': 'Charlie', 'bottomScore': 2.0,
        'yearMin': 2020, 'yearMax': 2023, 'yearsAvailable': 4,
    }
