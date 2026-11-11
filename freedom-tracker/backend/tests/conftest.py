"""
Shared fixtures.

FIXTURE is a small hand-made dataset whose expected results are worked out by
hand in the tests. It's designed to exercise the awkward cases:
- years either side of RSF's 2022 methodology change (2020-2023)
- a democracy-score tie in 2022 and 2023 (Bravo and Delta both 6.0)
- a country with no 2023 data (Echo), like the 19 real countries without it
- a fall in press freedom that crosses the methodology change (Alpha 70 -> 50)
"""
import sys
from pathlib import Path

import pandas as pd
import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app import create_app  # noqa: E402

ROWS = [
    # Country,  ISO,  Year, Democracy, Press freedom
    ('Alpha',   'AAA', 2020, 8.0, 80.0),
    ('Alpha',   'AAA', 2021, 8.0, 70.0),
    ('Alpha',   'AAA', 2022, 7.0, 50.0),
    ('Alpha',   'AAA', 2023, 7.6, 56.0),
    ('Bravo',   'BBB', 2020, 6.0, 60.0),
    ('Bravo',   'BBB', 2021, 6.5, 62.0),
    ('Bravo',   'BBB', 2022, 6.0, 58.0),
    ('Bravo',   'BBB', 2023, 6.0, 60.0),
    ('Charlie', 'CCC', 2020, 4.0, 40.0),
    ('Charlie', 'CCC', 2021, 3.0, 45.0),
    ('Charlie', 'CCC', 2022, 3.0, 35.0),
    ('Charlie', 'CCC', 2023, 2.0, 30.0),
    ('Delta',   'DDD', 2020, 6.0, 50.0),
    ('Delta',   'DDD', 2021, 6.5, 50.0),
    ('Delta',   'DDD', 2022, 6.0, 66.0),
    ('Delta',   'DDD', 2023, 6.0, 62.0),
    ('Echo',    'EEE', 2020, 2.0, 20.0),
    ('Echo',    'EEE', 2021, 2.0, 25.0),
    ('Echo',    'EEE', 2022, 2.0, 20.0),
]


def make_df(rows=ROWS):
    return pd.DataFrame(rows, columns=['Country', 'ISO', 'Year', 'DemocracyScore', 'PressFreedomScore'])


@pytest.fixture
def fixture_df():
    return make_df()


@pytest.fixture
def client(fixture_df):
    """Test client around the hand-made dataset."""
    return create_app(df=fixture_df, cors_origins='https://frontend.example').test_client()


@pytest.fixture(scope='session')
def real_app():
    """App around the real processed dataset (loaded once per test run)."""
    return create_app(cors_origins='https://frontend.example')


@pytest.fixture
def real_client(real_app):
    return real_app.test_client()
