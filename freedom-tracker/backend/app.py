"""
Flask API backend for the Global Freedom Tracker React frontend.
Wraps the same pandas data logic from the original Dash app, but returns
JSON instead of rendering server-side — React handles all visualisation.
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask.json.provider import DefaultJSONProvider
import pandas as pd
import numpy as np
import os


class NumpyJSONProvider(DefaultJSONProvider):
    """
    pandas aggregations like .mean() and .round() return numpy scalar types
    (int64, float64) which the stdlib json module can't serialize by default.
    This provider converts them to native Python types before encoding so we
    never hit a 'Object of type int64 is not JSON serializable' error.
    """

    @staticmethod
    def default(obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return DefaultJSONProvider.default(obj)


app = Flask(__name__)
app.json = NumpyJSONProvider(app)

# allow all origins so the Vite dev server on localhost:5173 can hit localhost:5000
CORS(app)


def load_data():
    """
    Load the pre-merged democracy/press freedom dataset.
    If the merged CSV doesn't exist yet (first run), it builds it from the
    raw source files using the data.py merge script and saves the result.
    Rows missing either score are dropped because they can't be plotted.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    merged_path = os.path.join(here, 'democracy_press_freedom_data.csv')

    if os.path.exists(merged_path):
        df = pd.read_csv(merged_path)
    else:
        # build from raw sources if the merged file isn't present
        from data import load_and_merge
        df = load_and_merge()
        df.to_csv(merged_path, index=False)

    # drop rows where either score is null — incomplete rows can't be used in any chart
    df = df.dropna(subset=['DemocracyScore', 'PressFreedomScore'])

    # cast Year to int so comparisons like df['Year'] == 2023 work reliably
    df['Year'] = df['Year'].astype(int)
    return df


# load the dataset once at startup and keep it in memory for all requests
df = load_data()

# year range derived from the data — used across multiple endpoints
YEAR_MIN = int(df['Year'].min())
YEAR_MAX = int(df['Year'].max())


@app.route('/api/meta')
def meta():
    """
    Returns global stats shown in the stat card footer across all tabs.
    Uses the most recent year (YEAR_MAX) as the reference point for averages
    and top/bottom countries so numbers are current, not historical averages.
    """
    latest = df[df['Year'] == YEAR_MAX]
    avg_democracy = round(latest['DemocracyScore'].mean(), 1)

    # idxmax/idxmin return the row index of the highest/lowest scoring country
    top_country    = latest.loc[latest['DemocracyScore'].idxmax()]
    bottom_country = latest.loc[latest['DemocracyScore'].idxmin()]

    return jsonify({
        'countriesAnalysed': int(df['Country'].nunique()),
        'avgDemocracyScore': avg_democracy,
        'topCountry':        top_country['Country'],
        'topScore':          round(top_country['DemocracyScore'], 1),
        'bottomCountry':     bottom_country['Country'],
        'bottomScore':       round(bottom_country['DemocracyScore'], 1),
        'yearMin':           YEAR_MIN,
        'yearMax':           YEAR_MAX,
        'yearsAvailable':    YEAR_MAX - YEAR_MIN + 1
    })


@app.route('/api/map')
def map_data():
    """
    Returns per-country scores for the chosen year and metric, plus year-on-year
    change values and the most improved/most declined countries.
    Used by the Global Map tab to colour each country and populate the tooltip.
    """
    year   = int(request.args.get('year', YEAR_MAX))
    metric = request.args.get('metric', 'DemocracyScore')

    year_df = df[df['Year'] == year]
    # previous year used to calculate year-on-year deltas
    prev_df = df[df['Year'] == year - 1]

    rows = []
    for _, row in year_df.iterrows():
        prev_row = prev_df[prev_df['Country'] == row['Country']]
        change = None
        # only calculate change if there's a previous year to compare against
        if not prev_row.empty:
            change = round(row[metric] - prev_row.iloc[0][metric], 2)
        rows.append({
            'country':           row['Country'],
            'democracyScore':    round(row['DemocracyScore'], 2),
            'pressFreedomScore': round(row['PressFreedomScore'], 2),
            'value':             round(row[metric], 2),
            'change':            change
        })

    avg_val = round(year_df[metric].mean(), 2)

    # calculate most improved and most declined by merging current and previous year
    most_improved = None
    most_declined = None
    if not prev_df.empty:
        merged = year_df.merge(prev_df, on='Country', suffixes=('', '_prev'))
        merged['delta'] = merged[metric] - merged[f'{metric}_prev']
        if not merged.empty:
            best  = merged.loc[merged['delta'].idxmax()]
            worst = merged.loc[merged['delta'].idxmin()]
            most_improved = {'country': best['Country'],  'delta': round(best['delta'],  2)}
            most_declined = {'country': worst['Country'], 'delta': round(worst['delta'], 2)}

    return jsonify({
        'year':         year,
        'metric':       metric,
        'rows':         rows,
        'globalAverage': avg_val,
        'mostImproved': most_improved,
        'mostDeclined': most_declined,
        'countryCount': len(rows)
    })


@app.route('/api/countries')
def country_list():
    """Returns a sorted list of all unique country names in the dataset."""
    return jsonify(sorted(df['Country'].unique().tolist()))


@app.route('/api/country/<country>')
def country_trend(country):
    """
    Returns the full time series and summary stats for a single country.
    Used by the Country Trends tab to draw the line chart and populate stat cards.
    The ranking is calculated against whichever year the country has data for most recently
    — some countries are missing 2023 data, so we don't hardcode YEAR_MAX here.
    """
    sub = df[df['Country'] == country].sort_values('Year')
    if sub.empty:
        return jsonify({'error': 'No data for this country'}), 404

    # build the time series array that feeds the line chart
    series = [
        {
            'year':              int(r['Year']),
            'democracyScore':    round(r['DemocracyScore'], 2),
            'pressFreedomScore': round(r['PressFreedomScore'], 2)
        }
        for _, r in sub.iterrows()
    ]

    # overall change from first to last data point for this country
    first, last = sub.iloc[0], sub.iloc[-1]
    democracy_change = round(last['DemocracyScore']    - first['DemocracyScore'],    2)
    press_change     = round(last['PressFreedomScore'] - first['PressFreedomScore'], 2)

    sub = sub.reset_index(drop=True)

    # find the sharpest single-year drop in press freedom using pandas .diff()
    # diff() gives year-on-year change for each row; idxmin finds the worst drop
    sharpest_drop = None
    if len(sub) > 1:
        diffs   = sub['PressFreedomScore'].diff()
        min_idx = diffs.idxmin()
        if pd.notna(diffs[min_idx]) and diffs[min_idx] < 0:
            sharpest_drop = {
                'fromYear': int(sub.loc[min_idx - 1, 'Year']),
                'toYear':   int(sub.loc[min_idx,     'Year']),
                'delta':    float(round(diffs[min_idx], 1))
            }

    # rank this country against all others in its most recent data year
    # using method='min' means ties share the better rank (e.g. both get rank 3, not 3 and 4)
    country_latest_year = int(sub.iloc[-1]['Year'])
    ranking_year_df     = df[df['Year'] == country_latest_year].copy()
    ranking_year_df['democracyRank'] = ranking_year_df['DemocracyScore'].rank(
        ascending=False, method='min'
    ).astype(int)
    ranking_year_df['pressRank'] = ranking_year_df['PressFreedomScore'].rank(
        ascending=False, method='min'
    ).astype(int)
    country_row = ranking_year_df[ranking_year_df['Country'] == country]

    ranking = None
    if not country_row.empty:
        ranking = {
            'democracyRank':  int(country_row.iloc[0]['democracyRank']),
            'pressRank':      int(country_row.iloc[0]['pressRank']),
            'totalCountries': int(len(ranking_year_df)),
            'rankingYear':    country_latest_year
        }

    return jsonify({
        'country':                   country,
        'series':                    series,
        'latestDemocracy':           round(last['DemocracyScore'],    2),
        'latestPress':               round(last['PressFreedomScore'], 2),
        # year-on-year change for the most recent year (shown in stat cards)
        'democracyChangeVsPrevYear': round(
            sub.iloc[-1]['DemocracyScore'] - sub.iloc[-2]['DemocracyScore'], 2
        ) if len(sub) > 1 else None,
        'pressChangeVsPrevYear':     round(
            sub.iloc[-1]['PressFreedomScore'] - sub.iloc[-2]['PressFreedomScore'], 2
        ) if len(sub) > 1 else None,
        # full-period change (first to last row for this country)
        'tenYearChangeDemocracy':    democracy_change,
        'tenYearChangePress':        press_change,
        'avgDemocracy':              round(sub['DemocracyScore'].mean(),    2),
        'avgPress':                  round(sub['PressFreedomScore'].mean(), 2),
        'sharpestDrop':              sharpest_drop,
        'ranking':                   ranking,
        'yearsAvailable':            len(sub)
    })


@app.route('/api/correlation')
def correlation():
    """
    Returns scatter plot data plus Pearson r, R², and OLS trendline coefficients.
    year param can be 'all' (full dataset) or a specific year string.
    Used by the Correlation tab.
    """
    year_param = request.args.get('year', 'all')

    # filter to a single year if requested, otherwise use the full dataset
    if year_param == 'all':
        plot_df = df
    else:
        plot_df = df[df['Year'] == int(year_param)]

    if plot_df.empty:
        return jsonify({'error': 'No data'}), 404

    # Pearson correlation between the two scores
    corr       = plot_df['DemocracyScore'].corr(plot_df['PressFreedomScore'])
    r_squared  = corr ** 2 if pd.notna(corr) else None

    # build the array of scatter points for the frontend
    points = [
        {
            'country':           r['Country'],
            'year':              int(r['Year']),
            'democracyScore':    round(r['DemocracyScore'],    2),
            'pressFreedomScore': round(r['PressFreedomScore'], 2)
        }
        for _, r in plot_df.iterrows()
    ]

    # fit a 1st-degree polynomial (straight line) to get slope and intercept
    # np.polyfit returns [slope, intercept] for degree 1
    x = plot_df['DemocracyScore'].values
    y = plot_df['PressFreedomScore'].values
    slope, intercept = np.polyfit(x, y, 1)

    return jsonify({
        'year':       year_param,
        'points':     points,
        'pearsonR':   round(corr,      3) if pd.notna(corr)      else None,
        'rSquared':   round(r_squared, 3) if r_squared is not None else None,
        'sampleSize': len(plot_df),
        'trendline':  {'slope': round(slope, 4), 'intercept': round(intercept, 4)}
    })


@app.route('/api/summary')
def summary():
    """
    Returns the top/bottom 10 country rankings, score histograms, and dataset totals.
    Rankings use a combined score that weights democracy and press freedom equally.
    Press freedom is rescaled from 0–100 to 0–10 before averaging so neither metric
    dominates just because of its larger numeric range.
    Used by the Data Summary tab.
    """
    latest = df[df['Year'] == YEAR_MAX].copy()

    # normalise press freedom to the same 0–10 scale as democracy before combining
    latest['normDemocracy']  = latest['DemocracyScore']
    latest['normPress']      = latest['PressFreedomScore'] / 10
    latest['combinedScore']  = (latest['normDemocracy'] + latest['normPress']) / 2

    # nlargest/nsmallest are faster than sort + head for getting top/bottom N rows
    top10    = latest.nlargest(10,  'combinedScore')[['Country', 'DemocracyScore', 'PressFreedomScore', 'combinedScore']]
    bottom10 = latest.nsmallest(10, 'combinedScore')[['Country', 'DemocracyScore', 'PressFreedomScore', 'combinedScore']]

    def to_rows(sub_df):
        """Converts a DataFrame slice to a list of dicts for JSON serialization."""
        return [
            {
                'country':           r['Country'],
                'democracyScore':    round(r['DemocracyScore'],    1),
                'pressFreedomScore': round(r['PressFreedomScore'], 1),
                'combinedScore':     round(r['combinedScore'],     1)
            }
            for _, r in sub_df.iterrows()
        ]

    def histogram(series, bins=10):
        """
        Bins a pandas Series into a histogram using numpy and returns it as a list of
        {binStart, binEnd, count} dicts that Recharts' BarChart can consume directly.
        """
        counts, edges = np.histogram(series.dropna(), bins=bins)
        return [
            {
                'binStart': round(edges[i],     1),
                'binEnd':   round(edges[i + 1], 1),
                'count':    int(counts[i])
            }
            for i in range(len(counts))
        ]

    # find the country where democracy and press freedom scores diverge the most
    # (after normalising press freedom to 0–10 so the gap is on a comparable scale)
    gap_row = latest.copy()
    gap_row['gap'] = (gap_row['normDemocracy'] - gap_row['normPress']).abs()
    biggest_gap = gap_row.loc[gap_row['gap'].idxmax()]

    return jsonify({
        'year':                 YEAR_MAX,
        'totalCountries':       int(df['Country'].nunique()),
        'totalYears':           int(df['Year'].nunique()),
        'totalRecords':         len(df),
        'democracyHistogram':   histogram(latest['DemocracyScore']),
        'pressHistogram':       histogram(latest['PressFreedomScore']),
        'top10':                to_rows(top10),
        'bottom10':             to_rows(bottom10),
        'biggestGapCountry': {
            'country':           biggest_gap['Country'],
            'democracyScore':    round(biggest_gap['DemocracyScore'],    1),
            'pressFreedomScore': round(biggest_gap['PressFreedomScore'], 1)
        },
        # average combined score gap between the best and worst performing groups
        'scoreGapTopVsBottom':  round(
            top10['combinedScore'].mean() - bottom10['combinedScore'].mean(), 1
        )
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)