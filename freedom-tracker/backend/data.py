"""
Loading, cleaning and merging of the two source datasets.

Sources (see the about-the-data page and README for full attribution):
- democracy_index.csv: EIU Democracy Index overall scores (0-10), via the Kaggle
  upload "Global Democracy Index (2006-2023)". Columns: Entity, ISO, Year,
  Democracy score.
- press_freedom_index.csv: RSF World Press Freedom Index scores (0-100), via the
  Kaggle upload "World Press Freedom Index". Columns: Year, Country, ISO, Rank,
  Score, Zone.

Cleaning rules — the source values are never altered, only filtered:
1. Democracy rows without an ISO code, or with an OWID_ code, are regional or
   world aggregates (Africa, Asia, World...) rather than countries: dropped.
2. Press freedom rows that are entirely blank (separator rows between years in
   the source file) are dropped.
3. Rows with a missing score, ISO code or year are dropped.
4. The datasets are joined on ISO code + year (inner join), never on country
   name. The press freedom file renames countries between years (e.g. "Russian
   Federation" -> "Russia") and has two corrupted names (Côte d'Ivoire,
   Türkiye), so names would silently drop rows. Country names come from the
   democracy dataset, which is consistent across years.
5. Only country-years present in both datasets are kept, so the year range is
   the overlap of the two sources (2013-2023 for the current files).
6. The press freedom Rank and Zone columns are not used: ranks shown in the
   dashboard are calculated among the countries in this dataset (see analysis.py).
"""
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent
DEMOCRACY_CSV = DATA_DIR / 'democracy_index.csv'
PRESS_CSV = DATA_DIR / 'press_freedom_index.csv'
PROCESSED_CSV = DATA_DIR / 'democracy_press_freedom_data.csv'

# column order of the processed dataset
COLUMNS = ['Country', 'ISO', 'Year', 'DemocracyScore', 'PressFreedomScore']

# valid score ranges, used by the data quality tests and the about-the-data page
DEMOCRACY_RANGE = (0.0, 10.0)
PRESS_FREEDOM_RANGE = (0.0, 100.0)


def clean_democracy(raw: pd.DataFrame) -> pd.DataFrame:
    """Applies cleaning rules 1 and 3 to the raw democracy data."""
    dem = raw[['Entity', 'ISO', 'Year', 'Democracy score']].rename(columns={
        'Entity': 'Country',
        'Democracy score': 'DemocracyScore',
    })
    dem = dem.dropna(subset=['ISO', 'Year', 'DemocracyScore'])
    dem = dem[~dem['ISO'].str.startswith('OWID')]
    return dem.astype({'Year': int}).reset_index(drop=True)


def clean_press(raw: pd.DataFrame) -> pd.DataFrame:
    """Applies cleaning rules 2 and 3 to the raw press freedom data."""
    press = raw.dropna(how='all')
    press = press[['Year', 'ISO', 'Score']].rename(columns={'Score': 'PressFreedomScore'})
    press = press.dropna(subset=['ISO', 'Year', 'PressFreedomScore'])
    # Year is read as a float because of the blank rows — safe to cast once they're gone
    return press.astype({'Year': int}).reset_index(drop=True)


def merge_sources(democracy: pd.DataFrame, press: pd.DataFrame) -> pd.DataFrame:
    """Applies rules 4 and 5: inner join on ISO + year, names from the democracy data."""
    merged = democracy.merge(press, on=['ISO', 'Year'], how='inner')
    merged = merged.sort_values(['Country', 'Year']).reset_index(drop=True)
    return merged[COLUMNS]


def load_and_merge(democracy_path=DEMOCRACY_CSV, press_path=PRESS_CSV) -> pd.DataFrame:
    """Builds the processed dataset from the raw source files."""
    democracy = clean_democracy(pd.read_csv(democracy_path))
    press = clean_press(pd.read_csv(press_path))
    return merge_sources(democracy, press)


def load_processed(path=PROCESSED_CSV) -> pd.DataFrame:
    """
    Loads the processed dataset the API serves. It's rebuilt from the raw files
    (and saved) if it's missing or was written by an older version of the merge
    that didn't include ISO codes.
    """
    path = Path(path)
    df = pd.read_csv(path) if path.exists() else None
    if df is None or list(df.columns) != COLUMNS:
        df = load_and_merge()
        df.to_csv(path, index=False)
    df = df.dropna(subset=['DemocracyScore', 'PressFreedomScore'])
    return df.astype({'Year': int}).reset_index(drop=True)


if __name__ == '__main__':
    # python data.py — rebuilds the processed CSV from the raw files
    rebuilt = load_and_merge()
    rebuilt.to_csv(PROCESSED_CSV, index=False)
    print(f'Wrote {len(rebuilt)} rows ({rebuilt["Country"].nunique()} countries, '
          f'{rebuilt["Year"].min()}-{rebuilt["Year"].max()}) to {PROCESSED_CSV.name}')
