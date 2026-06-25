import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import InsightPanel from '../components/InsightPanel'
import StatCard from '../components/StatCard'

// generates insight rail entries based on the trend data returned for a country
// covers overall direction, sharpest single-year drop, average performance, and global ranking
function buildInsights(trend) {
  if (!trend) return []
  const insights = []

  // work out which direction each metric moved over the full period
  const demoTone    = trend.tenYearChangeDemocracy < 0 ? 'decline' : trend.tenYearChangeDemocracy > 0 ? 'improve' : 'neutral'
  const pressTone   = trend.tenYearChangePress     < 0 ? 'decline' : trend.tenYearChangePress     > 0 ? 'improve' : 'neutral'
  const bothDeclining = trend.tenYearChangeDemocracy < 0 && trend.tenYearChangePress < 0
  const bothImproving = trend.tenYearChangeDemocracy > 0 && trend.tenYearChangePress > 0

  // first card: overall direction — we show a unified message if both metrics moved the same way,
  // otherwise show a mixed message with the individual changes
  if (bothDeclining) {
    insights.push({
      tone: 'decline',
      title: 'Declining Trend',
      body: `Both democracy and press freedom scores have declined over the <strong>${trend.yearsAvailable}-year</strong> period on record.`
    })
  } else if (bothImproving) {
    insights.push({
      tone: 'improve',
      title: 'Improving Trend',
      body: `Both democracy and press freedom scores have improved over the <strong>${trend.yearsAvailable}-year</strong> period on record.`
    })
  } else {
    insights.push({
      tone: 'neutral',
      title: 'Mixed Trend',
      body: `Democracy has ${demoTone === 'improve' ? 'risen' : 'fallen'} (<strong>${trend.tenYearChangeDemocracy > 0 ? '+' : ''}${trend.tenYearChangeDemocracy}</strong>) while press freedom has ${pressTone === 'improve' ? 'risen' : 'fallen'} (<strong>${trend.tenYearChangePress > 0 ? '+' : ''}${trend.tenYearChangePress}</strong>) over the <strong>${trend.yearsAvailable}-year</strong> period.`
    })
  }

  // sharpestDrop is calculated server-side as the largest single-year negative change in press freedom
  // the backend returns null if no year-on-year decline exists at all
  if (trend.sharpestDrop) {
    insights.push({
      tone: 'decline',
      title: 'Sharpest Drop',
      body: `The biggest single-year decline in press freedom was between <strong>${trend.sharpestDrop.fromYear}</strong> and <strong>${trend.sharpestDrop.toYear}</strong> — a drop of <strong>${trend.sharpestDrop.delta}</strong> points.`
    })
  } else {
    insights.push({
      tone: 'improve',
      title: 'No Sharp Drops',
      body: `Press freedom scores show no significant single-year decline across the full period — a sign of relative stability on this metric.`
    })
  }

  // average performance card — tone depends on where the average falls on the scale
  insights.push({
    tone: trend.avgDemocracy < 4 ? 'decline' : trend.avgDemocracy > 7.5 ? 'improve' : 'neutral',
    title: trend.avgDemocracy < 4 ? 'Consistently Low' : trend.avgDemocracy > 7.5 ? 'Consistently High' : 'Mid-Range Performance',
    body: `Democracy averaged <strong>${trend.avgDemocracy}/10</strong> and press freedom averaged <strong>${trend.avgPress}/100</strong> across the full period — ${
      trend.avgDemocracy < 4
        ? 'placing this country among the lower-scoring nations globally.'
        : trend.avgDemocracy > 7.5
        ? 'placing this country among the stronger democracies globally.'
        : 'a mid-range performance on both metrics.'
    }`
  })

  // global ranking comes from the most recent year the country has data for
  // some countries are missing 2023 data so the backend ranks against whichever year is latest
  if (trend.ranking) {
    insights.push({
      tone: 'info',
      title: 'Global Standing',
      body: `Ranks <strong>${trend.ranking.democracyRank}/${trend.ranking.totalCountries}</strong> on democracy and <strong>${trend.ranking.pressRank}/${trend.ranking.totalCountries}</strong> on press freedom globally (${trend.ranking.rankingYear} data).`
    })
  }

  return insights
}

// formats a numeric change value, prepending + for positive numbers
function fmtChange(val) {
  if (val === null || val === undefined) return '—'
  return `${val > 0 ? '+' : ''}${val}`
}

export default function CountryTrendsPage({ meta }) {
  const [countries, setCountries] = useState([])
  const [selected, setSelected]   = useState('')
  const [trend, setTrend]         = useState(null)
  const [loading, setLoading]     = useState(true)

  // fetch the country list once on mount
  // default to Afghanistan because it's alphabetically first and has interesting data
  useEffect(() => {
    api.getCountryList().then(list => {
      setCountries(list)
      if (list.length) setSelected(list.includes('Afghanistan') ? 'Afghanistan' : list[0])
    })
  }, [])

  // whenever the selected country changes, fetch its full trend data
  useEffect(() => {
    if (!selected) return
    setLoading(true)
    api.getCountryTrend(selected).then(data => {
      setTrend(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [selected])

  if (!meta) return null

  return (
    <div className="page-body">
      <InsightPanel insights={buildInsights(trend)} />

      <div>
        <div className="main-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Country Trends</h2>
              <p className="panel-subtitle">Track how a country's scores have changed over the full period of available data.</p>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <label className="control-label">Select Country to Analyse</label>
                <select
                  className="select-control"
                  value={selected}
                  onChange={e => setSelected(e.target.value)}
                >
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="panel-info-box">
              <strong>About this chart:</strong> this line chart shows how democracy and press
              freedom scores have changed over time for the selected country.
              The two metrics use different scales — check the axis legend below.
            </div>
          </div>

          {loading || !trend ? (
            <div className="loading-state">Loading country data…</div>
          ) : (
            <>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trend.series}
                    margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />

                    <XAxis
                      dataKey="year"
                      stroke="var(--color-text-tertiary)"
                      fontSize={11.5}
                      tickLine={false}
                    />

                    {/* left axis covers democracy (0–10) */}
                    <YAxis
                      yAxisId="left"
                      stroke="var(--color-text-tertiary)"
                      fontSize={11.5}
                      tickLine={false}
                      domain={[0, 10]}
                    />

                    {/* right axis covers press freedom (0–100) — different scale to democracy
                        which is why we need dual axes and the legend below to explain them */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="var(--color-text-tertiary)"
                      fontSize={11.5}
                      tickLine={false}
                      domain={[0, 100]}
                    />

                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface-raised)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontFamily: 'var(--font-body)'
                      }}
                    />

                    {/* democracy line plots against the left axis */}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="democracyScore"
                      name="Democracy Score"
                      stroke="#E11D48"
                      strokeWidth={2.4}
                      dot={{ r: 2.5 }}
                      activeDot={{ r: 5 }}
                    />

                    {/* press freedom line plots against the right axis */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="pressFreedomScore"
                      name="Press Freedom Score"
                      stroke="#2D7DD2"
                      strokeWidth={2.4}
                      dot={{ r: 2.5 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* custom legend replaces the Recharts default — explicitly tells the reader
                  which axis each line uses, which isn't obvious from the chart alone */}
              <div style={{
                display: 'flex',
                gap: 'var(--space-5)',
                marginTop: 'var(--space-2)',
                fontSize: 11.5,
                flexShrink: 0
              }}>
                <span style={{ color: '#E11D48', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-block', width: 24, height: 2,
                    background: '#E11D48', borderRadius: 2, flexShrink: 0
                  }} />
                  Democracy Score. Left axis (0–10)
                </span>
                <span style={{ color: '#2D7DD2', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-block', width: 24, height: 2,
                    background: '#2D7DD2', borderRadius: 2, flexShrink: 0
                  }} />
                  Press Freedom Score. Right axis (0–100)
                </span>
              </div>

              {/* caption row shows the key numbers at a glance below the chart */}
              <div className="chart-caption">
                <span>Latest Democracy Score: <strong style={{ fontFamily: 'var(--font-mono)' }}>{trend.latestDemocracy}/10</strong></span>
                <span>Latest Press Freedom Score: <strong style={{ fontFamily: 'var(--font-mono)' }}>{trend.latestPress}/100</strong></span>
                <span>Data available for <strong>{trend.yearsAvailable}</strong> years ({meta.yearMin}–{meta.yearMax})</span>
              </div>
            </>
          )}
        </div>

        <div style={{ height: 'var(--space-3)' }} />

        {trend && (
          <div className="stat-row">
            <StatCard
              icon="file"
              tone="accent"
              value={`${trend.latestDemocracy}/10`}
              // fmtChange adds a + sign for positive values so the direction is clear at a glance
              label={`Latest Democracy, ${fmtChange(trend.democracyChangeVsPrevYear)} vs prior yr`}
            />
            <StatCard
              icon="file"
              tone="accent"
              value={`${trend.latestPress}/100`}
              label={`Latest Press Freedom, ${fmtChange(trend.pressChangeVsPrevYear)} vs prior yr`}
            />
            <StatCard
              icon={trend.tenYearChangeDemocracy < 0 ? 'down' : 'up'}
              tone={trend.tenYearChangeDemocracy < 0 ? 'decline' : 'improve'}
              value={`${fmtChange(trend.tenYearChangeDemocracy)} / ${fmtChange(trend.tenYearChangePress)}`}
              // yearsAvailable is dynamic — 10 for most countries, 11 for those with full 2013–2023 data
              label={`Change over ${trend.yearsAvailable} years (Dem / Press)`}
            />
            <StatCard
              icon="file"
              tone="neutral"
              value={`${trend.avgDemocracy} / ${trend.avgPress}`}
              label="Average Over Period"
            />
            <StatCard
              icon="globe"
              tone="accent"
              value={trend.ranking ? `${trend.ranking.democracyRank}/${trend.ranking.totalCountries}` : '—'}
              label={`Global Ranking (${trend.ranking?.rankingYear ?? meta.yearMax})`}
            />
          </div>
        )}
      </div>
    </div>
  )
}