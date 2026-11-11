"""
Flask API for the Global Press Freedom & Democracy Tracker frontend.

The calculations live in analysis.py and the data loading in data.py; this
module only handles HTTP: query parameter validation, JSON errors and CORS.

Environment variables
  CORS_ORIGINS  comma-separated list of origins allowed to call the API
                (e.g. the deployed frontend). Defaults to the local Vite dev
                and preview servers.
  FLASK_DEBUG   set to 1 to run `python app.py` with the Flask debugger.
"""
import logging
import math
import os

import numpy as np
from flask import Flask, jsonify, request
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

import analysis
from data import load_processed

LOCAL_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173'

log = logging.getLogger(__name__)


def _replace_non_finite(obj):
    """
    Recursively swaps NaN/Infinity floats for None so they serialise as null.
    The json module writes them as bare NaN/Infinity, which isn't valid JSON and
    makes JSON.parse fail in the browser. np.float64 subclasses float, so it's
    caught here too — it never reaches default() below.
    """
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _replace_non_finite(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_replace_non_finite(v) for v in obj]
    return obj


class NumpyJSONProvider(DefaultJSONProvider):
    """
    pandas and NumPy return NumPy scalar types (int64, float64, bool_) that the
    standard json module can't serialise. This provider converts them to plain
    Python types, and writes NaN/Infinity as null so the output is always valid JSON.
    """

    def dumps(self, obj, **kwargs):
        return super().dumps(_replace_non_finite(obj), **kwargs)

    @staticmethod
    def default(obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return _replace_non_finite(float(obj))
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return _replace_non_finite(obj.tolist())
        return DefaultJSONProvider.default(obj)


class BadRequest(Exception):
    """Raised for an invalid query parameter; becomes a 400 JSON response."""


def create_app(df=None, cors_origins=None):
    """
    Builds the Flask app around a processed dataset. Tests pass a small `df`;
    when it's omitted, the processed CSV is loaded.
    """
    df = load_processed() if df is None else df
    year_min, year_max = int(df['Year'].min()), int(df['Year'].max())

    app = Flask(__name__)
    app.json = NumpyJSONProvider(app)
    origins = cors_origins or os.environ.get('CORS_ORIGINS') or LOCAL_ORIGINS
    CORS(app, origins=[o.strip() for o in origins.split(',') if o.strip()])

    def parse_year(raw, default):
        """Validates a year query parameter against the years in the data."""
        if raw is None:
            return default
        try:
            year = int(raw)
        except ValueError:
            year = None
        if year is None or not year_min <= year <= year_max:
            raise BadRequest(f'year must be a whole number between {year_min} and {year_max}')
        return year

    # ---- errors: always JSON, never an HTML page or a stack trace

    @app.errorhandler(BadRequest)
    def bad_request(err):
        return jsonify({'error': str(err)}), 400

    @app.errorhandler(HTTPException)
    def http_error(err):
        return jsonify({'error': err.description}), err.code

    @app.errorhandler(Exception)
    def server_error(_err):
        log.exception('Unhandled error')
        return jsonify({'error': 'Internal server error'}), 500

    # ---- routes

    @app.get('/api/health')
    def health():
        """Deliberately does no data work: used to wake the server on page load."""
        return jsonify({'status': 'ok'})

    @app.get('/api/meta')
    def meta():
        return jsonify(analysis.meta_view(df))

    @app.get('/api/map')
    def map_data():
        year = parse_year(request.args.get('year'), year_max)
        metric = request.args.get('metric', analysis.DEMOCRACY)
        if metric not in analysis.METRICS:
            raise BadRequest(f"Invalid metric. Use one of: {', '.join(analysis.METRICS)}")
        return jsonify(analysis.map_view(df, year, metric))

    @app.get('/api/countries')
    def country_list():
        return jsonify(sorted(df['Country'].unique().tolist()))

    @app.get('/api/country/<country>')
    def country_trend(country):
        trend = analysis.country_trend(df, country)
        if trend is None:
            return jsonify({'error': 'No data for this country'}), 404
        return jsonify(trend)

    @app.get('/api/correlation')
    def correlation():
        raw = request.args.get('year', 'all')
        plot_df = df if raw == 'all' else df[df['Year'] == parse_year(raw, year_max)]
        points = [
            {'country': r['Country'], 'year': int(r['Year']),
             'democracyScore': round(float(r['DemocracyScore']), 2),
             'pressFreedomScore': round(float(r['PressFreedomScore']), 2)}
            for _, r in plot_df.iterrows()
        ]
        return jsonify({'year': raw, 'points': points, **analysis.correlation_stats(plot_df)})

    @app.get('/api/summary')
    def summary():
        return jsonify(analysis.summary_view(df, year_max))

    return app


# module-level app for gunicorn (`gunicorn app:app`) and `python app.py`
app = create_app()

if __name__ == '__main__':
    app.run(debug=os.environ.get('FLASK_DEBUG') == '1', port=5000)
