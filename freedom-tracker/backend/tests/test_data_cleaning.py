"""Unit tests for loading, cleaning and merging the two source datasets (data.py)."""
import math

import pandas as pd
import pytest

import data


def democracy_raw(rows):
    return pd.DataFrame(rows, columns=['Entity', 'ISO', 'Year', 'Democracy score'])


def press_raw(rows):
    return pd.DataFrame(rows, columns=['Year', 'Country', 'ISO', 'Rank', 'Score', 'Zone'])


# ---------------------------------------------------------------- democracy cleaning

def test_clean_democracy_drops_regional_and_world_aggregates():
    raw = democracy_raw([
        ('Norway', 'NOR', 2020, 9.81),
        ('Africa', None, 2020, 4.1),          # continent aggregate: no ISO code
        ('World', 'OWID_WRL', 2020, 5.3),     # Our World in Data world aggregate
    ])
    cleaned = data.clean_democracy(raw)
    assert cleaned['Country'].tolist() == ['Norway']


def test_clean_democracy_drops_missing_scores_and_renames_columns():
    raw = democracy_raw([('Norway', 'NOR', 2020, 9.81), ('Chad', 'TCD', 2020, math.nan)])
    cleaned = data.clean_democracy(raw)
    assert list(cleaned.columns) == ['Country', 'ISO', 'Year', 'DemocracyScore']
    assert cleaned['ISO'].tolist() == ['NOR']


def test_clean_democracy_keeps_score_values_unchanged():
    raw = democracy_raw([('Norway', 'NOR', 2020, 9.81)])
    assert data.clean_democracy(raw).loc[0, 'DemocracyScore'] == 9.81


# ---------------------------------------------------------------- press freedom cleaning

def test_clean_press_drops_fully_blank_separator_rows_and_casts_year():
    raw = press_raw([
        (2021.0, 'Norway', 'NOR', 1.0, 93.28, math.nan),
        (math.nan, math.nan, math.nan, math.nan, math.nan, math.nan),  # separator row
        (2022.0, 'Norway', 'NOR', 1.0, 92.65, math.nan),
    ])
    cleaned = data.clean_press(raw)
    assert len(cleaned) == 2
    assert cleaned['Year'].tolist() == [2021, 2022]
    assert pd.api.types.is_integer_dtype(cleaned['Year'])


def test_clean_press_drops_rows_missing_a_score_or_iso():
    raw = press_raw([
        (2021.0, 'Norway', 'NOR', 1.0, 93.28, math.nan),
        (2021.0, 'Nowhere', math.nan, 2.0, 50.0, math.nan),
        (2021.0, 'Chad', 'TCD', 3.0, math.nan, math.nan),
    ])
    assert data.clean_press(raw)['ISO'].tolist() == ['NOR']


def test_clean_press_ignores_rank_and_zone_columns():
    raw = press_raw([(2021.0, 'Norway', 'NOR', 1.0, 93.28, math.nan)])
    assert list(data.clean_press(raw).columns) == ['Year', 'ISO', 'PressFreedomScore']


# ---------------------------------------------------------------- merging

def test_merge_joins_on_iso_and_year_not_country_name():
    # the press file renames countries between years and has corrupted names;
    # joining on ISO keeps every year and takes names from the democracy data
    dem = data.clean_democracy(democracy_raw([
        ('Russia', 'RUS', 2021, 3.24),
        ('Russia', 'RUS', 2023, 2.22),
        ("Cote d'Ivoire", 'CIV', 2023, 4.22),
    ]))
    press = data.clean_press(press_raw([
        (2021.0, 'Russian Federation', 'RUS', 150.0, 51.29, math.nan),
        (2023.0, 'Russia', 'RUS', 164.0, 34.77, math.nan),
        (2023.0, 'C�te d\'Ivoire', 'CIV', 54.0, 68.83, math.nan),
    ]))
    merged = data.merge_sources(dem, press)
    assert len(merged) == 3
    assert merged[merged['ISO'] == 'RUS']['Country'].tolist() == ['Russia', 'Russia']
    assert merged[merged['ISO'] == 'CIV']['Country'].tolist() == ["Cote d'Ivoire"]


def test_merge_keeps_only_country_years_present_in_both_sources():
    dem = data.clean_democracy(democracy_raw([
        ('Norway', 'NOR', 2012, 9.9),      # no press freedom data for 2012
        ('Norway', 'NOR', 2013, 9.9),
        ('Sweden', 'SWE', 2013, 9.7),
    ]))
    press = data.clean_press(press_raw([
        (2013.0, 'Norway', 'NOR', 3.0, 93.48, math.nan),
        (2013.0, 'Andorra', 'AND', 5.0, 90.0, math.nan),  # not in the EIU index
    ]))
    merged = data.merge_sources(dem, press)
    assert merged[['ISO', 'Year']].values.tolist() == [['NOR', 2013]]


def test_merge_output_columns_and_sort_order():
    dem = data.clean_democracy(democracy_raw([
        ('Sweden', 'SWE', 2014, 9.7), ('Norway', 'NOR', 2014, 9.9), ('Norway', 'NOR', 2013, 9.9),
    ]))
    press = data.clean_press(press_raw([
        (2014.0, 'Sweden', 'SWE', 1.0, 90.0, math.nan),
        (2014.0, 'Norway', 'NOR', 2.0, 91.0, math.nan),
        (2013.0, 'Norway', 'NOR', 3.0, 92.0, math.nan),
    ]))
    merged = data.merge_sources(dem, press)
    assert list(merged.columns) == data.COLUMNS
    assert merged[['Country', 'Year']].values.tolist() == [['Norway', 2013], ['Norway', 2014], ['Sweden', 2014]]


def test_merge_of_empty_inputs_is_empty_not_an_error():
    dem = data.clean_democracy(democracy_raw([]))
    press = data.clean_press(press_raw([]))
    merged = data.merge_sources(dem, press)
    assert merged.empty
    assert list(merged.columns) == data.COLUMNS


# ---------------------------------------------------------------- file loading

def test_load_and_merge_works_from_any_working_directory(tmp_path, monkeypatch):
    """BUG-6: data.py used relative paths, so it failed unless run from backend/."""
    monkeypatch.chdir(tmp_path)
    merged = data.load_and_merge()
    assert len(merged) > 0


def test_load_processed_rebuilds_a_missing_file(tmp_path):
    target = tmp_path / 'processed.csv'
    df = data.load_processed(target)
    assert target.exists()
    assert list(df.columns) == data.COLUMNS


def test_load_processed_rebuilds_a_file_from_an_older_merge(tmp_path):
    # an earlier version of the merge wrote no ISO column
    target = tmp_path / 'processed.csv'
    pd.DataFrame({'Country': ['Norway'], 'Year': [2013], 'DemocracyScore': [9.9],
                  'PressFreedomScore': [93.5]}).to_csv(target, index=False)
    df = data.load_processed(target)
    assert list(df.columns) == data.COLUMNS
    assert len(df) > 1


@pytest.mark.parametrize('column', ['DemocracyScore', 'PressFreedomScore'])
def test_load_processed_drops_rows_with_a_missing_score(tmp_path, column):
    target = tmp_path / 'processed.csv'
    rows = pd.DataFrame({'Country': ['A', 'B'], 'ISO': ['AAA', 'BBB'], 'Year': [2020, 2020],
                         'DemocracyScore': [5.0, 6.0], 'PressFreedomScore': [50.0, 60.0]})
    rows.loc[1, column] = math.nan
    rows.to_csv(target, index=False)
    assert data.load_processed(target)['Country'].tolist() == ['A']
