// Regression tests for the frontend bugs in BUGS.md. Each one failed on the
// code before its fix.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { api } from '../api'
import * as fx from './fixtures'
import { deferred } from './mocks'
import GlobalMapPage from '../pages/GlobalMapPage'
import CountryTrendsPage from '../pages/CountryTrendsPage'
import CorrelationPage from '../pages/CorrelationPage'
import DataSummaryPage from '../pages/DataSummaryPage'
import TopBar from '../components/TopBar'
import { ThemeProvider } from '../ThemeContext'

// matches a paragraph by its full text, including text inside <strong> — the
// default matcher only looks at an element's own text nodes
const paragraph = re => (_, el) => el?.tagName === 'P' && re.test(el.textContent)

vi.mock('recharts', async importOriginal => (await import('./mocks')).rechartsMock(importOriginal))
vi.mock('react-simple-maps', async () => (await import('./mocks')).simpleMapsMock())

beforeEach(() => {
  vi.spyOn(api, 'getCountryList').mockResolvedValue(['Norway', 'Chad'])
  vi.spyOn(api, 'getCorrelation').mockResolvedValue(fx.correlation())
  vi.spyOn(api, 'getSummary').mockResolvedValue(fx.summary)
})

describe('BUG-5: ranks and averages say which countries and year they cover', () => {
  it('Country Trends labels the rank as a dashboard rank, out of N countries, with the year', async () => {
    vi.spyOn(api, 'getCountryTrend').mockResolvedValue(fx.trend('Norway'))
    render(<CountryTrendsPage meta={fx.meta} />)
    expect(await screen.findByText(/among the 148 countries in this dashboard/i)).toBeInTheDocument()
    expect(screen.getAllByText(/not (the )?official/i).length).toBeGreaterThan(0)
  })

  it('the average democracy score card says which year and how many countries it covers', async () => {
    vi.spyOn(api, 'getMapData').mockResolvedValue(fx.mapData())
    render(<GlobalMapPage meta={fx.meta} />)
    expect(await screen.findByText(/2023.*148 countries/i)).toBeInTheDocument()
  })
})

describe('BUG-7: a slow, older response never replaces a newer one', () => {
  it('Global Map shows the year last selected, even if an earlier request finishes later', async () => {
    const first = deferred()
    const second = deferred()
    vi.spyOn(api, 'getMapData')
      .mockReturnValueOnce(first.promise)    // 2023, on load
      .mockReturnValueOnce(second.promise)   // 2015, after moving the slider
    const { container } = render(<GlobalMapPage meta={fx.meta} />)

    fireEvent.change(container.querySelector('input[type="range"]'), { target: { value: '2015' } })
    await act(async () => second.resolve(fx.mapData(2015)))
    await act(async () => first.resolve(fx.mapData(2023)))

    expect(screen.getByText(paragraph(/average democracy score in 2015/i))).toBeInTheDocument()
    expect(screen.queryByText(paragraph(/average democracy score in 2023/i))).not.toBeInTheDocument()
  })

  it('Country Trends shows the country last selected, even if an earlier request finishes later', async () => {
    const first = deferred()
    const second = deferred()
    vi.spyOn(api, 'getCountryTrend')
      .mockReturnValueOnce(first.promise)    // Norway, selected by default
      .mockReturnValueOnce(second.promise)   // Chad, selected by the user
    const { container } = render(<CountryTrendsPage meta={fx.meta} />)
    await screen.findAllByRole('option', { name: 'Chad' })   // wait for the country list

    fireEvent.change(container.querySelector('select'), { target: { value: 'Chad' } })
    await act(async () => second.resolve(fx.trend('Chad', { latestDemocracy: 1.67 })))
    await act(async () => first.resolve(fx.trend('Norway', { latestDemocracy: 9.81 })))

    expect(screen.getAllByText('1.67/10').length).toBeGreaterThan(0)
    expect(screen.queryByText('9.81/10')).not.toBeInTheDocument()
  })
})

describe('BUG-8: the histogram explanation describes skew correctly', () => {
  it('does not say a left-skewed distribution means most countries score low', async () => {
    render(<DataSummaryPage meta={fx.meta} />)
    await screen.findByText(/Dataset at a Glance/i)
    expect(screen.queryByText(/left-skewed distribution means most countries score low/i)).not.toBeInTheDocument()
  })
})

describe('BUG-9: every form control has an accessible name', () => {
  it('Global Map metric and year controls', async () => {
    vi.spyOn(api, 'getMapData').mockResolvedValue(fx.mapData())
    render(<GlobalMapPage meta={fx.meta} />)
    expect(screen.getByLabelText(/metric/i)).toBeInstanceOf(HTMLSelectElement)
    expect(screen.getByLabelText(/year/i)).toHaveAttribute('type', 'range')
  })

  it('Country Trends country selector', async () => {
    vi.spyOn(api, 'getCountryTrend').mockResolvedValue(fx.trend())
    render(<CountryTrendsPage meta={fx.meta} />)
    expect(await screen.findByRole('combobox', { name: /country/i })).toBeInTheDocument()
  })

  it('Correlation year selector', async () => {
    render(<CorrelationPage meta={fx.meta} />)
    expect(await screen.findByRole('combobox', { name: /year/i })).toBeInTheDocument()
  })
})

describe('BUG-11: the top bar button says what it does', () => {
  it('the button that opens the print dialog is labelled as printing, not exporting', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<ThemeProvider><TopBar onExport={() => window.print()} onPrint={() => window.print()} /></ThemeProvider>)
    const header = screen.getByRole('banner')
    fireEvent.click(within(header).getByRole('button', { name: /print/i }))
    expect(print).toHaveBeenCalled()
  })
})
