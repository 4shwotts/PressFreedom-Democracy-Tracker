import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StatusMessage from './StatusMessage'
import ChartDataTable from './ChartDataTable'
import TabNav from './TabNav'
import InsightPanel from './InsightPanel'
import MethodologyNote from './MethodologyNote'

describe('StatusMessage', () => {
  it('shows nothing when there is data', () => {
    const { container } = render(<StatusMessage loading={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a loading message', () => {
    render(<StatusMessage loading loadingText="Loading map data…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading map data…')
  })

  it('shows an empty state', () => {
    render(<StatusMessage empty emptyText="No countries match" />)
    expect(screen.getByRole('status')).toHaveTextContent('No countries match')
  })

  it('shows the error with a Retry button that calls back', async () => {
    const retry = vi.fn()
    render(<StatusMessage error={new Error('The server returned an error (500)')} onRetry={retry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load this data. The server returned an error (500)')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('an error takes priority over loading', () => {
    render(<StatusMessage loading error={new Error('x')} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('ChartDataTable', () => {
  const props = {
    caption: 'Scores by country, 2023',
    columns: [{ key: 'country', label: 'Country' }, { key: 'score', label: 'Score', numeric: true }],
    rows: [{ key: 'NOR', country: 'Norway', score: 9.81 }, { key: 'TCD', country: 'Chad', score: null }]
  }

  it('is closed by default and says how many rows it has', () => {
    render(<ChartDataTable {...props} />)
    expect(screen.getByText(/Show the data as a table/)).toHaveTextContent('(2 rows)')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('opens to a captioned table with row headers and a dash for missing values', () => {
    const { container } = render(<ChartDataTable {...props} />)
    const details = container.querySelector('details')
    details.open = true
    fireEvent(details, new Event('toggle'))
    const table = screen.getByRole('table', { name: 'Scores by country, 2023' })
    expect(within(table).getByRole('rowheader', { name: 'Norway' })).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByText('—')).toBeInTheDocument()
  })
})

describe('TabNav', () => {
  it('marks the active tab as selected and gives it the only tab stop', () => {
    render(<TabNav active="trends" onChange={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(screen.getByRole('tab', { name: 'Country Trends' })).toHaveAttribute('aria-selected', 'true')
    expect(tabs.filter(t => t.tabIndex === 0)).toHaveLength(1)
  })

  it('changes tab on click', async () => {
    const onChange = vi.fn()
    render(<TabNav active="map" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Data Summary' }))
    expect(onChange).toHaveBeenCalledWith('summary')
  })

  it.each([
    ['ArrowRight', 'map', 'trends'],
    ['ArrowLeft', 'map', 'summary'],     // wraps round
    ['ArrowRight', 'summary', 'map'],
    ['Home', 'correlation', 'map'],
    ['End', 'map', 'summary']
  ])('%s from %s goes to %s', (key, from, to) => {
    const onChange = vi.fn()
    render(<TabNav active={from} onChange={onChange} />)
    // key presses come from the focused tab, which is the selected one
    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key })
    expect(onChange).toHaveBeenCalledWith(to)
  })

  it('ignores other keys', () => {
    const onChange = vi.fn()
    render(<TabNav active="map" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'a' })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('InsightPanel', () => {
  it('shows a placeholder before there are insights', () => {
    render(<InsightPanel insights={[]} />)
    expect(screen.getByText(/Insights appear here/)).toBeInTheDocument()
  })

  it('lists insights with headings and keeps figures in bold', () => {
    render(<InsightPanel insights={[{ tone: 'info', title: 'Global average', body: 'Average <strong>5.7</strong>' }]} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Global average' })).toBeInTheDocument()
    expect(screen.getByText('5.7').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})

describe('MethodologyNote', () => {
  it('explains the RSF 2022 methodology change', () => {
    render(<MethodologyNote />)
    expect(screen.getByText(/changed its press freedom methodology in 2022/)).toBeInTheDocument()
  })
})
