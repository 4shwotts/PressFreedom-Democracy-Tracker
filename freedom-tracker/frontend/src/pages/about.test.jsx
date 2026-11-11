// Credits, the about-the-data page and the disclaimer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import Footer from '../components/Footer'
import AboutPage from './AboutPage'
import { api } from '../api'
import { DISCLAIMER, PRIVACY, SOURCES } from '../lib/sources'
import * as fx from '../test/fixtures'

vi.mock('recharts', async importOriginal => (await import('../test/mocks')).rechartsMock(importOriginal))
vi.mock('react-simple-maps', async () => (await import('../test/mocks')).simpleMapsMock())

const link = name => screen.getByRole('link', { name })

describe('footer credits', () => {
  it('credits the EIU and RSF as owners of the scores, linking to their index pages', () => {
    render(<Footer navigate={() => {}} />)
    expect(link('Democracy Index © Economist Intelligence Unit')).toHaveAttribute('href', 'https://www.eiu.com/n/campaigns/democracy-index-2023/')
    expect(link('World Press Freedom Index © Reporters Without Borders (RSF)')).toHaveAttribute('href', 'https://rsf.org/en/index')
  })

  it('credits both Kaggle uploads with their licence position', () => {
    render(<Footer navigate={() => {}} />)
    expect(link('shreyasur965')).toHaveAttribute('href', SOURCES.democracy.upload.url)
    expect(link('batrosjamali')).toHaveAttribute('href', SOURCES.press.upload.url)
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('(CC0)')
    expect(footer).toHaveTextContent('(no licence stated)')
  })

  it('shows the disclaimer: non-commercial, as-is, not affiliated, no political position', () => {
    render(<Footer navigate={() => {}} />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(DISCLAIMER)
    for (const words of [/non-commercial/, /provided as-is/, /Not affiliated with or endorsed by the Economist Intelligence Unit, Reporters Without Borders or Kaggle/, /does not take a political position/]) {
      expect(DISCLAIMER).toMatch(words)
    }
  })

  it('shows the privacy note: no cookies, analytics or storage; hosts see IP addresses', () => {
    render(<Footer navigate={() => {}} />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(PRIVACY)
    expect(PRIVACY).toMatch(/sets no cookies, has no analytics and stores nothing on your device/)
    expect(PRIVACY).toMatch(/Vercel, Render and Cloudflare\) see visitors’ IP addresses/)
  })

  it('external links open safely in a new tab', () => {
    render(<Footer navigate={() => {}} />)
    for (const a of screen.getAllByRole('link').filter(a => a.getAttribute('href').startsWith('http'))) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})

describe('about the data page', () => {
  beforeEach(() => render(<AboutPage navigate={() => {}} />))

  it.each([
    'Sources', 'Years covered', 'How the two datasets were merged', 'How rankings and calculated values are worked out',
    'Reporters Without Borders’ 2022 methodology change', 'Known gaps in the data', 'Disclaimer', 'Privacy',
    'Fonts, map and icons'
  ])('has a "%s" section', name => {
    expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument()
  })

  it('states the years covered and that the scores belong to their organisations', () => {
    expect(screen.getByText('2013 to 2023.')).toBeInTheDocument()
    expect(screen.getByText(/The scores belong to the Economist Intelligence Unit and Reporters Without Borders/)).toBeInTheDocument()
  })

  it('explains that ranks are dashboard ranks, not official ones, and the tie rule', () => {
    expect(screen.getByText('These are not the official EIU or RSF ranks')).toBeInTheDocument()
    expect(screen.getByText(/share the better rank and the next rank is skipped \(1, 2, 2, 4\)/)).toBeInTheDocument()
  })

  it('names the Kaggle licences, including the CC0 scope', () => {
    expect(link('CC0 1.0 (public domain dedication)')).toHaveAttribute('href', 'https://creativecommons.org/publicdomain/zero/1.0/')
    expect(screen.getByText(/covers the uploader’s compilation only/)).toBeInTheDocument()
    expect(screen.getByText(/No licence stated on Kaggle/)).toBeInTheDocument()
  })

  it('lists the known gaps with their counts', () => {
    const gaps = screen.getByRole('region', { name: 'Known gaps in the data' })
    expect(gaps).toHaveTextContent('No 2023 democracy score for 19 countries')
    expect(gaps).toHaveTextContent('13 places in the press freedom index have no EIU score')
    expect(gaps).toHaveTextContent('7 countries are too small to be drawn')
  })

  it('links to RSF’s 2022 methodology', () => {
    expect(link('changed how it compiles the World Press Freedom Index in 2022')).toHaveAttribute('href', SOURCES.press.methodologyUrl)
  })

  it('credits the fonts, map data and icons with their licences', () => {
    const credits = screen.getByRole('region', { name: 'Fonts, map and icons' })
    for (const text of ['Inter (font)', 'IBM Plex Mono (font)', 'world-atlas', 'Natural Earth', 'Feather Icons']) {
      expect(credits).toHaveTextContent(text)
    }
    expect(within(credits).getAllByText(/SIL Open Font Licence 1.1/)).toHaveLength(2)
  })
})

describe('navigation between the dashboard and the about page', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok' })
    vi.spyOn(api, 'getMeta').mockResolvedValue(fx.meta)
    vi.spyOn(api, 'getMapData').mockResolvedValue(fx.mapData())
  })
  afterEach(() => window.history.replaceState({}, '', '/'))

  it('the footer link opens /about-the-data without a page reload, and back returns', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Global map' })
    await userEvent.click(link('About the data'))
    expect(window.location.pathname).toBe('/about-the-data')
    expect(screen.getByRole('heading', { name: 'About the data', level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(document.title).toMatch(/^About the data/)

    await userEvent.click(link('← Back to the dashboard'))
    expect(window.location.pathname).toBe('/')
    expect(await screen.findByRole('heading', { name: 'Global map' })).toBeInTheDocument()
  })

  it('opening /about-the-data directly shows the page without waiting for the server', () => {
    window.history.replaceState({}, '', '/about-the-data')
    api.health.mockImplementation(() => new Promise(() => {}))   // a sleeping server
    render(<App />)
    expect(screen.getByRole('heading', { name: 'About the data', level: 2 })).toBeInTheDocument()
  })

  it('the browser back button returns to the dashboard', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Global map' })
    await userEvent.click(link('About the data'))
    await act(async () => {
      window.history.pushState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })
})
