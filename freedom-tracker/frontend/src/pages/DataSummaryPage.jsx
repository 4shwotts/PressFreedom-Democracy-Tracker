import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../api'
import InsightPanel from '../components/InsightPanel'
import StatCard from '../components/StatCard'

function buildInsights(summary) {
  if (!summary) return []
  const insights = []

  // overview card — just the headline numbers from the dataset
  insights.push({
    tone: 'info',
    title: 'Dataset at a Glance',
    body: `<strong>${summary.totalCountries}</strong> countries tracked across <strong>${summary.totalYears}</strong> years — <strong>${summary.totalRecords.toLocaleString()}</strong> total country-year observations.`
  })

  // scoreGapTopVsBottom is the difference in average combined score between the top 10 and bottom 10 countries
  if (summary.scoreGapTopVsBottom) {
    insights.push({
      tone: 'decline',
      title: 'The Freedom Gap',
      body: `The top 10 countries score <strong>${summary.scoreGapTopVsBottom}</strong> points higher than the bottom 10 on the combined freedom index — a stark global divide.`
    })
  }

  // biggestGapCountry is the country where democracy score and press freedom score diverge the most
  // interesting because it shows where political freedom and media freedom aren't aligned
  if (summary.biggestGapCountry) {
    insights.push({
      tone: 'neutral',
      title: 'Biggest Internal Gap',
      body: `<strong>${summary.biggestGapCountry.country}</strong> shows the widest mismatch — democracy score <strong>${summary.biggestGapCountry.democracyScore}/10</strong> vs press freedom <strong>${summary.biggestGapCountry.pressFreedomScore}/100</strong>.`
    })
  }

  // explain the combined score methodology so the rankings make sense to the reader
  insights.push({
    tone: 'neutral',
    title: 'How Rankings Work',
    body: `Countries are ranked by a <strong>combined score</strong> — democracy (0–10) and press freedom (0–100, rescaled to 0–10) averaged equally together.`
  })

  insights.push({
    tone: 'info',
    title: 'Reading the Distributions',
    body: `The histograms show how scores are spread across all countries. A left-skewed distribution means most countries score low; right-skewed means most score high.`
  })

  return insights
}

// RankTable renders a top/bottom 10 table that fills its grid cell top to bottom
// the percentage row height trick distributes available space evenly across all rows
// so there's no dead space below the last row
function RankTable({ title, rows, tone }) {
  const rowHeightPct = `${(100 / rows.length).toFixed(2)}%`

  return (
    <div
      className="rank-table-card"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div className={`rank-table-card-header ${tone}`}>{title}</div>

      {/* inner wrapper takes flex:1 so the table can use height:100% for percentage row heights */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <table className="rank-table" style={{ flex: 1, height: '100%' }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Country</th>
              <th>Democracy</th>
              <th>Press</th>
              <th>Combined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              // percentage height on each tr distributes table height evenly across rows
              <tr key={r.country} style={{ height: rowHeightPct }}>
                <td>{i + 1}</td>
                <td className="country-name">{r.country}</td>
                <td>{r.democracyScore}</td>
                <td>{r.pressFreedomScore}</td>
                <td style={{ fontWeight: 600 }}>{r.combinedScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Histogram wraps a Recharts BarChart for the score distribution panels
// color prop sets the bar fill — red for democracy, blue for press freedom
function Histogram({ data, color, title }) {
  // convert bin objects from the API into the label+count shape Recharts expects
  const chartData = data.map(d => ({
    label: `${d.binStart}–${d.binEnd}`,
    count: d.count
  }))

  return (
    <div className="dist-card">
      <p className="dist-card-title">{title}</p>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--color-text-tertiary)"
              fontSize={9.5}
              interval={1}
              angle={-30}
              textAnchor="end"
              height={45}
            />
            <YAxis
              stroke="var(--color-text-tertiary)"
              fontSize={10.5}
              allowDecimals={false}
            />
            {/* tooltip styled to match the rest of the app's design system
                labelStyle controls the bin range label, itemStyle controls the count value */}
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                boxShadow: 'var(--shadow-md)'
              }}
              labelStyle={{
                color: 'var(--color-text-primary)',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                marginBottom: 4
              }}
              itemStyle={{
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600
              }}
              formatter={(value) => [value, 'Countries']}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {/* Cell applies the colour prop to every bar — same fill across all bins */}
              {chartData.map((_, i) => <Cell key={i} fill={color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function DataSummaryPage({ meta }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  // summary data is static (always the latest year) so we only fetch once on mount
  useEffect(() => {
    api.getSummary().then(data => {
      setSummary(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (!meta) return null

  return (
    <div className="page-body">
      <InsightPanel insights={buildInsights(summary)} />

      <div>
        <div className="main-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Data Summary</h2>
              <p className="panel-subtitle">
                Score distributions and global rankings for {summary?.year ?? meta.yearMax}.
              </p>
            </div>
          </div>

          {loading || !summary ? (
            <div className="loading-state">Loading summary…</div>
          ) : (
            <>
              {/* two histograms side by side — democracy (red) and press freedom (blue) */}
              <div className="dist-row">
                <Histogram
                  data={summary.democracyHistogram}
                  color="#E11D48"
                  title={`Democracy Score Distribution (${summary.year})`}
                />
                <Histogram
                  data={summary.pressHistogram}
                  color="#2D7DD2"
                  title={`Press Freedom Score Distribution (${summary.year})`}
                />
              </div>

              {/* top and bottom 10 tables sit in a 2-column grid defined in CSS */}
              <div className="rank-table-wrap">
                <RankTable title="Top 10 — Highest Combined Score"   rows={summary.top10}    tone="top" />
                <RankTable title="Bottom 10 — Lowest Combined Score" rows={summary.bottom10} tone="bottom" />
              </div>
            </>
          )}
        </div>

        <div style={{ height: 'var(--space-3)' }} />

        {summary && (
          <div className="stat-row">
            <StatCard icon="globe"    tone="accent"  value={summary.totalCountries}                    label="Total Countries" />
            <StatCard icon="calendar" tone="accent"  value={summary.totalYears}                        label="Years of Data" />
            <StatCard icon="file"     tone="accent"  value={summary.totalRecords.toLocaleString()}     label="Total Records" />
            <StatCard icon="down"     tone="decline" value={`${summary.scoreGapTopVsBottom}pts`}       label="Top 10 vs Bottom 10 Gap" />
            <StatCard icon="up"       tone="neutral" value={summary.biggestGapCountry?.country ?? '—'} label="Largest Internal Gap" />
          </div>
        )}
      </div>
    </div>
  )
}