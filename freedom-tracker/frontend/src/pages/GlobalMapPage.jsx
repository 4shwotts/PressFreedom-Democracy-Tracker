import { useId, useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
// country shapes (Natural Earth via world-atlas, 110m resolution), served from
// this site rather than a third-party CDN
import worldUrl from 'world-atlas/countries-110m.json?url'
import { api } from '../api'
import { ISO_NUMERIC_TO_ALPHA3 } from '../isoCodes'
import InsightPanel from '../components/InsightPanel'
import StatCard from '../components/StatCard'
import StatusMessage from '../components/StatusMessage'
import ChartDataTable from '../components/ChartDataTable'
import MethodologyNote from '../components/MethodologyNote'
import { ZoomInIcon, ZoomOutIcon } from '../components/ZoomIcons'
import { useApi } from '../lib/useApi'
import { METRICS, byIso, fmtChange, mapColourScale, mapLegend, metricInfo } from '../lib/chartData'
import { mapInsights } from '../lib/insights'

// zoom bounds for the map — ZOOM_STEP controls how much each button press moves
const ZOOM_MIN  = 1
const ZOOM_MAX  = 6
const ZOOM_STEP = 0.6

export default function GlobalMapPage({ meta }) {
  const ids = { metric: useId(), year: useId() }
  const [year, setYear]       = useState(meta.yearMax)
  const [metric, setMetric]   = useState('DemocracyScore')
  // the country under the pointer (or last tapped), with the year and metric it
  // was read for — a tooltip from another year or metric would show stale numbers
  const [hoverState, setHoverState] = useState(null)
  const [zoom, setZoom]       = useState(1)
  const [center, setCenter]   = useState([0, 20]) // [longitude, latitude]

  // useApi ignores responses for a year/metric that's no longer selected (BUG-7)
  const { data: mapData, error, loading, retry } = useApi(() => api.getMapData(year, metric), [year, metric])

  const view = `${year}-${metric}`
  const hovered = hoverState?.view === view ? hoverState.country : null
  const setHovered = country => setHoverState(country && { view, country })

  const valueByIso = byIso(mapData?.rows)
  const noDataByIso = byIso(mapData?.noDataThisYear)
  const colourScale = mapColourScale(metric)
  const info = metricInfo(metric)

  const zoomIn = () => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))
  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))

  return (
    <div className="page-body page-body-map">
      <InsightPanel insights={mapInsights(mapData, meta.yearMin, meta.yearMax)} />

      <div>
        <section className="main-panel" aria-labelledby="map-title">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" id="map-title">Global map</h2>
              <p className="panel-subtitle">{info.label} · {year}</p>
              <div className="control-group">
                <label className="control-label" htmlFor={ids.metric}>Metric</label>
                <select id={ids.metric} className="select-control" value={metric} onChange={e => setMetric(e.target.value)}>
                  {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="panel-info-box">
              <strong>Score details:</strong><br />
              Democracy score (0–10): higher means a higher score on the EIU Democracy Index.<br />
              Press freedom score (0–100): higher means a higher score on the RSF World Press Freedom Index.
            </div>
          </div>

          {/* year slider — the range comes from the data, so it follows any new years */}
          <div className="slider-row">
            <div className="slider-track-wrap">
              <label className="sr-only" htmlFor={ids.year}>Year</label>
              <input
                id={ids.year}
                type="range"
                className="year-slider"
                min={meta.yearMin}
                max={meta.yearMax}
                step={1}
                value={year}
                aria-valuetext={String(year)}
                onChange={e => setYear(Number(e.target.value))}
              />
              <div className="year-labels" aria-hidden="true">
                <span>{meta.yearMin}</span>
                <span>{meta.yearMax}</span>
              </div>
            </div>
            <span className="year-current-badge" aria-hidden="true">{year}</span>
          </div>

          {metric === 'PressFreedomScore' && <MethodologyNote />}

          <div className="map-stage">
            {!mapData && (
              <div className="map-status">
                <StatusMessage loading={loading} error={error} onRetry={retry} loadingText="Loading map data…" />
              </div>
            )}

            <div className="map-zoom-controls">
              <button type="button" className="map-zoom-btn" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
                <ZoomInIcon />
              </button>
              <button type="button" className="map-zoom-btn" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
                <ZoomOutIcon />
              </button>
            </div>

            <ComposableMap
              projection="geoNaturalEarth1"
              style={{ width: '100%', height: '100%' }}
              role="img"
              aria-label={`World map of ${info.short} scores in ${year}. The same figures are in the table below the map.`}
            >
              {/* ZoomableGroup handles pinch/scroll/drag — its state is synced back so
                  the zoom buttons stay in step with gestures */}
              <ZoomableGroup
                zoom={zoom}
                center={center}
                onMoveEnd={({ coordinates, zoom: z }) => { setCenter(coordinates); setZoom(z) }}
                minZoom={ZOOM_MIN}
                maxZoom={ZOOM_MAX}
              >
                <Geographies geography={worldUrl}>
                  {({ geographies }) => geographies.map(geo => {
                    // geo.id is the ISO numeric code — translated to alpha-3 to match the API
                    const iso   = ISO_NUMERIC_TO_ALPHA3[geo.id]
                    const match = valueByIso[iso]
                    const gap   = noDataByIso[iso]
                    // the dataset's name, so the tooltip matches the other tabs
                    const name  = match ? match.country : gap ? gap.country : geo.properties.name
                    const show  = () => setHovered({ ...match, name, hasData: !!match, gap })
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={match ? colourScale(match.value) : 'var(--color-no-data)'}
                        stroke="var(--color-surface)"
                        strokeWidth={0.4}
                        onMouseEnter={show}
                        onClick={show}   // touch screens have no hover — a tap shows the same tooltip
                        onMouseLeave={() => setHovered(null)}
                        style={{
                          default: { outline: 'none', transition: 'opacity 120ms' },
                          hover:   { outline: 'none', opacity: 0.8, cursor: 'pointer' },
                          pressed: { outline: 'none' }
                        }}
                      />
                    )
                  })}
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>

            {hovered && (
              <div className="map-tooltip" role="status">
                <strong className="map-tooltip-name">{hovered.name}</strong>
                <div className="map-tooltip-body">
                  {hovered.hasData ? (
                    <>
                      Democracy: {hovered.democracyScore} / 10<br />
                      Press freedom: {hovered.pressFreedomScore} / 100
                    </>
                  ) : hovered.gap ? (
                    <>
                      No {year} data in the source dataset<br />
                      Available: {hovered.gap.yearFrom}–{hovered.gap.yearTo}
                    </>
                  ) : 'Not covered by the dataset'}
                </div>
              </div>
            )}
          </div>

          {/* the legend gives the values behind each colour */}
          <div className="map-legend" role="group" aria-label={`Colour key for ${info.short} scores`}>
            {/* each value label sits under the point on the bar where its colour is */}
            <span className="map-legend-scale">
              <span className="map-legend-bar" aria-hidden="true"
                    style={{ background: `linear-gradient(to right, ${mapLegend(metric).map(s => `${s.colour} ${s.fraction * 100}%`).join(', ')})` }} />
              <span className="map-legend-labels">
                {mapLegend(metric).map(s => (
                  <span key={s.value} style={{ left: `${s.fraction * 100}%` }}>{s.value}</span>
                ))}
              </span>
            </span>
            <span className="map-legend-nodata"><span className="map-legend-swatch" aria-hidden="true" /> No data</span>
          </div>

          {mapData?.noDataThisYear.length > 0 && (
            <p className="chart-hint">
              {mapData.noDataThisYear.length} countries have no data for {year} and are shown in grey — hover over or tap one to see which years are available.
            </p>
          )}
          <p className="chart-hint">Hover over or tap a country for details · Scroll, pinch or use the buttons to zoom, drag to pan</p>

          {mapData && (
            <ChartDataTable
              caption={`Scores by country, ${mapData.year}${mapData.yearOnYearComparable ? '' : ' (no change shown: RSF methodology changed in 2022)'}`}
              columns={[
                { key: 'country', label: 'Country' },
                { key: 'democracyScore', label: 'Democracy (0–10)', numeric: true },
                { key: 'pressFreedomScore', label: 'Press freedom (0–100)', numeric: true },
                { key: 'change', label: `${info.label} change vs ${mapData.year - 1}`, numeric: true }
              ]}
              rows={[
                ...mapData.rows.map(r => ({ ...r, key: r.iso, change: fmtChange(r.change) })),
                ...mapData.noDataThisYear.map(g => ({
                  key: g.iso, country: g.country, democracyScore: 'No data', pressFreedomScore: 'No data', change: '—'
                }))
              ]}
            />
          )}
        </section>

        <div className="stat-row">
          <StatCard icon="globe" tone="accent" value={meta.countriesAnalysed} label="Countries in this dashboard" />
          <StatCard icon="file" tone="accent" value={`${meta.avgDemocracyScore}/10`}
                    label={`Average democracy score, ${meta.avgDemocracyYear} (${meta.avgDemocracyCountryCount} countries)`} />
          <StatCard icon="up" tone="neutral" value={meta.topCountry}
                    label={`Highest democracy score, ${meta.yearMax}: ${meta.topScore}/10`} />
          <StatCard icon="down" tone="neutral" value={meta.bottomCountry}
                    label={`Lowest democracy score, ${meta.yearMax}: ${meta.bottomScore}/10`} />
          <StatCard icon="calendar" tone="accent" value={`${meta.yearMin}–${meta.yearMax}`} label={`${meta.yearsAvailable} years of data`} />
        </div>
      </div>
    </div>
  )
}
