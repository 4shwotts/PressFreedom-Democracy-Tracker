"""
Data quality checks against the real dataset files.

These are deliberately strict: if a data file is replaced with one that's
incomplete, out of range or differently shaped, they should fail loudly
rather than let the dashboard quietly show wrong numbers. The expected counts
describe the current files — update them only after checking a new file by hand.
"""
import pandas as pd
import pytest

import data

pytestmark = pytest.mark.data_quality

EXPECTED_YEARS = list(range(2013, 2024))      # 2013-2023 inclusive
EXPECTED_COUNTRIES = 167
# 19 countries have no 2023 democracy score in the source upload (known gap,
# documented on the about-the-data page), so 2023 has 148 rows
EXPECTED_ROWS_PER_YEAR = {**{y: 167 for y in range(2013, 2023)}, 2023: 148}


@pytest.fixture(scope='module')
def processed():
    return pd.read_csv(data.PROCESSED_CSV)


@pytest.fixture(scope='module')
def democracy_raw():
    return pd.read_csv(data.DEMOCRACY_CSV)


@pytest.fixture(scope='module')
def press_raw():
    return pd.read_csv(data.PRESS_CSV)


# ---------------------------------------------------------------- processed dataset

def test_processed_has_the_expected_columns(processed):
    assert list(processed.columns) == data.COLUMNS


def test_processed_has_no_missing_values(processed):
    missing = processed.isna().sum()
    assert missing.sum() == 0, f'missing values per column:\n{missing[missing > 0]}'


def test_every_country_has_a_valid_iso_code(processed):
    bad = processed[~processed['ISO'].astype(str).str.fullmatch(r'[A-Z]{3}')]
    assert bad.empty, f'invalid ISO codes:\n{bad[["Country", "ISO"]].drop_duplicates()}'


def test_each_country_has_exactly_one_iso_code_and_vice_versa(processed):
    pairs = processed[['Country', 'ISO']].drop_duplicates()
    assert pairs['Country'].is_unique and pairs['ISO'].is_unique


@pytest.mark.parametrize('column, bounds', [
    ('DemocracyScore', data.DEMOCRACY_RANGE),
    ('PressFreedomScore', data.PRESS_FREEDOM_RANGE),
])
def test_scores_are_within_their_valid_range(processed, column, bounds):
    low, high = bounds
    out = processed[~processed[column].between(low, high)]
    assert out.empty, f'{column} outside {low}-{high}:\n{out}'


def test_no_duplicate_country_year_rows(processed):
    dupes = processed[processed.duplicated(['ISO', 'Year'], keep=False)]
    assert dupes.empty, f'duplicate country-years:\n{dupes}'


def test_years_are_2013_to_2023(processed):
    assert sorted(processed['Year'].unique()) == EXPECTED_YEARS


def test_expected_number_of_countries(processed):
    assert processed['Country'].nunique() == EXPECTED_COUNTRIES


def test_expected_number_of_countries_each_year(processed):
    assert processed.groupby('Year').size().to_dict() == EXPECTED_ROWS_PER_YEAR


def test_no_country_has_a_gap_in_the_middle_of_its_years(processed):
    gaps = [
        country for country, g in processed.groupby('Country')
        if sorted(g['Year']) != list(range(g['Year'].min(), g['Year'].max() + 1))
    ]
    assert gaps == []


def test_tracked_processed_file_matches_a_fresh_rebuild(processed):
    """The committed CSV must be exactly what data.py builds from the raw files."""
    rebuilt = data.load_and_merge()
    pd.testing.assert_frame_equal(
        processed.reset_index(drop=True), rebuilt.reset_index(drop=True), check_dtype=False)


# ---------------------------------------------------------------- raw source files

def test_raw_democracy_has_the_expected_columns(democracy_raw):
    assert list(democracy_raw.columns) == ['Entity', 'ISO', 'Year', 'Democracy score']


def test_raw_press_freedom_has_the_expected_columns(press_raw):
    assert list(press_raw.columns) == ['Year', 'Country', 'ISO', 'Rank', 'Score', 'Zone']


def test_raw_democracy_scores_in_range(democracy_raw):
    assert democracy_raw['Democracy score'].between(*data.DEMOCRACY_RANGE).all()


def test_raw_press_freedom_scores_in_range(press_raw):
    scores = press_raw['Score'].dropna()
    assert scores.between(*data.PRESS_FREEDOM_RANGE).all()


def test_raw_files_have_no_duplicate_country_years(democracy_raw, press_raw):
    assert not democracy_raw.dropna(subset=['ISO']).duplicated(['ISO', 'Year']).any()
    assert not press_raw.dropna(how='all').duplicated(['ISO', 'Year']).any()


def test_raw_press_freedom_covers_2013_to_2023(press_raw):
    assert sorted(press_raw['Year'].dropna().astype(int).unique()) == EXPECTED_YEARS


def test_raw_democracy_covers_2013_to_2023(democracy_raw):
    assert set(EXPECTED_YEARS) <= set(democracy_raw['Year'].unique())


def test_every_processed_score_is_traceable_to_the_raw_files(processed, democracy_raw, press_raw):
    """Processing must never change a value: each score appears unchanged in its source."""
    dem = democracy_raw.rename(columns={'Democracy score': 'DemocracyScore'})
    press = press_raw.dropna(how='all').rename(columns={'Score': 'PressFreedomScore'})
    press = press.astype({'Year': int})
    checked = (processed
               .merge(dem[['ISO', 'Year', 'DemocracyScore']], on=['ISO', 'Year'], suffixes=('', '_raw'))
               .merge(press[['ISO', 'Year', 'PressFreedomScore']], on=['ISO', 'Year'], suffixes=('', '_raw')))
    assert len(checked) == len(processed)
    assert (checked['DemocracyScore'] == checked['DemocracyScore_raw']).all()
    assert (checked['PressFreedomScore'] == checked['PressFreedomScore_raw']).all()
