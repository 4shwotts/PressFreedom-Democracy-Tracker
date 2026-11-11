import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { api, ApiError } from './api'
import * as fx from './test/fixtures'

vi.mock('recharts', async importOriginal => (await import('./test/mocks')).rechartsMock(importOriginal))
vi.mock('react-simple-maps', async () => (await import('./test/mocks')).simpleMapsMock())

beforeEach(() => {
  vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok' })
  vi.spyOn(api, 'getMeta').mockResolvedValue(fx.meta)
  vi.spyOn(api, 'getMapData').mockResolvedValue(fx.mapData())
  vi.spyOn(api, 'getCountryList').mockResolvedValue(['Norway'])
  vi.spyOn(api, 'getCountryTrend').mockResolvedValue(fx.trend())
  vi.spyOn(api, 'getCorrelation').mockResolvedValue(fx.correlation())
  vi.spyOn(api, 'getSummary').mockResolvedValue(fx.summary)
})

describe('App', () => {
  it('wakes the server before loading any data, then opens on the map', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Global map' })).toBeInTheDocument()
    expect(api.health).toHaveBeenCalled()
    expect(api.health.mock.invocationCallOrder[0]).toBeLessThan(api.getMeta.mock.invocationCallOrder[0])
  })

  it('switching tabs shows each page and links the tab to its panel', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Global map' })
    for (const [tab, heading] of [['Country Trends', 'Country trends'], ['Correlation', 'Correlation'], ['Data Summary', 'Data summary']]) {
      await userEvent.click(screen.getByRole('tab', { name: tab }))
      expect(await screen.findByRole('heading', { name: heading, level: 2 })).toBeInTheDocument()
      expect(screen.getByRole('tabpanel')).toHaveAccessibleName(tab)
    }
  })

  it('shows an error with Retry if the headline data fails to load', async () => {
    api.getMeta.mockRejectedValueOnce(new ApiError(500, 'Internal server error'))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Global map' })).toBeInTheDocument()
  })

  it('the print button opens the print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(print).toHaveBeenCalledOnce()
  })

  it('the theme button switches between light and dark mode', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'))
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'))
  })

  it('has a skip link to the main content', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'Skip to the dashboard' })).toHaveAttribute('href', '#main')
  })
})
