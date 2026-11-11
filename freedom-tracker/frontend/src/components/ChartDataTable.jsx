import { useState } from 'react'

// The accessible alternative to a chart: the same numbers as a table, behind a
// "show the data" toggle so it doesn't crowd the page. Screen readers and
// keyboard users get every value the chart shows without needing to hover.
// Rows are only built once the table is opened, so large tables (e.g. 1,800
// correlation points) don't slow the page down.
//
// columns: [{ key, label, numeric? }]; rows: array of objects keyed by column key
export default function ChartDataTable({ caption, columns, rows, summaryLabel = 'Show the data as a table' }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="chart-data" onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>{summaryLabel} <span className="chart-data-count">({rows.length} rows)</span></summary>
      {open && (
        // a focusable, named region so keyboard users can scroll a long table
        <div className="chart-data-scroll" role="region" aria-label={caption} tabIndex={0}>
          <table className="data-table">
            <caption>{caption}</caption>
            <thead>
              <tr>
                {columns.map(c => (
                  <th key={c.key} scope="col" className={c.numeric ? 'num' : undefined}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.key ?? i}>
                  {columns.map((c, j) => {
                    const value = row[c.key] ?? '—'
                    return j === 0
                      ? <th key={c.key} scope="row">{value}</th>
                      : <td key={c.key} className={c.numeric ? 'num' : undefined}>{value}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}
