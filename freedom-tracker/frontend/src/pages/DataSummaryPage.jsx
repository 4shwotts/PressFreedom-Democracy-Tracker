import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import InsightPanel from '../components/InsightPanel'
import StatCard from '../components/StatCard'
import StatusMessage from '../components/StatusMessage'
import ChartDataTable from '../components/ChartDataTable'
import { useApi } from '../lib/useApi'
import { histogramData } from '../lib/chartData'
import { summaryInsights } from '../lib/insights'

// top or bottom 10 by combined score. Ranks come from the API: shared ranks for
// ties (1, 2, 2, 4), among the countries in this dashboard — not official ranks
function RankTable({ title, caption, rows, tone }) {
  return (
    <div className="rank-table-card">
      <h3 className={`rank-table-card-header ${tone}`}>{title}</h3>
      <div className="rank-table-scroll">
        <table className="rank-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {/* data-short is swapped in on phones (see responsive.css) so headers fit narrow columns */}
              <th scope="col">Rank</th>
              <th scope="col">Country</th>
              <th scope="col" data-short="Dem.">Democracy</th>
              <th scope="col">Press</th>
              <th scope="col" data-short="Comb.">Combined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.country}>
                <td>{r.rank}</td>
                <th scope="row" className="country-name">{r.country}</th>
                <td>{r.democracyScore}</td>
                <td>{r.pressFreedomScore}</td>
                <td className="combined">{r.combinedScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Histogram({ bins, colour, title, metricLabel }) {
  const data = histogramData(bins)
  return (
    <figure className="dist-card">
      <figcaption className="dist-card-title">{title}</figcaption>
      <div className="dist-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}
                    role="img" aria-label={`${title}. The counts are in the table below.`}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" stroke="var(--color-text-tertiary)" fontSize={9.5} interval={1}
                   angle={-30} textAnchor="end" height={45} />
            <YAxis stroke="var(--color-text-tertiary)" fontSize={10.5} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 8,
                fontSize: 12, fontFamily: 'var(--font-body)', boxShadow: 'var(--shadow-md)'
              }}
              labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: 4 }}
              itemStyle={{ color: 'var(--color-accent-text)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
              formatter={value => [value, 'Countries']}
            />
            {/* no grow-in animation: the bars render straight away (and respect reduced motion) */}
            <Bar dataKey="count" fill={colour} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable
        caption={title}
        columns={[{ key: 'label', label: `${metricLabel} range` }, { key: 'count', label: 'Countries', numeric: true }]}
        rows={data.map(d => ({ ...d, key: d.label }))}
      />
    </figure>
  )
}

export default function DataSummaryPage({ meta }) {
  const { data: summary, error, loading, retry } = useApi(() => api.getSummary(), [])
  const year = summary?.year ?? meta.yearMax
  const rankNote = summary
    ? `Ranked by combined score among the ${summary.rankedCountries} countries in this dashboard with ${year} data. These are not the official EIU or RSF ranks. Ranks use unrounded scores, so countries can show the same rounded score with different ranks.`
    : ''

  return (
    <div className="page-body">
      <InsightPanel insights={summaryInsights(summary)} />

      <div>
        <section className="main-panel" aria-labelledby="summary-title">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" id="summary-title">Data summary</h2>
              <p className="panel-subtitle">Score distributions and rankings for {year}.</p>
            </div>
          </div>

          <StatusMessage loading={loading && !summary} error={error} onRetry={retry} loadingText="Loading summary…" />

          {summary && (
            <>
              <div className="dist-row">
                <Histogram bins={summary.democracyHistogram} colour="#E11D48" metricLabel="Democracy score"
                           title={`Democracy score distribution (${year})`} />
                <Histogram bins={summary.pressHistogram} colour="#2D7DD2" metricLabel="Press freedom score"
                           title={`Press freedom score distribution (${year})`} />
              </div>

              <p className="chart-hint rank-note">{rankNote}</p>
              <div className="rank-table-wrap">
                <RankTable title="Top 10 — highest combined score" tone="top" rows={summary.top10}
                           caption={`Top 10 by combined score, ${year}. ${rankNote}`} />
                <RankTable title="Bottom 10 — lowest combined score" tone="bottom" rows={summary.bottom10}
                           caption={`Bottom 10 by combined score, ${year}, lowest first. ${rankNote}`} />
              </div>
            </>
          )}
        </section>

        {summary && (
          <div className="stat-row">
            <StatCard icon="globe" tone="accent" value={summary.totalCountries} label="Countries in this dashboard" />
            <StatCard icon="calendar" tone="accent" value={summary.totalYears} label="Years of data" />
            <StatCard icon="file" tone="accent" value={summary.totalRecords.toLocaleString('en-GB')} label="Country-year observations" />
            <StatCard icon="down" tone="neutral" value={`${summary.scoreGapTopVsBottom} pts`} label={`Top 10 vs bottom 10, ${year}`} />
            <StatCard icon="up" tone="neutral" value={summary.biggestGapCountry?.country ?? '—'} label="Largest gap between the indices" />
          </div>
        )}
      </div>
    </div>
  )
}
