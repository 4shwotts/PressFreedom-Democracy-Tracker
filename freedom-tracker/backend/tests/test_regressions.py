"""
Regression tests for the bugs in BUGS.md, run against the real dataset.
Each test failed on the code before its fix.
"""
import pytest

import analysis


@pytest.mark.parametrize('url', ['/api/map?year=abc', '/api/map?year=', '/api/correlation?year=abc'])
def test_bug1_non_numeric_year_is_a_400_json_error_not_a_500(real_client, url):
    r = real_client.get(url)
    assert r.status_code == 400
    assert r.mimetype == 'application/json'


@pytest.mark.parametrize('url', ['/api/map?year=2030', '/api/correlation?year=1999'])
def test_bug2_year_outside_the_data_is_a_400_json_error(real_client, url):
    r = real_client.get(url)
    assert r.status_code == 400
    assert r.get_json()['error'] == 'year must be a whole number between 2013 and 2023'


def test_bug3_unknown_api_route_returns_json_not_html(real_client):
    r = real_client.get('/api/does-not-exist')
    assert r.status_code == 404
    assert r.mimetype == 'application/json'


def test_bug3_wrong_method_returns_json_not_html(real_client):
    r = real_client.post('/api/countries')
    assert r.status_code == 405
    assert r.mimetype == 'application/json'


def test_bug4_no_sharpest_drop_spans_the_2022_methodology_change(real_client):
    countries = real_client.get('/api/countries').get_json()
    crossing = [
        name for name in countries
        if (drop := real_client.get(f'/api/country/{name}').get_json()['sharpestDrop'])
        and analysis.crosses_methodology_change(drop['fromYear'], drop['toYear'])
    ]
    assert crossing == [], f'{len(crossing)} countries report a sharpest drop across 2021->2022'


def test_bug4_map_has_no_press_freedom_changes_into_2022(real_client):
    body = real_client.get('/api/map?year=2022&metric=PressFreedomScore').get_json()
    assert all(row['change'] is None for row in body['rows'])
    assert body['mostImproved'] is None and body['mostDeclined'] is None


def test_bug4_press_change_vs_previous_year_not_across_the_change(real_client):
    # Afghanistan's latest two data points are 2021 and 2022
    body = real_client.get('/api/country/Afghanistan').get_json()
    assert body['pressChangeVsPrevYear'] is None
