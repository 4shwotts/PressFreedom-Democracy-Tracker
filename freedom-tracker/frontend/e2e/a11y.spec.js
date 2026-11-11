// Automated accessibility scans (axe-core) of every main view, in light and
// dark mode, with the chart data tables open. Any violation fails the run, so
// a new problem can't slip in unnoticed.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openDashboard, openTab } from './helpers'

const VIEWS = [
  { tab: 'Global Map', heading: 'Global map' },
  { tab: 'Country Trends', heading: 'Country trends' },
  { tab: 'Correlation', heading: 'Correlation' },
  { tab: 'Data Summary', heading: 'Data summary' }
]

async function scan(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  // readable failure output: rule, impact and the first few offending elements
  const summary = results.violations.map(v =>
    `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join('\n    ')}`)
  expect(summary, summary.join('\n')).toEqual([])
}

for (const theme of ['light', 'dark']) {
  test.describe(`${theme} mode`, () => {
    for (const { tab, heading } of VIEWS) {
      test(`${tab} has no accessibility violations`, async ({ page }) => {
        await openDashboard(page)
        if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click()
        await openTab(page, tab, heading)
        await page.waitForLoadState('networkidle')
        // open the data tables so their markup is scanned too
        for (const summary of await page.locator('details.chart-data summary').all()) await summary.click()
        await scan(page)
      })
    }
  })
}

for (const theme of ['light', 'dark']) {
  test(`About the data (${theme} mode) has no accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme })
    await page.goto('/about-the-data')
    await expect(page.getByRole('heading', { name: 'About the data', level: 2 })).toBeVisible()
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await scan(page)
  })
}

test('the waking-server and error states have no accessibility violations', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({ status: 503, body: '' }))
  await page.clock.install()
  await page.goto('/')
  await page.clock.runFor(3000)
  await expect(page.getByText('Waking the server — this can take up to a minute')).toBeVisible()
  await scan(page)
  await page.clock.runFor(80_000)
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await scan(page)
})
