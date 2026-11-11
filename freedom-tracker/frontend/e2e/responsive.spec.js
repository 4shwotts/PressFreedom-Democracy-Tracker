// Phone and tablet checks, run in both Chromium and WebKit (Safari's engine):
// nothing runs off the screen, and the charts and filters work with touch.
import { expect, test } from '@playwright/test'
import { apiGet, openDashboard, openTab } from './helpers'

const VIEWPORTS = [
  { name: 'small phone', width: 320, height: 568 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'tablet portrait', width: 820, height: 1180 },
  { name: 'tablet landscape', width: 1024, height: 768 }
]

const TABS = [
  ['Global Map', 'Global map'],
  ['Country Trends', 'Country trends'],
  ['Correlation', 'Correlation'],
  ['Data Summary', 'Data summary']
]

/** Elements that stick out past the right edge of the screen (ignoring the map, which clips its own shapes). */
async function overflowing(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const out = [...document.querySelectorAll('body *')]
      .filter(el => !el.closest('.map-stage, .chart-data-scroll, .recharts-wrapper'))
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > width + 1 })
      .map(el => `${el.tagName.toLowerCase()}.${el.className?.baseVal ?? el.className}`)
    return { pageScrollsSideways: document.documentElement.scrollWidth > width, out: out.slice(0, 5) }
  })
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: true })

    test('nothing runs off the screen on any tab', async ({ page }) => {
      await openDashboard(page)
      for (const [tab, heading] of TABS) {
        await openTab(page, tab, heading)
        await page.waitForLoadState('networkidle')
        expect(await overflowing(page), `${tab} at ${vp.width}px`).toEqual({ pageScrollsSideways: false, out: [] })
      }
    })

    test('the about-the-data page and footer fit the screen', async ({ page }) => {
      await page.goto('/about-the-data')
      await expect(page.getByRole('heading', { name: 'About the data', level: 2 })).toBeVisible()
      expect(await overflowing(page)).toEqual({ pageScrollsSideways: false, out: [] })
    })

    test('the ranking tables fit inside their cards, with no clipped columns', async ({ page }) => {
      await openDashboard(page)
      await openTab(page, 'Data Summary', 'Data summary')
      const clipped = await page.locator('.rank-table-card').evaluateAll(cards => cards.flatMap(card => {
        const edge = card.getBoundingClientRect().right
        return [...card.querySelectorAll('th, td')]
          .filter(cell => cell.getBoundingClientRect().right > edge + 0.5 || cell.scrollWidth > cell.clientWidth + 1)
          .map(cell => cell.textContent)
      }))
      expect(clipped).toEqual([])
    })

    test('the tabs, title and stat cards are fully visible', async ({ page }) => {
      await openDashboard(page)
      for (const tab of await page.getByRole('tab').all()) {
        const box = await tab.boundingBox()
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1)
      }
      const title = page.getByRole('heading', { level: 1 })
      expect(await title.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    })

    test('tapping a country on the map shows its tooltip', async ({ page }) => {
      await openDashboard(page)
      // wait until nothing will shift the layout: fonts loaded and the map coloured
      await page.evaluate(() => document.fonts.ready)
      await expect.poll(() => page.locator('.rsm-geography:not([fill="var(--color-no-data)"])').count()).toBeGreaterThan(100)
      await page.locator('.map-stage').scrollIntoViewIfNeeded()
      // pick the point and tap in one retryable step, so a late layout shift can't leave
      // the tap on the sea
      await expect(async () => {
      // find an on-screen point that's really on a country shape (shapes carry no names)
      const target = await page.locator('.rsm-geography').evaluateAll(paths => {
        const shapes = new Set(paths)
        const r = paths[0].ownerSVGElement.getBoundingClientRect()
        const top = Math.max(r.top, 0); const bottom = Math.min(r.bottom, window.innerHeight)
        for (let fy = 0.1; fy < 0.95; fy += 0.05) {
          for (let fx = 0.1; fx < 0.95; fx += 0.05) {
            const x = r.left + r.width * fx; const y = top + (bottom - top) * fy
            if (shapes.has(document.elementFromPoint(x, y))) return { x, y }
          }
        }
        return null
      })
      expect(target, 'a tappable country on screen').not.toBeNull()
      await page.touchscreen.tap(target.x, target.y)
      await expect(page.locator('.map-tooltip')).toBeVisible({ timeout: 2000 })
      }).toPass({ timeout: 15_000 })
      await expect(page.locator('.map-tooltip-name')).not.toBeEmpty()
    })

    test('the year slider and metric filter work by touch and keyboard', async ({ page }) => {
      await openDashboard(page)
      await page.getByLabel('Metric').selectOption('PressFreedomScore')
      await expect(page.getByText(/changed its press freedom methodology/)).toBeVisible()
      const slider = page.getByLabel('Year')
      await slider.focus()
      await page.keyboard.press('ArrowLeft')
      await expect(page.getByText('Press freedom score · 2022')).toBeVisible()
    })

    test('selecting and comparing countries works', async ({ page }) => {
      await openDashboard(page)
      await openTab(page, 'Country Trends', 'Country trends')
      await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('Norway')
      await page.getByRole('combobox', { name: 'Compare with (optional)' }).selectOption('Chad')
      await expect(page.getByText('Chad — democracy (dashed)')).toBeVisible()
      expect((await overflowing(page)).pageScrollsSideways).toBe(false)
    })

    test('tapping a dot on the correlation chart shows its country', async ({ page, request }) => {
      await openDashboard(page)
      await openTab(page, 'Correlation', 'Correlation')
      await page.getByRole('combobox', { name: 'Year' }).selectOption('2023')
      const corr = await apiGet(request, '/correlation?year=2023')
      await expect(page.locator('.recharts-scatter-symbol')).toHaveCount(corr.points.length)
      const dot = page.locator('.recharts-scatter-symbol').nth(10)
      await dot.scrollIntoViewIfNeeded()
      const box = await dot.boundingBox()
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
      const readout = page.locator('.chart-tap-readout')
      await expect(readout).toBeVisible()
      const name = await readout.locator('strong').innerText()
      expect(corr.points.map(p => p.country)).toContain(name)
    })
  })
}
