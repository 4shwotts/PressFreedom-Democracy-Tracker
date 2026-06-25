import { useEffect, useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { scaleLinear } from 'd3-scale'
import { api } from '../api'
import InsightPanel from '../components/InsightPanel'
import StatCard from '../components/StatCard'

// topojson file from the world-atlas CDN — gives us country shapes at 110m resolution
// (lower resolution = smaller file, faster load, fine for a world map at this scale)
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// the two metrics the map can display — value matches the API field name exactly
const METRICS = [
  { value: 'DemocracyScore',   label: 'Democracy Score' },
  { value: 'PressFreedomScore', label: 'Press Freedom Score' }
]

// builds the insight rail entries from whatever the map API returns
// kept as a plain function (not a hook) because it's just data transformation
function buildInsights(mapData, metric) {
  if (!mapData) return []
  const insights = []
  const metricLabel = metric === 'DemocracyScore' ? 'democracy' : 'press freedom'

  // always show the global average as the first card
  insights.push({
    tone: 'info',
    title: 'Global Average',
    body: `The global average ${metricLabel} score in <strong>${mapData.year}</strong> is <strong>${mapData.globalAverage}</strong> across ${mapData.countryCount} countries.`
  })

  // mostImproved and mostDeclined are nullable — the API returns null for the first year
  // in the dataset because there's no prior year to compare against
  if (mapData.mostImproved) {
    insights.push({
      tone: 'improve',
      title: 'Most Improved',
      body: `<strong>${mapData.mostImproved.country}</strong> gained the most year-over-year, up <strong>+${mapData.mostImproved.delta}</strong> vs ${mapData.year - 1}.`
    })
  }

  if (mapData.mostDeclined) {
    insights.push({
      tone: 'decline',
      title: 'Sharpest Decline',
      body: `<strong>${mapData.mostDeclined.country}</strong> fell the most year-over-year, down <strong>${mapData.mostDeclined.delta}</strong> vs ${mapData.year - 1}.`
    })
  }

  // static guidance cards — tone neutral because they're informational, not judgements
  insights.push({
    tone: 'neutral',
    title: 'Global Trend',
    body: `Tracking <strong>${mapData.year}</strong> across ${mapData.countryCount} countries — use the year slider to trace how global ${metricLabel} patterns have shifted over the full period of data.`
  })

  insights.push({
    tone: 'neutral',
    title: 'Reading the Map',
    body: `Colours run from <strong>dark red</strong> (lowest scores) through orange, amber, and light blue to <strong>dark navy</strong> (highest scores). This applies to both democracy (0–10) and press freedom (0–100). Grey countries have no data available.`
  })

  return insights
}

// zoom bounds for the map — ZOOM_STEP controls how much each button click moves
const ZOOM_MIN  = 1
const ZOOM_MAX  = 6
const ZOOM_STEP = 0.6

// inline SVG icons for the zoom controls — kept here since they're only used on this page
function ZoomInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ZoomOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.3-4.3M8 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function GlobalMapPage({ meta }) {
  // year and metric drive the API call — changing either triggers a re-fetch
  const [year, setYear]       = useState(meta?.yearMax || 2023)
  const [metric, setMetric]   = useState('DemocracyScore')
  const [mapData, setMapData] = useState(null)
  // hovered holds the country row the mouse is currently over, or null
  const [hovered, setHovered] = useState(null)
  const [loading, setLoading] = useState(true)
  // zoom and center are passed directly into ZoomableGroup to control the viewport
  const [zoom, setZoom]       = useState(1)
  const [center, setCenter]   = useState([0, 20]) // [longitude, latitude] — centred roughly on Africa/Europe

  // once meta loads from the parent, sync the year badge to the latest available year
  useEffect(() => {
    if (meta?.yearMax) setYear(meta.yearMax)
  }, [meta])

  // re-fetch map data whenever year or metric changes
  // only show the loading overlay if there's no existing data yet (avoids flash on slider drag)
  useEffect(() => {
    if (!mapData) setLoading(true)
    api.getMapData(year, metric).then(data => {
      setMapData(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [year, metric])

  if (!meta) return null

  // build a country-name → row lookup so each Geography can find its value in O(1)
  // avoids an array .find() call inside the render loop for every country shape
  const valueByCountry = {}
  if (mapData) {
    mapData.rows.forEach(r => { valueByCountry[r.country] = r })
  }

  // the colour scale maps a score to a colour across 4 stops
  // democracy goes 0–10, press freedom 0–100 — we normalise by maxVal so the same
  // stop positions (40%, 70%, 100%) work for both metrics
  const maxVal = metric === 'DemocracyScore' ? 10 : 100
  const colorScale = scaleLinear()
    .domain([0, maxVal * 0.4, maxVal * 0.7, maxVal])
    .range(['#E11D48', '#D97706', '#5B9FE8', '#1E3A5F'])

  const metricLabel = METRICS.find(m => m.value === metric)?.label

  // clamp zoom within bounds and round to 2dp to avoid floating point drift
  function zoomIn() {
    setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))
  }
  function zoomOut() {
    setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))
  }

  return (
    <div className="page-body page-body-map">
      <InsightPanel insights={buildInsights(mapData, metric)} />

      <div>
        <div className="main-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Global Map</h2>
              <p className="panel-subtitle">Metric: {metricLabel} · Year: {year}</p>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <label className="control-label">Select Metric</label>
                <select
                  className="select-control"
                  value={metric}
                  onChange={e => setMetric(e.target.value)}
                >
                  {METRICS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="panel-info-box">
              <strong>Score details:</strong><br />
              Democracy Score (0–10): higher = more democratic.<br />
              Press Freedom Score (0–100): higher = more press freedom.
            </div>
          </div>

          {/* year slider — min/max come from meta so it always matches the dataset */}
          <div className="slider-row">
            <div className="slider-track-wrap">
              <input
                type="range"
                className="year-slider"
                min={meta.yearMin}
                max={meta.yearMax}
                value={year}
                onChange={e => setYear(Number(e.target.value))}
              />
              <div className="year-labels">
                <span>{meta.yearMin}</span>
                <span>{meta.yearMax}</span>
              </div>
            </div>
            <span className="year-current-badge">{year}</span>
          </div>

          {/* map-stage fills remaining panel height via flex in CSS */}
          <div className="map-stage">

            {/* only show the loading overlay on the very first load, not on year/metric changes */}
            {loading && !mapData && (
              <div className="loading-state" style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
                Loading map data…
              </div>
            )}

            {/* zoom buttons sit top-left over the map */}
            <div className="map-zoom-controls">
              <button className="map-zoom-btn" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
                <ZoomInIcon />
              </button>
              <button className="map-zoom-btn" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
                <ZoomOutIcon />
              </button>
            </div>

            <ComposableMap projection="geoNaturalEarth1" style={{ width: '100%', height: '100%' }}>
              {/* ZoomableGroup handles pinch/scroll/drag — we sync its state back to React
                  so the manual zoom buttons stay in sync with gesture-based zoom */}
              <ZoomableGroup
                zoom={zoom}
                center={center}
                onMoveEnd={({ coordinates, zoom: z }) => {
                  setCenter(coordinates)
                  setZoom(z)
                }}
                minZoom={ZOOM_MIN}
                maxZoom={ZOOM_MAX}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map(geo => {
                      const name  = geo.properties.name
                      // look up this country in the valueByCountry map — undefined if no data
                      const match = valueByCountry[name]
                      // grey out countries with no data so they're clearly excluded
                      const fill  = match ? colorScale(match.value) : 'var(--color-border)'
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke="var(--color-surface)"
                          strokeWidth={0.4}
                          // only set hovered if we actually have data for this country
                          onMouseEnter={() => setHovered(match ? { ...match, name } : null)}
                          onMouseLeave={() => setHovered(null)}
                          style={{
                            default: { outline: 'none', transition: 'opacity 120ms' },
                            hover:   { outline: 'none', opacity: 0.8, cursor: 'pointer' },
                            pressed: { outline: 'none' }
                          }}
                        />
                      )
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>

            {/* tooltip appears top-right of the map stage, positioned via CSS */}
            {hovered && (
              <div className="map-tooltip">
                <strong style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>
                  {hovered.name}
                </strong>
                <div style={{
                  marginTop: 4,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12.5
                }}>
                  Democracy: {hovered.democracyScore} / 10<br />
                  Press Freedom: {hovered.pressFreedomScore} / 100
                </div>
              </div>
            )}
          </div>

          <p className="chart-hint">
            Hover over a country to see details · Scroll or use the controls to zoom, drag to pan
          </p>
        </div>

        <div style={{ height: 'var(--space-3)' }} />

        {/* stat cards use meta (global stats) not mapData, so they don't change with year/metric */}
        <div className="stat-row">
          <StatCard icon="globe"    tone="accent"  value={meta.countriesAnalysed}             label="Countries Analysed" />
          <StatCard icon="file"     tone="accent"  value={`${meta.avgDemocracyScore}/10`}     label="Avg Democracy Score" />
          <StatCard icon="up"       tone="improve" value={meta.topCountry}                    label={`Highest, ${meta.topScore}/10`} />
          <StatCard icon="down"     tone="decline" value={meta.bottomCountry}                 label={`Lowest, ${meta.bottomScore}/10`} />
          <StatCard icon="calendar" tone="accent"  value={`${meta.yearMin}–${meta.yearMax}`}  label={`${meta.yearsAvailable} years of data`} />
        </div>
      </div>
    </div>
  )
}