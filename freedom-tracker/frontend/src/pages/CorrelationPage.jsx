import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Customized
} from 'recharts'
import { api } from '../api'
import InsightPanel from '../components/InsightPanel'
import StatCard from '../components/StatCard'
import StatusMessage from '../components/StatusMessage'
import ChartDataTable from '../components/ChartDataTable'
import MethodologyNote from '../components/MethodologyNote'
import { ZoomInIcon, ZoomOutIcon, ZoomResetIcon } from '../components/ZoomIcons'
import { useChartZoom } from '../useChartZoom'
import { useApi } from '../lib/useApi'
import { isNarrowNow, useIsNarrow } from '../lib/useIsNarrow'
import { fmtTick, jitteredPoints, niceTicks } from '../lib/chartData'
import { correlationInsights } from '../lib/insights'

// full axis extent — democracy runs 0–10, press freedom 0–100. This is the default
// view and the zoomed-out limit (module constant so the zoom hook gets a stable object)
const FULL_VIEW = { x0: 0, x1: 10, y0: 0, y1: 100 }

// renders the least-squares trend line as a plain SVG <line> using the chart's own
// axis scales. Keeping it outside Recharts' series system (via Customized) means it
// never appears in the tooltip or steals hover events from the dots
function TrendlineSVG({ xAxis, yAxis, trendline }) {
  if (!trendline || !xAxis?.scale || !yAxis?.scale) return null

  // drawn across the visible x range and clipped to the plot area, so the line
  // stays inside the chart at any zoom level
  const [xa, xb] = xAxis.scale.domain()
  const [left, right] = xAxis.scale.range()
  const [bottom, top] = yAxis.scale.range()
  const lineY = x => yAxis.scale(trendline.slope * x + trendline.intercept)

  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id="corr-trendline-clip">
          <rect x={Math.min(left, right)} y={Math.min(top, bottom)}
                width={Math.abs(right - left)} height={Math.abs(bottom - top)} />
        </clipPath>
      </defs>
      <line x1={xAxis.scale(xa)} y1={lineY(xa)} x2={xAxis.scale(xb)} y2={lineY(xb)}
            clipPath="url(#corr-trendline-clip)" stroke="#E11D48" strokeWidth={2.2} strokeDasharray="6 3" />
    </g>
  )
}

// hands the chart's live axis scales to the zoom hook after each render, so
// gestures can map pixels to data values (renders nothing itself)
function ScaleReporter({ xAxis, yAxis, onScales }) {
  useLayoutEffect(() => {
    if (xAxis?.scale && yAxis?.scale) onScales({ x: xAxis.scale, y: yAxis.scale })
  })
  return null
}

function PointTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d.country) return null
  return (
    <div className="chart-tooltip">
      <strong>{d.country}</strong>
      <span>Democracy: <b>{d.democracyScore}</b></span>
      <span>Press freedom: <b>{d.pressFreedomScore}</b></span>
      <span>Year: <b>{d.year}</b></span>
    </div>
  )
}

export default function CorrelationPage({ meta }) {
  const yearId = useId()
  const isNarrow = useIsNarrow()
  // 'all' or a year like '2019'. Phones open on the latest single year — 1,800+
  // overlapping "all years" dots are unreadable on a small screen
  const [yearMode, setYearMode] = useState(() => (isNarrowNow() ? String(meta.yearMax) : 'all'))
  // the dot last tapped — Recharts only opens its tooltip on mouse hover, so a tap
  // shows the point in a readout below the chart instead
  const [tapped, setTapped] = useState(null)
  // zoom/pan state — resets to the full view whenever the year changes
  const zoom = useChartZoom(FULL_VIEW, yearMode)

  const { data: corr, error, loading, retry } = useApi(() => api.getCorrelation(yearMode), [yearMode])

  // a dot tapped in one year means nothing in another, so changing year clears it
  function changeYear(value) {
    setTapped(null)
    setYearMode(value)
  }

  // Recharts gives every dot role="img" with no way to label it, so a screen reader
  // would announce up to 1,800 unnamed images. The chart as a whole has a label and
  // a data table, so the individual dots are hidden from assistive technology
  const chartRef = useRef(null)
  // one stable ref callback feeding both the zoom hook and chartRef — a new
  // function each render would make React detach and re-attach the element
  const { containerRef } = zoom
  const setChartEl = useCallback(el => { containerRef(el); chartRef.current = el }, [containerRef])
  // Recharts draws the dots after its container has measured itself, so a
  // MutationObserver catches them whenever they're (re)drawn
  useLayoutEffect(() => {
    const el = chartRef.current
    if (!el) return undefined
    const hide = () => el.querySelectorAll('.recharts-scatter:not([aria-hidden])')
      .forEach(g => g.setAttribute('aria-hidden', 'true'))
    hide()
    const observer = new MutationObserver(hide)
    observer.observe(el, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [corr])

  const isAllYears = yearMode === 'all'
  // a small stable offset so identical scores don't hide each other; the true
  // scores stay on each point for the tooltip and the data table
  const points = useMemo(() => jitteredPoints(corr?.points), [corr])

  // dot area in px² (Recharts sizes scatter symbols via ZAxis range) — smaller on
  // phones and in all-years mode, where far more points share the plot
  const dotArea = isNarrow ? (isAllYears ? 10 : 36) : 64

  const yearOptions = ['all']
  for (let y = meta.yearMin; y <= meta.yearMax; y++) yearOptions.push(String(y))
  const windowLabel = isAllYears ? `All years (${meta.yearMin}–${meta.yearMax})` : yearMode

  return (
    <div className="page-body">
      <InsightPanel insights={correlationInsights(corr, isAllYears)} />

      <div>
        <section className="main-panel" aria-labelledby="corr-title">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" id="corr-title">Correlation</h2>
              <p className="panel-subtitle">
                How democracy scores relate to press freedom scores. Each dot is one country in one year.
              </p>
              <div className="control-group">
                <label className="control-label" htmlFor={yearId}>Year</label>
                <select id={yearId} className="select-control" value={yearMode} onChange={e => changeYear(e.target.value)}>
                  {yearOptions.map(y => <option key={y} value={y}>{y === 'all' ? 'All years' : y}</option>)}
                </select>
              </div>
            </div>
            <div className="panel-info-box">
              <strong>About this chart:</strong> each dot is a country; the dashed line is a least-squares
              trend line. {isNarrow ? 'Tap' : 'Hover over'} a dot to see the country and its scores.{' '}
              {isAllYears && (
                <span className="info-emphasis">
                  “All years” plots each country once per year — choose a single year for one point per country.
                </span>
              )}
            </div>
          </div>

          {isAllYears && <MethodologyNote />}

          {/* zoom controls sit above the chart rather than over it, so they never hide dots */}
          <div className="chart-zoom-bar">
            <span className="chart-zoom-level" aria-live="polite">
              {zoom.isZoomed ? `${zoom.zoomLevel.toFixed(1)}× zoom` : ''}
            </span>
            <button type="button" className="map-zoom-btn" onClick={zoom.zoomOut} disabled={!zoom.isZoomed} aria-label="Zoom out">
              <ZoomOutIcon />
            </button>
            <button type="button" className="map-zoom-btn" onClick={zoom.zoomIn} disabled={!zoom.canZoomIn} aria-label="Zoom in">
              <ZoomInIcon />
            </button>
            <button type="button" className="map-zoom-btn" onClick={zoom.reset} disabled={!zoom.isZoomed} aria-label="Reset zoom">
              <ZoomResetIcon />
            </button>
          </div>

          {/* the chart keeps a fixed size — zooming narrows the axis ranges instead.
              touch-action: at the full view one-finger swipes still scroll the page
              (pinches come to the chart); once zoomed, swipes pan the chart */}
          <div
            ref={setChartEl}
            className="chart-container chart-container-tall"
            style={{ touchAction: zoom.isZoomed ? 'none' : 'pan-y', cursor: zoom.isZoomed ? 'grab' : undefined }}
          >
            {!corr ? (
              <StatusMessage loading={loading} error={error} onRetry={retry} loadingText="Loading correlation data…" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  role="img"
                  aria-label={`Scatter plot of press freedom score against democracy score, ${windowLabel}. The same figures are in the table below the chart.`}
                  margin={isNarrow ? { top: 20, right: 8, bottom: 32, left: 0 } : { top: 22, right: 16, bottom: 40, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  {/* domains follow the zoom view; allowDataOverflow keeps them exact and
                      clips dots outside the visible range to the plot area */}
                  <XAxis type="number" dataKey="x" domain={[zoom.view.x0, zoom.view.x1]} allowDataOverflow
                         tickFormatter={fmtTick} stroke="var(--color-text-tertiary)" fontSize={isNarrow ? 10.5 : 11.5}
                         tickLine={false} ticks={niceTicks(zoom.view.x0, zoom.view.x1, isNarrow ? 5 : 6)}
                         label={{ value: 'Democracy score (0–10)', position: 'insideBottom', offset: isNarrow ? -10 : -16,
                                  fontSize: isNarrow ? 10.5 : 11.5, fill: 'var(--color-text-secondary)' }} />
                  {/* horizontal title above the plot — a rotated label beside the axis gets
                      clipped once the chart is short */}
                  <YAxis type="number" dataKey="y" domain={[zoom.view.y0, zoom.view.y1]} allowDataOverflow
                         tickFormatter={fmtTick} stroke="var(--color-text-tertiary)" fontSize={isNarrow ? 10.5 : 11.5}
                         tickLine={false} ticks={niceTicks(zoom.view.y0, zoom.view.y1, 5)} width={isNarrow ? 34 : 60}
                         label={{ value: 'Press freedom score (0–100)', position: 'top', offset: 8, dx: isNarrow ? 52 : 68,
                                  fontSize: isNarrow ? 10.5 : 11.5, fill: 'var(--color-text-secondary)' }} />
                  {/* ZAxis only sets dot size here — a fixed range gives every dot the same area */}
                  <ZAxis range={[dotArea, dotArea]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<PointTooltip />} />
                  {/* one Scatter series — splitting into several breaks the tooltip's hit detection */}
                  <Scatter
                    name="Countries"
                    data={points}
                    fill="#2D7DD2"
                    fillOpacity={isAllYears ? 0.4 : 0.7}
                    isAnimationActive={false}
                    // ignore the click that ends a pan — only a genuine tap selects a dot
                    onClick={pt => { if (!zoom.consumeDrag()) setTapped(pt.payload ?? pt) }}
                  />
                  {/* also hands the live axis scales to the zoom hook so gestures can map pixels to data */}
                  <Customized component={props => {
                    const xAxis = props.xAxisMap && Object.values(props.xAxisMap)[0]
                    const yAxis = props.yAxisMap && Object.values(props.yAxisMap)[0]
                    return (
                      <>
                        <ScaleReporter xAxis={xAxis} yAxis={yAxis} onScales={zoom.reportScales} />
                        <TrendlineSVG xAxis={xAxis} yAxis={yAxis} trendline={corr.trendline} />
                      </>
                    )
                  }} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>

          {tapped && (
            <div className="chart-tap-readout" role="status">
              <strong>{tapped.country}</strong>
              <span>
                Democracy <b>{tapped.democracyScore}</b> · Press freedom <b>{tapped.pressFreedomScore}</b> · <b>{tapped.year}</b>
              </span>
            </div>
          )}

          <p className="chart-hint">
            {isNarrow ? 'Tap a dot for details · Pinch or use the buttons to zoom, drag to pan'
                      : 'Hover over a dot for details · Scroll or use the buttons to zoom, drag to pan'}
            {' · '}Dashed red line: least-squares trend line
          </p>

          {corr && (
            <>
              <p className="chart-summary">
                {windowLabel}: {corr.sampleSize.toLocaleString('en-GB')} observations, Pearson’s r = {corr.pearsonR ?? 'not available'}
                {corr.trendline && `, trend line: press freedom ≈ ${corr.trendline.slope} × democracy + ${corr.trendline.intercept}`}.
              </p>
              <ChartDataTable
                caption={`Democracy and press freedom scores, ${windowLabel}`}
                columns={[
                  { key: 'country', label: 'Country' },
                  { key: 'year', label: 'Year', numeric: true },
                  { key: 'democracyScore', label: 'Democracy (0–10)', numeric: true },
                  { key: 'pressFreedomScore', label: 'Press freedom (0–100)', numeric: true }
                ]}
                rows={corr.points.map(p => ({ ...p, key: `${p.country}-${p.year}` }))}
              />
            </>
          )}
        </section>

        {corr && (
          <div className="stat-row">
            <StatCard icon="up" tone="accent" value={corr.pearsonR ?? '—'} label="Pearson’s r" />
            <StatCard icon="globe" tone="accent" value={corr.sampleSize.toLocaleString('en-GB')} label="Observations" />
            <StatCard icon="file" tone="accent" value={corr.rSquared ?? '—'} label="R²" />
            <StatCard icon={corr.pearsonR > 0 ? 'up' : 'down'} tone="neutral"
                      value={corr.pearsonR === null ? '—' : corr.pearsonR > 0 ? 'Positive' : 'Negative'}
                      label="Direction of the relationship" />
            <StatCard icon="calendar" tone="neutral" value={isAllYears ? 'All years' : yearMode} label="Years included" />
          </div>
        )}
      </div>
    </div>
  )
}
