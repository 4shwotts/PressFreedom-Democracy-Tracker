import { useMemo, useEffect, useRef, useState } from 'react'
import {
  Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Customized
} from 'recharts'
import { api } from '../api'
import InsightPanel from '../components/InsightPanel'
import StatCard from '../components/StatCard'
import { ZoomInIcon, ZoomOutIcon, ZoomResetIcon } from '../components/ZoomIcons'
import { useChartZoom } from '../useChartZoom'

// full axis extent — democracy runs 0–10, press freedom 0–100. This is the default
// view and the zoomed-out limit (module constant so the zoom hook gets a stable object)
const FULL_VIEW = { x0: 0, x1: 10, y0: 0, y1: 100 }

// zoomed-in tick values can be fractional — round them and drop trailing zeros
const fmtTick = v => String(+v.toFixed(2))

// round tick values inside the visible range (e.g. 4, 4.5, 5 …) — left to itself,
// Recharts splits a zoomed range evenly and lands on awkward values like 2.78
function niceTicks(lo, hi, target) {
  const raw = (hi - lo) / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)
  const ticks = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(6))
  return ticks
}

// renders the OLS trendline as a plain SVG <line> element using the chart's own axis scale functions
// keeping it outside Recharts' series system (via Customized) means it never appears in the tooltip
// payload, so it can't accidentally block or steal hover events from the scatter dots
function TrendlineSVG({ xAxis, yAxis, trendline }) {
  if (!trendline || !xAxis?.scale || !yAxis?.scale) return null

  // draw across the visible x range and clip to the plot area, so the line stays
  // inside the chart at any zoom level
  const [xa, xb] = xAxis.scale.domain()
  const [left, right] = xAxis.scale.range()
  const [bottom, top] = yAxis.scale.range()
  const lineY = x => yAxis.scale(trendline.slope * x + trendline.intercept)

  return (
    <g pointerEvents="none"> {/* lets mouse events pass through to the scatter dots below */}
      <defs>
        <clipPath id="corr-trendline-clip">
          <rect x={Math.min(left, right)} y={Math.min(top, bottom)}
                width={Math.abs(right - left)} height={Math.abs(bottom - top)} />
        </clipPath>
      </defs>
      <line
        x1={xAxis.scale(xa)} y1={lineY(xa)}
        x2={xAxis.scale(xb)} y2={lineY(xb)}
        clipPath="url(#corr-trendline-clip)"
        stroke="#E11D48"
        strokeWidth={2.2}
        strokeDasharray="6 3"
      />
    </g>
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

// phone-width breakpoint — matches the 600px block in responsive.css
const NARROW_QUERY = '(max-width: 600px)'

// tracks whether the viewport is phone-width so the scatter can switch to
// settings that stay readable on a small screen (and update on rotate/resize)
function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const onChange = e => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

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
      body: `Countries far from the trendline score unusually high or low on one metric relative to the other — these are the most analytically interesting cases. <strong>Hover or tap any dot</strong> to identify the country.`
    },
    {
      tone: 'info',
      title: 'Sample Size',
      body: `This analysis covers <strong>${corr.sampleSize.toLocaleString()}</strong> country-year observations. Use the year filter to isolate a single year or view all years together.`
    }
  ]
}

export default function CorrelationPage({ meta }) {
  const isNarrow = useIsNarrow()
  // yearMode is either 'all' or a specific year string like '2019'
  // phones open on the latest single year — 1,800+ overlapping "All Years" dots
  // become an unreadable blob on a small screen
  const [yearMode, setYearMode] = useState(() =>
    window.matchMedia(NARROW_QUERY).matches && meta?.yearMax ? String(meta.yearMax) : 'all'
  )
  const [corr, setCorr]         = useState(null)
  const [loading, setLoading]   = useState(true)
  // the dot last tapped on a touch screen — Recharts only opens its scatter
  // tooltip on mouse hover, so phones show the tapped point in a readout instead
  const [tapped, setTapped]     = useState(null)
  // zoom/pan state — resets to the full view whenever the year changes
  const zoom = useChartZoom(FULL_VIEW, yearMode)

  // if the page opened before meta loaded, the phone default (latest year) couldn't be
  // applied yet — apply it once meta arrives, unless a year has already been picked
  const yearPicked = useRef(false)
  useEffect(() => {
    if (!yearPicked.current && meta?.yearMax && window.matchMedia(NARROW_QUERY).matches) {
      setYearMode(String(meta.yearMax))
    }
  }, [meta])

  // re-fetch whenever the year filter changes
  // `stale` drops responses for a year that's no longer selected — otherwise a slow
  // earlier request (e.g. All Years) can land last and overwrite the current one
  useEffect(() => {
    let stale = false
    setLoading(true)
    setTapped(null)
    api.getCorrelation(yearMode)
      .then(d => { if (!stale) { setCorr(d); setLoading(false) } })
      .catch(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [yearMode])

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

  // early return sits after every hook so the hook order is the same on each render
  if (!meta) return null

  // dot area in px² (Recharts sizes scatter symbols via ZAxis range, not an r prop)
  // smaller on phones and in All Years mode, where far more points share the plot
  const dotArea = isNarrow ? (isAllYears ? 10 : 36) : 64

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
                  onChange={e => { yearPicked.current = true; setYearMode(e.target.value) }}
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
              {isNarrow ? ' Tap' : ' Hover'} any dot to identify the country and see its scores.{' '}
              {/* warn the user that All Years stacks the same countries multiple times */}
              {isAllYears && (
                <span style={{ color: 'var(--color-neutral)', fontWeight: 600 }}>
                  Note: "All Years" plots each country once per year — select a specific
                  year for a single-snapshot view without repeated observations.
                </span>
              )}
            </div>
          </div>

          {/* zoom controls sit above the chart rather than over it, so they never hide dots */}
          <div className="chart-zoom-bar">
            <span className="chart-zoom-level">
              {zoom.isZoomed ? `${zoom.zoomLevel.toFixed(1)}× zoom` : ''}
            </span>
            <button className="map-zoom-btn" onClick={zoom.zoomOut} disabled={!zoom.isZoomed} aria-label="Zoom out">
              <ZoomOutIcon />
            </button>
            <button className="map-zoom-btn" onClick={zoom.zoomIn} disabled={!zoom.canZoomIn} aria-label="Zoom in">
              <ZoomInIcon />
            </button>
            <button className="map-zoom-btn" onClick={zoom.reset} disabled={!zoom.isZoomed} aria-label="Reset zoom">
              <ZoomResetIcon />
            </button>
          </div>

          {/* the chart keeps a fixed size — zooming narrows the axis ranges instead.
              touch-action: at the full view one-finger swipes still scroll the page
              (pinches come to us); once zoomed, swipes pan the chart instead */}
          <div
            ref={zoom.containerRef}
            className="chart-container chart-container-tall"
            style={{
              touchAction: zoom.isZoomed ? 'none' : 'pan-y',
              cursor: zoom.isZoomed ? 'grab' : undefined
            }}
          >
            {loading || !corr ? (
              <div className="loading-state">Loading correlation data…</div>
            ) : (
              // ScatterChart (not ComposedChart) — purpose-built for scatter plots
              // its hover/tooltip hit detection works correctly with Scatter series
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={isNarrow
                    ? { top: 20, right: 8, bottom: 32, left: 0 }
                    : { top: 22, right: 16, bottom: 40, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />

                  {/* domains follow the zoom view; allowDataOverflow keeps them exact and
                      clips dots outside the visible range to the plot area */}
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[zoom.view.x0, zoom.view.x1]}
                    allowDataOverflow
                    tickFormatter={fmtTick}
                    stroke="var(--color-text-tertiary)"
                    fontSize={isNarrow ? 10.5 : 11.5}
                    tickLine={false}
                    ticks={niceTicks(zoom.view.x0, zoom.view.x1, isNarrow ? 5 : 6)}
                    label={{
                      value: 'Democracy Score (0–10)',
                      position: 'insideBottom',
                      offset: isNarrow ? -10 : -16,
                      fontSize: isNarrow ? 10.5 : 11.5,
                      fill: 'var(--color-text-tertiary)'
                    }}
                  />

                  {/* horizontal title above the plot — a rotated label beside the axis gets
                      clipped once the chart is short (phones, or with the zoom bar above it) */}
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[zoom.view.y0, zoom.view.y1]}
                    allowDataOverflow
                    tickFormatter={fmtTick}
                    stroke="var(--color-text-tertiary)"
                    fontSize={isNarrow ? 10.5 : 11.5}
                    tickLine={false}
                    ticks={niceTicks(zoom.view.y0, zoom.view.y1, 5)}
                    width={isNarrow ? 34 : 60}
                    label={{
                      value: 'Press Freedom (0–100)',
                      position: 'top',
                      offset: 8,
                      dx: isNarrow ? 44 : 58, // nudges the title right so it starts near the axis line
                      fontSize: isNarrow ? 10.5 : 11.5,
                      fill: 'var(--color-text-tertiary)'
                    }}
                  />

                  {/* ZAxis only controls dot size here — a fixed range gives every dot the same area */}
                  <ZAxis range={[dotArea, dotArea]} />

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
                    // more transparent in All Years mode so dense clusters read as darker areas
                    fillOpacity={isAllYears ? 0.4 : 0.7}
                    isAnimationActive={false}
                    // ignore the click that ends a pan — only a genuine tap selects a dot
                    onClick={pt => { if (!zoom.consumeDrag()) setTapped(pt.payload ?? pt) }}
                  />

                  {/* Customized lets us inject arbitrary SVG into the chart without
                      creating a Recharts series — the trendline lives here so it's
                      invisible to the tooltip and event system. It also hands the live
                      axis scales to the zoom hook so gestures can map pixels to data */}
                  <Customized
                    component={(props) => {
                      // xAxisMap and yAxisMap are keyed by axis ID — grab the first (and only) entry
                      const xAxis = props.xAxisMap && Object.values(props.xAxisMap)[0]
                      const yAxis = props.yAxisMap && Object.values(props.yAxisMap)[0]
                      if (xAxis?.scale && yAxis?.scale) {
                        zoom.scalesRef.current = { x: xAxis.scale, y: yAxis.scale }
                      }
                      return <TrendlineSVG xAxis={xAxis} yAxis={yAxis} trendline={corr.trendline} />
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* tap readout sits below the chart rather than over it, so it never hides dots */}
          {isNarrow && tapped && (
            <div className="chart-tap-readout">
              <strong>{tapped.country}</strong>
              <span>
                Democracy <b>{tapped.democracyScore}</b> · Press Freedom <b>{tapped.pressFreedomScore}</b>
                {isAllYears && <> · <b>{tapped.year}</b></>}
              </span>
            </div>
          )}

          <p className="chart-hint" style={{ marginTop: 'var(--space-2)' }}>
            {isNarrow
              ? 'Tap a dot for details · Pinch or use the buttons to zoom, drag to pan'
              : 'Hover a dot for details · Scroll or use the buttons to zoom, drag to pan'}
            {' · '}Dashed red line = OLS trendline
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