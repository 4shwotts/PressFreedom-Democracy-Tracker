"""
API tests with Flask's test client: shapes, status codes, error handling and
strict JSON. Most use the hand-made fixture dataset; a few smoke tests run
every endpoint against the real data.
"""
import json

import pandas as pd
import pytest

import analysis
from app import create_app


def strict_json(response):
    """Parses a response body as strict JSON (NaN/Infinity tokens rejected)."""
    def reject(token):
        raise ValueError(f'non-standard JSON token: {token}')
    return json.loads(response.get_data(as_text=True), parse_constant=reject)


def assert_json_error(response, status):
    assert response.status_code == status
    assert response.mimetype == 'application/json'
    body = strict_json(response)
    assert set(body) == {'error'} and isinstance(body['error'], str) and body['error']
    text = response.get_data(as_text=True)
    assert 'Traceback' not in text and '<html' not in text.lower()


# ---------------------------------------------------------------- shapes and status codes

def test_health_is_ok_and_does_no_data_work(client):
    r = client.get('/api/health')
    assert r.status_code == 200 and strict_json(r) == {'status': 'ok'}


def test_meta_shape(client):
    body = strict_json(client.get('/api/meta'))
    assert set(body) == {
        'countriesAnalysed', 'avgDemocracyScore', 'avgDemocracyYear', 'avgDemocracyCountryCount',
        'topCountry', 'topScore', 'bottomCountry', 'bottomScore', 'yearMin', 'yearMax', 'yearsAvailable'}


def test_map_shape_and_defaults_to_latest_year_democracy(client):
    body = strict_json(client.get('/api/map'))
    assert (body['year'], body['metric']) == (2023, 'DemocracyScore')
    assert set(body) == {'year', 'metric', 'rows', 'globalAverage', 'mostImproved', 'mostDeclined',
                         'countryCount', 'noDataThisYear', 'yearOnYearComparable'}
    assert set(body['rows'][0]) == {'country', 'iso', 'democracyScore', 'pressFreedomScore', 'value', 'change'}


def test_map_with_year_and_metric(client):
    body = strict_json(client.get('/api/map?year=2021&metric=PressFreedomScore'))
    assert (body['year'], body['metric'], body['countryCount']) == (2021, 'PressFreedomScore', 5)


def test_countries_sorted(client):
    assert strict_json(client.get('/api/countries')) == ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']


def test_country_trend_shape(client):
    body = strict_json(client.get('/api/country/Alpha'))
    assert set(body) == {
        'country', 'series', 'latestDemocracy', 'latestPress', 'democracyChangeVsPrevYear',
        'pressChangeVsPrevYear', 'tenYearChangeDemocracy', 'pressChangePeriods',
        'avgDemocracy', 'avgPress', 'sharpestDrop', 'ranking', 'yearsAvailable'}


def test_country_name_with_spaces_and_apostrophe(real_client):
    for name in ['United States', "Cote d'Ivoire"]:
        assert strict_json(real_client.get(f'/api/country/{name}'))['country'] == name


def test_correlation_all_years_and_single_year(client):
    every = strict_json(client.get('/api/correlation'))
    one = strict_json(client.get('/api/correlation?year=2023'))
    assert (every['year'], every['sampleSize'], len(every['points'])) == ('all', 19, 19)
    assert (one['year'], one['sampleSize']) == ('2023', 4)
    assert set(one) == {'year', 'points', 'pearsonR', 'rSquared', 'sampleSize', 'trendline'}


def test_summary_shape(client):
    body = strict_json(client.get('/api/summary'))
    assert body['year'] == 2023
    assert set(body['top10'][0]) == {'rank', 'country', 'democracyScore', 'pressFreedomScore', 'combinedScore'}


# ---------------------------------------------------------------- bad input: clean 400 / 404 JSON

@pytest.mark.parametrize('url', [
    '/api/map?year=abc', '/api/map?year=', '/api/map?year=2020.5', '/api/map?year=%20',
    '/api/map?year=2019', '/api/map?year=2024', '/api/map?year=-1',
    '/api/correlation?year=abc', '/api/correlation?year=', '/api/correlation?year=1999',
    '/api/correlation?year=ALL',
    '/api/map?metric=Bogus', '/api/map?metric=',
])
def test_bad_query_parameters_get_a_clean_400(client, url):
    assert_json_error(client.get(url), 400)


def test_year_error_message_states_the_range_from_the_data(client):
    # the fixture runs 2020-2023, so the message must say so (not a hard-coded 2013-2023)
    body = strict_json(client.get('/api/map?year=1999'))
    assert body['error'] == 'year must be a whole number between 2020 and 2023'


def test_year_range_follows_the_data_if_years_are_added(fixture_df):
    extra = fixture_df[fixture_df['Year'] == 2023].assign(Year=2024)
    app = create_app(df=pd.concat([fixture_df, extra]))
    assert app.test_client().get('/api/map?year=2024').status_code == 200


@pytest.mark.parametrize('url', ['/api/country/Atlantis', '/api/country/alpha', '/api/country/%20'])
def test_unknown_country_gets_a_clean_404(client, url):
    assert_json_error(client.get(url), 404)


@pytest.mark.parametrize('url', ['/api/nothing-here', '/api', '/', '/api/country/'])
def test_unknown_route_gets_a_json_404(client, url):
    assert_json_error(client.get(url), 404)


def test_wrong_method_gets_a_json_405(client):
    assert_json_error(client.post('/api/meta'), 405)


def test_unexpected_server_error_is_json_without_a_stack_trace(fixture_df, monkeypatch):
    app = create_app(df=fixture_df)

    def explode(_df):
        raise RuntimeError('secret internal detail')
    monkeypatch.setattr(analysis, 'meta_view', explode)
    r = app.test_client().get('/api/meta')
    assert_json_error(r, 500)
    assert 'secret internal detail' not in r.get_data(as_text=True)


# ---------------------------------------------------------------- CORS

def test_cors_allows_a_configured_origin(client):
    r = client.get('/api/meta', headers={'Origin': 'https://frontend.example'})
    assert r.headers.get('Access-Control-Allow-Origin') == 'https://frontend.example'


def test_cors_does_not_allow_other_origins(client):
    r = client.get('/api/meta', headers={'Origin': 'https://elsewhere.example'})
    assert 'Access-Control-Allow-Origin' not in r.headers


def test_cors_origins_from_environment_variable(fixture_df, monkeypatch):
    monkeypatch.setenv('CORS_ORIGINS', 'https://one.example, https://two.example')
    c = create_app(df=fixture_df).test_client()
    for origin in ['https://one.example', 'https://two.example']:
        assert c.get('/api/meta', headers={'Origin': origin}).headers['Access-Control-Allow-Origin'] == origin


def test_cors_defaults_to_local_dev_servers_only(fixture_df, monkeypatch):
    monkeypatch.delenv('CORS_ORIGINS', raising=False)
    c = create_app(df=fixture_df).test_client()
    assert c.get('/api/meta', headers={'Origin': 'http://localhost:5173'}).headers.get(
        'Access-Control-Allow-Origin') == 'http://localhost:5173'
    assert 'Access-Control-Allow-Origin' not in c.get(
        '/api/meta', headers={'Origin': 'https://press-freedom-democracy-tracker.vercel.app'}).headers


# ---------------------------------------------------------------- every endpoint on the real data

REAL_URLS = (
    ['/api/health', '/api/meta', '/api/countries', '/api/summary', '/api/correlation']
    + [f'/api/correlation?year={y}' for y in range(2013, 2024)]
    + [f'/api/map?year={y}&metric={m}' for y in range(2013, 2024) for m in analysis.METRICS]
)


@pytest.mark.parametrize('url', REAL_URLS)
def test_every_endpoint_returns_strict_json_on_real_data(real_client, url):
    r = real_client.get(url)
    assert r.status_code == 200 and r.mimetype == 'application/json'
    strict_json(r)


def test_every_country_trend_on_real_data(real_client):
    countries = strict_json(real_client.get('/api/countries'))
    assert len(countries) == 167
    for name in countries:
        r = real_client.get(f'/api/country/{name}')
        assert r.status_code == 200, name
        strict_json(r)
