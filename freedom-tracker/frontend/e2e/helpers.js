// Shared helpers for the Playwright tests.
import { expect } from '@playwright/test'

/** Opens the dashboard and waits for the map's country shapes to be drawn. */
export async function openDashboard(page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Global map' })).toBeVisible()
  await expect.poll(() => page.locator('.rsm-geography').count()).toBeGreaterThan(100)
}

/** Switches to a tab by its full name and waits for the page heading. */
export async function openTab(page, tab, heading) {
  await page.getByRole('tab', { name: tab }).click()
  await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible()
}

/** Reads JSON straight from the API (through the preview server's /api proxy). */
export async function apiGet(request, path) {
  const res = await request.get(`/api${path}`)
  expect(res.ok(), `GET /api${path}`).toBeTruthy()
  return res.json()
}

/** Opens a "Show the data as a table" panel and returns its table. */
export async function openDataTable(scope, index = 0) {
  const details = scope.locator('details.chart-data').nth(index)
  await details.locator('summary').click()
  const table = details.getByRole('table')
  await expect(table).toBeVisible()
  return table
}

/** Text of each cell in a table row whose row header is `name`. */
export async function rowCells(table, name) {
  const row = table.getByRole('row').filter({ has: table.page().getByRole('rowheader', { name, exact: true }) })
  return row.locator('th, td').allInnerTexts()
}

/**
 * Hovers each country shape until the tooltip names `country`, and returns the
 * tooltip text. (Map shapes carry no names, so this is the user's way in too.)
 */
export async function mapTooltipFor(page, country) {
  return page.evaluate(async name => {
    for (const el of document.querySelectorAll('.rsm-geography')) {
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      await new Promise(r => setTimeout(r, 0))
      const tip = document.querySelector('.map-tooltip')
      if (tip?.querySelector('.map-tooltip-name')?.textContent === name) return tip.innerText
    }
    return null
  }, country)
}
