"""
The README must credit the right sources and quote figures that match the data.
BUG-10: it named V-Dem as the democracy source (the scores are the EIU's) and
gave out-of-date counts (161 countries, 1,732 observations).
"""
import os
import re
from pathlib import Path

import pandas as pd
import pytest

import data

# the README lives at the repository root, where GitHub shows it
README = Path(os.environ.get('README_PATH', Path(__file__).resolve().parents[3] / 'README.md'))


@pytest.fixture(scope='module')
def readme():
    return README.read_text(encoding='utf-8')


@pytest.fixture(scope='module')
def processed():
    return pd.read_csv(data.PROCESSED_CSV)


def test_readme_credits_the_score_owners(readme):
    assert 'Democracy Index © Economist Intelligence Unit' in readme
    assert 'World Press Freedom Index © Reporters Without Borders (RSF)' in readme


def test_readme_does_not_name_the_wrong_democracy_source(readme):
    assert not re.search(r'V-?Dem', readme, re.IGNORECASE)


def test_readme_credits_both_kaggle_uploads_and_their_licences(readme):
    assert 'kaggle.com/datasets/shreyasur965/democracy-index' in readme
    assert 'kaggle.com/datasets/batrosjamali/world-press-freedom-index' in readme
    assert 'CC0' in readme
    assert 'no licence stated' in readme


def test_readme_country_count_matches_the_data(readme, processed):
    stated = {int(n) for n in re.findall(r'(\d+)\s+countries', readme)}
    assert stated == {processed['Country'].nunique()}


def test_readme_observation_count_matches_the_data(readme, processed):
    # \s+ because Markdown paragraphs wrap across lines
    stated = {int(n.replace(',', '')) for n in re.findall(r'([\d,]+)\s+country-year\s+observations', readme)}
    assert stated == {len(processed)}


def test_readme_year_range_matches_the_data(readme, processed):
    span = f"{processed['Year'].min()} to {processed['Year'].max()}"
    assert span in readme


def test_no_licence_is_claimed_for_the_code(readme):
    """The code is all rights reserved: no licence heading, file or package field."""
    root = Path(__file__).resolve().parents[3]   # tests → backend → freedom-tracker → repository
    assert not re.search(r'^#+\s*Licen[cs]e\b', readme, re.MULTILINE | re.IGNORECASE)
    assert 'all rights reserved' in readme.lower()
    assert not any((d / name).exists()
                   for d in (root, root / 'freedom-tracker')
                   for name in ('LICENSE', 'LICENSE.md', 'LICENCE', 'LICENCE.md', 'COPYING'))
    package = (root / 'freedom-tracker' / 'frontend' / 'package.json').read_text(encoding='utf-8')
    assert '"license"' not in package
