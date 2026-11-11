"""
Ranking rules (analysis.rank_countries and the rankings built on it).

The rule, as documented in analysis.py and on the about-the-data page:
higher score ranks first; ties share the better rank and the next rank is
skipped (1, 2, 2, 4); tied countries are listed alphabetically; countries with
a missing score are excluded.
"""
import math

import pandas as pd

import analysis


def year_df(rows):
    return pd.DataFrame(rows, columns=['Country', 'ISO', 'Year', 'DemocracyScore', 'PressFreedomScore'])


def ranks(df, column='DemocracyScore'):
    ranked = analysis.rank_countries(df, column)
    return list(zip(ranked['Country'], ranked['rank'], strict=True))


def test_highest_score_ranks_first():
    df = year_df([('Low', 'LLL', 2023, 2.0, 20.0), ('High', 'HHH', 2023, 9.0, 90.0),
                  ('Mid', 'MMM', 2023, 5.0, 50.0)])
    assert ranks(df) == [('High', 1), ('Mid', 2), ('Low', 3)]


def test_ties_share_the_better_rank_and_skip_the_next():
    df = year_df([('A', 'AAA', 2023, 9.0, 0), ('B', 'BBB', 2023, 7.0, 0),
                  ('C', 'CCC', 2023, 7.0, 0), ('D', 'DDD', 2023, 5.0, 0)])
    assert [r for _, r in ranks(df)] == [1, 2, 2, 4]


def test_tied_countries_are_listed_alphabetically():
    df = year_df([('Zambia', 'ZMB', 2023, 7.0, 0), ('Austria', 'AUT', 2023, 7.0, 0),
                  ('Mali', 'MLI', 2023, 7.0, 0)])
    assert ranks(df) == [('Austria', 1), ('Mali', 1), ('Zambia', 1)]


def test_countries_with_a_missing_score_are_excluded_not_ranked():
    df = year_df([('A', 'AAA', 2023, 9.0, 90.0), ('B', 'BBB', 2023, math.nan, 80.0),
                  ('C', 'CCC', 2023, 5.0, math.nan)])
    assert ranks(df, 'DemocracyScore') == [('A', 1), ('C', 2)]
    assert ranks(df, 'PressFreedomScore') == [('A', 1), ('B', 2)]


def test_single_country_ranks_first():
    assert ranks(year_df([('Only', 'ONE', 2023, 4.2, 42.0)])) == [('Only', 1)]


def test_empty_selection_gives_empty_ranking_without_error():
    ranked = analysis.rank_countries(year_df([]), 'DemocracyScore')
    assert ranked.empty
    assert 'rank' in ranked.columns


def test_all_missing_scores_gives_empty_ranking():
    ranked = analysis.rank_countries(year_df([('A', 'AAA', 2023, math.nan, 1.0)]), 'DemocracyScore')
    assert ranked.empty


def test_ranks_are_plain_integers():
    ranked = analysis.rank_countries(year_df([('A', 'AAA', 2023, 9.0, 1.0)]), 'DemocracyScore')
    assert pd.api.types.is_integer_dtype(ranked['rank'])


# ---------------------------------------------------------------- rankings in the fixture

def test_country_trend_rank_uses_same_year_countries_with_tie(fixture_df):
    # 2023 democracy: Alpha 7.6, Bravo 6.0, Delta 6.0, Charlie 2.0 -> 1, 2, 2, 4
    assert analysis.country_trend(fixture_df, 'Bravo')['ranking'] == {
        'democracyRank': 2, 'pressRank': 2, 'totalCountries': 4, 'rankingYear': 2023}
    assert analysis.country_trend(fixture_df, 'Delta')['ranking']['democracyRank'] == 2
    assert analysis.country_trend(fixture_df, 'Charlie')['ranking']['democracyRank'] == 4


def test_country_trend_rank_for_country_missing_latest_year(fixture_df):
    # Echo has no 2023 data, so it's ranked among the 5 countries with 2022 data
    assert analysis.country_trend(fixture_df, 'Echo')['ranking'] == {
        'democracyRank': 5, 'pressRank': 5, 'totalCountries': 5, 'rankingYear': 2022}


def test_summary_combined_ranking_order_and_ranks(fixture_df):
    # 2023 combined = (democracy + press/10) / 2:
    # Alpha (7.6+5.6)/2 = 6.6, Delta (6+6.2)/2 = 6.1, Bravo (6+6)/2 = 6.0, Charlie (2+3)/2 = 2.5
    s = analysis.summary_view(fixture_df, 2023, n=10)
    assert [(r['rank'], r['country'], r['combinedScore']) for r in s['top10']] == [
        (1, 'Alpha', 6.6), (2, 'Delta', 6.1), (3, 'Bravo', 6.0), (4, 'Charlie', 2.5)]
    assert [r['country'] for r in s['bottom10']] == ['Charlie', 'Bravo', 'Delta', 'Alpha']
    assert s['rankedCountries'] == 4


def test_summary_ties_at_the_cut_off_are_alphabetical():
    df = year_df([('Zulu', 'ZZZ', 2023, 5.0, 50.0), ('Alpha', 'AAA', 2023, 5.0, 50.0),
                  ('Top', 'TTT', 2023, 9.0, 90.0)])
    s = analysis.summary_view(df, 2023, n=2)
    assert [(r['rank'], r['country']) for r in s['top10']] == [(1, 'Top'), (2, 'Alpha')]
    assert [(r['rank'], r['country']) for r in s['bottom10']] == [(2, 'Alpha'), (2, 'Zulu')]


def test_summary_for_a_year_with_no_data_is_empty_not_an_error(fixture_df):
    s = analysis.summary_view(fixture_df, 1999)
    assert s['top10'] == [] and s['bottom10'] == []
    assert s['biggestGapCountry'] is None and s['scoreGapTopVsBottom'] is None


def test_meta_top_and_bottom_country_with_ties_alphabetical():
    df = year_df([('Zulu', 'ZZZ', 2023, 9.0, 50.0), ('Alpha', 'AAA', 2023, 9.0, 50.0),
                  ('Beta', 'BBB', 2023, 1.0, 50.0), ('Abel', 'ABL', 2023, 1.0, 50.0)])
    meta = analysis.meta_view(df)
    assert (meta['topCountry'], meta['bottomCountry']) == ('Alpha', 'Abel')
