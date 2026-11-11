"""NumpyJSONProvider must turn NumPy types, NaN and infinity into valid JSON."""
import json
import math

import numpy as np
import pytest
from flask import jsonify

from app import create_app


@pytest.fixture
def app(fixture_df):
    return create_app(df=fixture_df)


def strict_loads(text):
    """json.loads that rejects the non-standard NaN / Infinity tokens."""
    def reject(token):
        raise ValueError(f'non-standard JSON token: {token}')
    return json.loads(text, parse_constant=reject)


@pytest.mark.parametrize('value, expected', [
    (np.int64(7), 7),
    (np.int32(-3), -3),
    (np.float64(1.25), 1.25),
    (np.float32(2.5), 2.5),
    (np.bool_(True), True),
    (np.bool_(False), False),
    (np.array([1, 2, 3]), [1, 2, 3]),
])
def test_numpy_types_become_plain_json(app, value, expected):
    assert strict_loads(app.json.dumps({'v': value})) == {'v': expected}


@pytest.mark.parametrize('value', [
    float('nan'), float('inf'), float('-inf'),
    np.float64('nan'), np.float64('inf'), np.float32('nan'), np.float32('-inf'),
])
def test_non_finite_values_become_null(app, value):
    assert strict_loads(app.json.dumps({'v': value})) == {'v': None}


def test_non_finite_values_nested_in_lists_tuples_dicts_and_arrays(app):
    payload = {
        'list': [1.0, math.nan],
        'tuple': (math.inf, 2),
        'nested': {'deeper': [{'x': np.float64('nan')}]},
        'array': np.array([1.5, np.nan, np.inf]),
    }
    assert strict_loads(app.json.dumps(payload)) == {
        'list': [1.0, None],
        'tuple': [None, 2],
        'nested': {'deeper': [{'x': None}]},
        'array': [1.5, None, None],
    }


def test_jsonify_response_body_is_strict_json(app):
    with app.app_context():
        body = jsonify(score=np.float64('nan'), count=np.int64(3)).get_data(as_text=True)
    assert strict_loads(body) == {'score': None, 'count': 3}


def test_unsupported_types_still_raise(app):
    with pytest.raises(TypeError):
        app.json.dumps({'v': object()})
