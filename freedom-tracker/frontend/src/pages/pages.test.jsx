// Page-level component tests: filters, country selection, chart data tables,
// and the loading, empty and error states. Charts and the map are stubbed (see
// test/mocks.jsx); Playwright covers the real rendering.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api, ApiError } from '../api'
import * as fx from '../test/fixtures'
import GlobalMapPage from './GlobalMapPage'
import CountryTrendsPage from './CountryTrendsPage'
import CorrelationPage from './CorrelationPage'
import DataSummaryPage from './DataSummaryPage'

vi.mock('recharts', async importOriginal => (await import('../test/mocks')).rechartsMock(importOriginal))
vi.mock('react-simple-maps', async () => (await import('../test/mocks')).simpleMapsMock())

// opens a ChartDataTable's <details> and returns its table
function openTable(name) {
  const summary = screen.getAllByText(/Show the data as a table/).find(s => !name || s.closest('details').textContent.includes(name)) ??
    screen.getAllByText(/Show the data as a table/)[0]
  const details = summary.closest('details')
  details.open = true
  fireEvent(details, new Event('toggle'))
  return within(details).getByRole('table')
}

const serverError = () => new ApiError(500, 'Internal server error')

// ---------------------------------------------------------------- Global map

describe('Global map', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getMapData').mockImplementation((year, metric) => Promise.resolve(fx.mapData(year, metric)))
  })

  it('loads the latest year for democracy by default', async () => {
    render(<GlobalMapPage meta={fx.meta} />)
    await screen.findByText('Global average')
    expect(api.getMapData).toHaveBeenCalledWith(2023, 'DemocracyScore')
  })

  it('changing the metric reloads the map and shows the methodology note for press freedom', async () => {
    render(<GlobalMapPage meta={fx.meta} />)
    expect(screen.queryByText(/changed its press freedom methodology/)).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Metric'), 'PressFreedomScore')
    await waitFor(() => expect(api.getMapData).toHaveBeenLastCalledWith(2023, 'PressFreedomScore'))
    expect(screen.getByText(/changed its press freedom methodology/)).toBeInTheDocument()
  })

  it('the year slider uses the range from the data and reloads the map', async () => {
    render(<GlobalMapPage meta={{ ...fx.meta, yearMin: 2010, yearMax: 2030 }} />)
    const slider = screen.getByLabelText('Year')
    expect(slider).toHaveAttribute('min', '2010')
    expect(slider).toHaveAttribute('max', '2030')
    fireEvent.change(slider, { target: { value: '2016' } })
    await waitFor(() => expect(api.getMapData).toHaveBeenLastCalledWith(2016, 'DemocracyScore'))
    expect(slider).toHaveAttribute('aria-valuetext', '2016')
  })

  it('the data table lists every country, including those with no data for the year', async () => {
    api.getMapData.mockResolvedValue(fx.mapData(2023, 'DemocracyScore', {
      noDataThisYear: [{ country: 'Iran', iso: 'IRN', yearFrom: 2013, yearTo: 2022 }]
    }))
    render(<GlobalMapPage meta={fx.meta} />)
    await screen.findByText(/1 countries have no data for 2023/)
    const table = openTable()
    expect(within(table).getByRole('rowheader', { name: 'Norway' }).closest('tr')).toHaveTextContent('9.81')
    expect(within(table).getByRole('rowheader', { name: 'Iran' }).closest('tr')).toHaveTextContent('No data')
  })

  it('shows a labelled colour key with the values for each colour', async () => {
    render(<GlobalMapPage meta={fx.meta} />)
    const key = await screen.findByLabelText('Colour key for democracy scores')
    expect(key).toHaveTextContent('0')
    expect(key).toHaveTextContent('10')
    expect(key).toHaveTextContent('No data')
  })

  it('shows an error with Retry when the map data fails to load', async () => {
    api.getMapData.mockRejectedValueOnce(serverError()).mockResolvedValue(fx.mapData())
    render(<GlobalMapPage meta={fx.meta} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Global average')).toBeInTheDocument()
  })

  it('the stat cards state what the average covers', async () => {
    render(<GlobalMapPage meta={fx.meta} />)
    expect(await screen.findByText('Average democracy score, 2023 (148 countries)')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------- Country trends

describe('Country trends', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getCountryList').mockResolvedValue(['Chad', 'Côte d’Ivoire', 'Norway', 'North Korea'])
    vi.spyOn(api, 'getCountryTrend').mockImplementation(c => Promise.resolve(fx.trend(c)))
  })

  it('selects the first country by default', async () => {
    render(<CountryTrendsPage meta={fx.meta} />)
    await waitFor(() => expect(api.getCountryTrend).toHaveBeenCalledWith('Chad'))
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue('Chad')
  })

  it('selecting a country loads its data', async () => {
    render(<CountryTrendsPage meta={fx.meta} />)
    await screen.findAllByRole('option', { name: 'Norway' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Country' }), 'Norway')
    await waitFor(() => expect(api.getCountryTrend).toHaveBeenLastCalledWith('Norway'))
  })

  it('the search filters the country list, ignoring case and accents', async () => {
    render(<CountryTrendsPage meta={fx.meta} />)
    await screen.findAllByRole('option', { name: 'Norway' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search countries' }), 'COTE')
    const options = within(screen.getByRole('combobox', { name: 'Country' })).getAllByRole('option').map(o => o.textContent)
    // the current choice (Chad) stays available alongside the matches
    expect(options).toEqual(['Chad', 'Côte d’Ivoire'])
  })

  it('shows an empty state when no country matches the search', async () => {
    render(<CountryTrendsPage meta={fx.meta} />)
    await screen.findAllByRole('option', { name: 'Norway' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search countries' }), 'Atlantis')
    expect(screen.getByRole('status')).toHaveTextContent('No countries match “Atlantis”')
  })

  it('comparing with a second country loads it and adds it to the chart table and legend', async () => {
    render(<CountryTrendsPage meta={fx.meta} />)
    await screen.findByText('Rank in this dashboard')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Compare with (optional)' }), 'Norway')
    await waitFor(() => expect(api.getCountryTrend).toHaveBeenCalledWith('Norway'))
    expect(await screen.findByText('Norway — democracy (dashed)')).toBeInTheDocument()
    const table = openTable()
    expect(within(table).getByRole('columnheader', { name: 'Norway democracy' })).toBeInTheDocument()
    expect(table).toHaveAccessibleName('Scores by year: Chad and Norway')
  })

  it('the compare list leaves out the selected country', async () => {
    render(<CountryTrendsPage meta={fx.meta} />)
    await screen.findAllByRole('option', { name: 'Norway' })
    const compare = screen.getByRole('combobox', { name: 'Compare with (optional)' })
    expect(within(compare).queryByRole('option', { name: 'Chad' })).not.toBeInTheDocument()
  })

  it('shows press freedom changes per period and the dashboard rank in the stat cards', async () => {
    api.getCountryTrend.mockResolvedValue(fx.trend('Chad', { pressChangePeriods: [
      { fromYear: 2013, toYear: 2021, change: -9 }, { fromYear: 2022, toYear: 2023, change: 1.2 }
    ] }))
    render(<CountryTrendsPage meta={fx.meta} />)
    expect(await screen.findByText('-9 · +1.2')).toBeInTheDocument()
    expect(screen.getByText('Press freedom change, 2013–2021 · 2022–2023')).toBeInTheDocument()
    expect(screen.getByText('Democracy rank in this dashboard, 2023')).toBeInTheDocument()
  })

  it('shows an error with Retry when a country fails to load', async () => {
    api.getCountryTrend.mockRejectedValueOnce(serverError())
    render(<CountryTrendsPage meta={fx.meta} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Rank in this dashboard')).toBeInTheDocument()
  })

  it('shows an error when the country list fails to load', async () => {
    api.getCountryList.mockRejectedValue(serverError())
    render(<CountryTrendsPage meta={fx.meta} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeDisabled()
  })
})

// ---------------------------------------------------------------- Correlation

describe('Correlation', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getCorrelation').mockImplementation(year => Promise.resolve(fx.correlation(year)))
  })

  it('opens on all years on a wide screen and offers every year from the data', async () => {
    render(<CorrelationPage meta={fx.meta} />)
    await waitFor(() => expect(api.getCorrelation).toHaveBeenCalledWith('all'))
    const options = within(screen.getByRole('combobox', { name: 'Year' })).getAllByRole('option')
    expect(options.map(o => o.value)).toEqual(['all', ...Array.from({ length: 11 }, (_, i) => String(2013 + i))])
  })

  it('opens on the latest single year on a phone', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(q => ({
      matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}
    }))
    render(<CorrelationPage meta={fx.meta} />)
    await waitFor(() => expect(api.getCorrelation).toHaveBeenCalledWith('2023'))
    expect(api.getCorrelation).not.toHaveBeenCalledWith('all')
  })

  it('changing the year reloads the data and hides the all-years note', async () => {
    render(<CorrelationPage meta={fx.meta} />)
    expect(await screen.findByText(/changed its press freedom methodology/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Year' }), '2019')
    await waitFor(() => expect(api.getCorrelation).toHaveBeenLastCalledWith('2019'))
    expect(screen.queryByText(/changed its press freedom methodology/)).not.toBeInTheDocument()
  })

  it('the stat cards and data table show the API values', async () => {
    render(<CorrelationPage meta={fx.meta} />)
    expect(await screen.findByText('0.765', { selector: '.stat-card-value' })).toBeInTheDocument()
    expect(screen.getByText('1,818', { selector: '.stat-card-value' })).toBeInTheDocument()
    const table = openTable()
    expect(within(table).getByRole('rowheader', { name: 'Chad' }).closest('tr')).toHaveTextContent('1.67')
  })

  it('shows an error with Retry when the data fails to load', async () => {
    api.getCorrelation.mockRejectedValueOnce(serverError())
    render(<CorrelationPage meta={fx.meta} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('0.765', { selector: '.stat-card-value' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------- Data summary

describe('Data summary', () => {
  beforeEach(() => vi.spyOn(api, 'getSummary').mockResolvedValue(fx.summary))

  it('shows the API ranks, including shared ranks for ties', async () => {
    render(<DataSummaryPage meta={fx.meta} />)
    const top = await screen.findByRole('table', { name: /Top 10 by combined score/ })
    const rows = within(top).getAllByRole('row').slice(1).map(r => r.textContent)
    expect(rows).toEqual(['1Norway9.895.29.7', '2Denmark9.389.59.1', '2Sweden9.488.29.1'])
  })

  it('says the ranks are among the countries in this dashboard, not official ranks', async () => {
    render(<DataSummaryPage meta={fx.meta} />)
    expect(await screen.findByText(/among the 148 countries in this dashboard with 2023 data\. These are not the official EIU or RSF ranks/,
      { selector: 'p' })).toBeInTheDocument()
  })

  it('each histogram has a data table with the counts', async () => {
    render(<DataSummaryPage meta={fx.meta} />)
    await screen.findByText(/Democracy score distribution/, { selector: 'figcaption' })
    const table = openTable('Democracy score distribution')
    expect(within(table).getByRole('rowheader', { name: '0.3–5' }).closest('tr')).toHaveTextContent('70')
  })

  it('shows an error with Retry when the summary fails to load', async () => {
    api.getSummary.mockRejectedValueOnce(serverError())
    render(<DataSummaryPage meta={fx.meta} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table', { name: /Top 10/ })).toBeInTheDocument()
  })
})
