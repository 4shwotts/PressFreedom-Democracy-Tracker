import { useMemo, useEffect, useState } from 'react'
import {
  Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Customized
} from 'recharts'
import { api } from '../api'
import InsightPanel from '../components/InsightPanel'
import StatCard from '../components/StatCard'

// renders the OLS trendline as a plain SVG <line> element using the chart's own axis scale functions
// keeping it outside Recharts' series system (via Customized) means it never appears in the tooltip
// payload, so it can't accidentally block or steal hover events from the scatter dots
function TrendlineSVG({ xAxisMap, yAxisMap, trendline }) {
  if (!trendline) return null

  // xAxisMap and yAxisMap are objects keyed by axis ID — we grab the first (and only) entry
  const xAxis = xAxisMap && Object.values(xAxisMap)[0]
  const yAxis = yAxisMap && Object.values(yAxisMap)[0]
  if (!xAxis?.scale || !yAxis?.scale) return null

  // clamp y values so the line never draws outside the chart area
  const clamp = v => Math.max(0, Math.min(100, v))

  // convert data coordinates → pixel coordinates using the axis scale functions
  // x runs 0–10 (democracy), y runs 0–100 (press freedom)
  return (
    <line
      x1={xAxis.scale(0)}
      y1={yAxis.scale(clamp(trendline.intercept))}
      x2={xAxis.scale(10)}
      y2={yAxis.scale(clamp(trendline.slope * 10 + trendline.intercept))}
      stroke="#E11D48"
      strokeWidth={2.2}
      strokeDasharray="6 3"
      pointerEvents="none" // ensures mouse events pass through to the scatter dots below
    />
  )
}

// deterministic pseudo-random number in [0, 1) based on a seed integer
// using a sine-based hash so the output is consistent across renders
function seededRand(n) {
  const x = Math.sin(n * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

// produces a jitter offset for a given country name and axis
// same country always gets the same offset so dots don't jump around on re-renders
function jitter(str, axis) {
  // sum of char codes gives a stable seed — axis param shifts it so x and y offsets differ
  const seed = str.split('').reduce((a, c) => a + c.charCodeAt(0), axis === 'x' ? 7 : 99)
  return seededRand(seed) - 0.5 // centres the offset around 0 so it spreads in both directions
}

// jitter magnitudes — small enough that dots stay near their true position
// but large enough to separate overlapping points visually
const JITTER_X = 0.08
const JITTER_Y = 0.8

function buildInsights(corr) {
  if (!corr) return []

  // classify the correlation strength using standard thresholds
  const strength = corr.pearsonR === null ? 'unknown'
    : Math.abs(corr.pearsonR) > 0.7 ? 'strong'
    : Math.abs(corr.pearsonR) > 0.4 ? 'moderate' : 'weak'
  const direction = corr.pearsonR > 0 ? 'positive' : 'negative'

  return [
    {
      tone: 'info',
      title: 'Relationship Strength',
      body: `There is a <strong>${strength} ${direction}</strong> correlation (r = <strong>${corr.pearsonR}</strong>) between democracy and press freedom scores.`
    },
    {
      tone: corr.pearsonR > 0 ? 'improve' : 'decline',
      title: 'What This Means',
      body: corr.pearsonR > 0
        ? `Countries with higher democracy scores generally enjoy <strong>greater press freedom</strong> — the two metrics move together across the world.`
        : `Higher democracy scores correspond with <strong>lower press freedom</strong> in this sample — an unexpected inverse pattern worth investigating.`
    },
    {
      // R² tells us what fraction of the variance in press freedom is explained by democracy alone
      tone: 'neutral',
      title: 'Explained Variance',
      body: `An R² of <strong>${corr.rSquared}</strong> means roughly <strong>${Math.round(corr.rSquared * 100)}%</strong> of the variation in press freedom can be explained by democracy score alone.`
    },
    {
      tone: 'neutral',
      title: 'Outliers',
      body: `Countries far from the trendline score unusually high or low on one metric relative to the other — these are the most analytically interesting cases. <strong>Hover any dot</strong> to identify the country.`
    },
    {
      tone: 'info',
      title: 'Sample Size',
      body: `This analysis covers <strong>${corr.sampleSize.toLocaleString()}</strong> country-year observations. Use the year filter to isolate a single year or view all years together.`
    }
  ]
}

export default function CorrelationPage({ meta }) {
  // yearMode is either 'all' or a specific year string like '2019'
  const [yearMode, setYearMode] = useState('all')
  const [corr, setCorr]         = useState(null)
  const [loading, setLoading]   = useState(true)

  // re-fetch whenever the year filter changes
  useEffect(() => {
    setLoading(true)
    api.getCorrelation(yearMode)
      .then(d => { setCorr(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [yearMode])

  if (!meta) return null

  const isAllYears = yearMode === 'all'

  // apply jitter to each point and memoize so the offsets don't change on every render
  // jitter is baked into x/y here — the original democracyScore and pressFreedomScore are kept
  // on the object so the tooltip can still show the true values
  const scatterPoints = useMemo(() => {
    if (!corr?.points) return []
    return corr.points.map(p => ({
      ...p,
      x: +Math.max(0, Math.min(10,  p.democracyScore   + jitter(p.country, 'x') * JITTER_X)).toFixed(3),
      y: +Math.max(0, Math.min(100, p.pressFreedomScore + jitter(p.country, 'y') * JITTER_Y)).toFixed(3)
    }))
  }, [corr])

  // build year options array — 'all' first then each year in the dataset
  const yearOptions = ['all']
  for (let y = meta.yearMin; y <= meta.yearMax; y++) yearOptions.push(String(y))

  return (
    <div className="page-body">
      <InsightPanel insights={buildInsights(corr)} />

      <div>
        <div className="main-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Correlation</h2>
              <p className="panel-subtitle">
                Does democracy predict press freedom? Each dot is one country-year observation.
                {isAllYears && ' Select a specific year for a cleaner single-snapshot view.'}
              </p>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <label className="control-label">Select Year (or All Years)</label>
                <select
                  className="select-control"
                  value={yearMode}
                  onChange={e => setYearMode(e.target.value)}
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y === 'all' ? 'All Years' : y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="panel-info-box">
              <strong>About this chart:</strong> scatter plot showing how democracy scores relate
              to press freedom scores. The dashed red line is a fitted OLS trendline.
              Hover any dot to identify the country and see its scores.{' '}
              {/* warn the user that All Years stacks the same countries multiple times */}
              {isAllYears && (
                <span style={{ color: 'var(--color-neutral)', fontWeight: 600 }}>
                  Note: "All Years" plots each country once per year — select a specific
                  year for a single-snapshot view without repeated observations.
                </span>
              )}
            </div>
          </div>

          <div className="chart-container">
            {loading || !corr ? (
              <div className="loading-state">Loading correlation data…</div>
            ) : (
              // ScatterChart (not ComposedChart) — purpose-built for scatter plots
              // its hover/tooltip hit detection works correctly with Scatter series
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 16, bottom: 48, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />

                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, 10]}
                    stroke="var(--color-text-tertiary)"
                    fontSize={11.5}
                    tickLine={false}
                    tickCount={7}
                    label={{
                      value: 'Democracy Score (0–10)',
                      position: 'insideBottom',
                      offset: -16,
                      fontSize: 11.5,
                      fill: 'var(--color-text-tertiary)'
                    }}
                  />

                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[0, 100]}
                    stroke="var(--color-text-tertiary)"
                    fontSize={11.5}
                    tickLine={false}
                    tickCount={6}
                    label={{
                      value: 'Press Freedom Score (0–100)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 12,
                      fontSize: 11.5,
                      fill: 'var(--color-text-tertiary)'
                    }}
                  />

                  {/* tooltip reads payload[0].payload directly
                      ScatterChart only ever puts the hovered scatter point in payload[0]
                      because the trendline is Customized SVG, not a Recharts series */}
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      // safety check — trendline points have no country field
                      if (!d.country) return null
                      return (
                        <div style={{
                          background: 'var(--color-surface-raised)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          padding: '10px 14px',
                          fontSize: 12.5,
                          fontFamily: 'var(--font-body)',
                          boxShadow: 'var(--shadow-md)',
                          pointerEvents: 'none'
                        }}>
                          <strong style={{
                            fontSize: 14,
                            display: 'block',
                            marginBottom: 6,
                            color: 'var(--color-text-primary)'
                          }}>
                            {d.country}
                          </strong>
                          <span style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                            Democracy:{' '}
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                              {d.democracyScore}
                            </strong><br />
                            Press Freedom:{' '}
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                              {d.pressFreedomScore}
                            </strong>
                            {/* year only shown in All Years mode — in single-year mode it's redundant */}
                            {d.year && (
                              <><br />Year:{' '}
                              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                                {d.year}
                              </strong></>
                            )}
                          </span>
                        </div>
                      )
                    }}
                  />

                  {/* single Scatter series — using one series is critical for tooltip reliability
                      splitting into multiple series (e.g. one per colour) breaks hit detection */}
                  <Scatter
                    name="Countries"
                    data={scatterPoints}
                    fill="#2D7DD2"
                    // smaller and more transparent in All Years mode to reduce visual noise
                    fillOpacity={isAllYears ? 0.4 : 0.7}
                    r={isAllYears ? 3 : 5}
                    isAnimationActive={false}
                  />

                  {/* Customized lets us inject arbitrary SVG into the chart without
                      creating a Recharts series — the trendline lives here so it's
                      invisible to the tooltip and event system */}
                  <Customized
                    component={(props) => (
                      <TrendlineSVG
                        xAxisMap={props.xAxisMap}
                        yAxisMap={props.yAxisMap}
                        trendline={corr.trendline}
                      />
                    )}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>

          <p className="chart-hint" style={{ marginTop: 'var(--space-2)' }}>
            Hover any dot to see country details · Dashed red line = OLS trendline
          </p>
        </div>

        <div style={{ height: 'var(--space-3)' }} />

        {corr && (
          <div className="stat-row">
            <StatCard icon="up"    tone="accent"  value={corr.pearsonR}                    label="Pearson Correlation (r)" />
            <StatCard icon="globe" tone="accent"  value={corr.sampleSize.toLocaleString()}  label="Sample Size" />
            <StatCard icon="file"  tone="accent"  value={corr.rSquared}                    label="R squared (R²)" />
            <StatCard
              icon={corr.pearsonR > 0 ? 'up' : 'down'}
              tone={corr.pearsonR > 0 ? 'improve' : 'decline'}
              value={corr.pearsonR > 0 ? 'Positive' : 'Negative'}
              label="Trend Direction"
            />
            <StatCard icon="calendar" tone="neutral" value={isAllYears ? 'All Years' : yearMode} label="Selected Window" />
          </div>
        )}
      </div>
    </div>
  )
}