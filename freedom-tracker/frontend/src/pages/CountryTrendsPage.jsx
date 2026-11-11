import { useId, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { api } from '../api'
import InsightPanel from '../components/InsightPanel'
import StatCard from '../components/StatCard'
import StatusMessage from '../components/StatusMessage'
import ChartDataTable from '../components/ChartDataTable'
import MethodologyNote from '../components/MethodologyNote'
import { useApi } from '../lib/useApi'
import { filterCountries, fmtChange, pressPeriodsText, rankText, trendChartData } from '../lib/chartData'
import { trendInsights } from '../lib/insights'

const DEM_COLOUR = '#E11D48'
const PRESS_COLOUR = '#2D7DD2'

// line styles: colour shows the metric, the dash pattern and marker shape show the
// country — so the chart can be read without relying on colour alone
const SOLID = undefined
const DASHED = '6 4'

export default function CountryTrendsPage() {
  const ids = { search: useId(), country: useId(), compare: useId() }
  const [query, setQuery]       = useState('')
  // the user's choice, if any — until then the first country alphabetically is
  // shown. Deriving it (rather than setting a default in an effect) means a quick
  // choice can never be overwritten by the default
  const [chosen, setSelected]   = useState('')
  const [compare, setCompare]   = useState('')

  const list = useApi(() => api.getCountryList(), [])
  const countries = useMemo(() => list.data ?? [], [list.data])
  const selected = chosen || countries[0] || ''

  // useApi ignores responses for a country that's no longer selected (BUG-7)
  const main = useApi(() => api.getCountryTrend(selected), [selected], { enabled: !!selected })
  const other = useApi(() => api.getCountryTrend(compare), [compare], { enabled: !!compare })
  const trend = main.data
  const compareTrend = compare ? other.data : null

  const matches = filterCountries(countries, query)
  // keep the current choice selectable even when the search hides it
  const options = matches.includes(selected) || !selected ? matches : [selected, ...matches]
  const noMatches = query.trim() !== '' && matches.length === 0

  const chartData = trendChartData(trend, compareTrend)
  const showCompare = !!compareTrend && compareTrend.country !== trend?.country
  const last = trend?.series[trend.series.length - 1]

  return (
    <div className="page-body">
      <InsightPanel insights={trendInsights(trend)} />

      <div>
        <section className="main-panel" aria-labelledby="trends-title">
          <div className="panel-header">
            <div className="control-stack">
              <h2 className="panel-title" id="trends-title">Country trends</h2>
              <p className="panel-subtitle">How a country’s scores have changed over the years with data.</p>

              <div className="control-row">
                <div className="control-group">
                  <label className="control-label" htmlFor={ids.search}>Search countries</label>
                  <input
                    id={ids.search}
                    type="search"
                    className="input-control"
                    value={query}
                    placeholder="e.g. Norway"
                    autoComplete="off"
                    onChange={e => setQuery(e.target.value)}
                  />
                </div>
                <div className="control-group">
                  <label className="control-label" htmlFor={ids.country}>Country</label>
                  <select
                    id={ids.country}
                    className="select-control"
                    value={selected}
                    disabled={!countries.length}
                    onChange={e => setSelected(e.target.value)}
                  >
                    {options.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="control-group">
                  <label className="control-label" htmlFor={ids.compare}>Compare with (optional)</label>
                  <select id={ids.compare} className="select-control" value={compare} onChange={e => setCompare(e.target.value)}>
                    <option value="">No comparison</option>
                    {countries.filter(c => c !== selected).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {noMatches && (
                <p className="status-message status-empty" role="status">
                  No countries match “{query.trim()}”. Try another spelling, or clear the search.
                </p>
              )}
            </div>
            <div className="panel-info-box">
              <strong>About this chart:</strong> democracy (left axis, 0–10) and press freedom (right axis,
              0–100) over time. Solid lines are the selected country; dashed lines are the comparison.
            </div>
          </div>

          <StatusMessage loading={list.loading} error={list.error} onRetry={list.retry} loadingText="Loading countries…" />
          <StatusMessage loading={!trend && main.loading} error={main.error} onRetry={main.retry} loadingText="Loading country data…" />
          <StatusMessage error={compare ? other.error : null} onRetry={other.retry} />

          {trend && (
            <>
              <MethodologyNote />
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="year" stroke="var(--color-text-tertiary)" fontSize={11.5} tickLine={false} />
                    <YAxis yAxisId="left" stroke="var(--color-text-tertiary)" fontSize={11.5} tickLine={false} domain={[0, 10]} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--color-text-tertiary)" fontSize={11.5}
                           tickLine={false} domain={[0, 100]} />
                    {/* marks where RSF's methodology changed */}
                    <ReferenceLine yAxisId="right" x={2022} stroke="var(--color-text-tertiary)" strokeDasharray="2 3"
                                   // label sits to the left of the line so it never overlaps the right axis
                                   label={{ value: 'RSF method change', position: 'insideTopRight', fontSize: 10.5,
                                            fill: 'var(--color-text-secondary)' }} />
                    <Tooltip contentStyle={{
                      background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
                      borderRadius: 8, fontSize: 12.5, fontFamily: 'var(--font-body)'
                    }} />
                    <Line yAxisId="left" type="monotone" dataKey="democracyScore" name={`${trend.country} — democracy`}
                          stroke={DEM_COLOUR} strokeWidth={2.4} strokeDasharray={SOLID} dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="right" type="monotone" dataKey="pressFreedomScore" name={`${trend.country} — press freedom`}
                          stroke={PRESS_COLOUR} strokeWidth={2.4} strokeDasharray={SOLID} dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
                    {showCompare && (
                      <Line yAxisId="left" type="monotone" dataKey="compareDemocracy" name={`${compareTrend.country} — democracy`}
                            stroke={DEM_COLOUR} strokeWidth={2} strokeDasharray={DASHED} dot={{ r: 3, strokeWidth: 1.5, fill: 'var(--color-surface)' }}
                            connectNulls />
                    )}
                    {showCompare && (
                      <Line yAxisId="right" type="monotone" dataKey="comparePress" name={`${compareTrend.country} — press freedom`}
                            stroke={PRESS_COLOUR} strokeWidth={2} strokeDasharray={DASHED} dot={{ r: 3, strokeWidth: 1.5, fill: 'var(--color-surface)' }}
                            connectNulls />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* custom legend: names each line and says which axis it uses */}
              <ul className="chart-legend">
                <li><span className="legend-line" style={{ borderColor: DEM_COLOUR }} />{trend.country} — democracy (left axis, 0–10)</li>
                <li><span className="legend-line" style={{ borderColor: PRESS_COLOUR }} />{trend.country} — press freedom (right axis, 0–100)</li>
                {showCompare && (
                  <>
                    <li><span className="legend-line dashed" style={{ borderColor: DEM_COLOUR }} />{compareTrend.country} — democracy (dashed)</li>
                    <li><span className="legend-line dashed" style={{ borderColor: PRESS_COLOUR }} />{compareTrend.country} — press freedom (dashed)</li>
                  </>
                )}
              </ul>

              {/* a plain-text summary of what the chart shows */}
              <p className="chart-summary">
                {trend.country}: democracy score {trend.series[0].democracyScore} in {trend.series[0].year} and{' '}
                {last.democracyScore} in {last.year}; press freedom change by period {pressPeriodsText(trend.pressChangePeriods)}.
                {showCompare && ` ${compareTrend.country}: democracy score ${compareTrend.latestDemocracy} and press freedom score ${compareTrend.latestPress} in ${compareTrend.series[compareTrend.series.length - 1].year}.`}
              </p>

              <ChartDataTable
                caption={showCompare ? `Scores by year: ${trend.country} and ${compareTrend.country}` : `Scores by year: ${trend.country}`}
                columns={[
                  { key: 'year', label: 'Year' },
                  { key: 'democracyScore', label: `${trend.country} democracy`, numeric: true },
                  { key: 'pressFreedomScore', label: `${trend.country} press freedom`, numeric: true },
                  ...(showCompare ? [
                    { key: 'compareDemocracy', label: `${compareTrend.country} democracy`, numeric: true },
                    { key: 'comparePress', label: `${compareTrend.country} press freedom`, numeric: true }
                  ] : [])
                ]}
                rows={chartData.map(r => ({ ...r, key: r.year }))}
              />
            </>
          )}
        </section>

        {trend && (
          <div className="stat-row">
            <StatCard icon="file" tone="accent" value={`${trend.latestDemocracy}/10`}
                      label={`Democracy score, ${last.year} (${fmtChange(trend.democracyChangeVsPrevYear)} vs previous year)`} />
            <StatCard icon="file" tone="accent" value={`${trend.latestPress}/100`}
                      label={`Press freedom score, ${last.year} (${fmtChange(trend.pressChangeVsPrevYear)} vs previous year)`} />
            <StatCard icon={trend.tenYearChangeDemocracy < 0 ? 'down' : 'up'}
                      tone={trend.tenYearChangeDemocracy < 0 ? 'decline' : 'improve'}
                      value={fmtChange(trend.tenYearChangeDemocracy)}
                      label={`Democracy change, ${trend.series[0].year}–${last.year}`} />
            <StatCard icon="file" tone="neutral"
                      value={trend.pressChangePeriods.map(p => fmtChange(p.change)).join(' · ') || '—'}
                      label={`Press freedom change, ${trend.pressChangePeriods.map(p => `${p.fromYear}–${p.toYear}`).join(' · ') || 'not enough data'}`} />
            <StatCard icon="globe" tone="accent"
                      value={rankText(trend.ranking.democracyRank, trend.ranking.totalCountries)}
                      label={`Democracy rank in this dashboard, ${trend.ranking.rankingYear}`} />
          </div>
        )}
      </div>
    </div>
  )
}
