// User journeys in Chromium against the real API. Every number checked on the
// page is compared with the API's own response, not with a hard-coded value.
import { expect, test } from '@playwright/test'
import { apiGet, mapTooltipFor, openDashboard, openDataTable, openTab, rowCells } from './helpers'

test.describe('Global map', () => {
  test('opens on the latest year with headline figures that match the API', async ({ page, request }) => {
    const meta = await apiGet(request, '/meta')
    await openDashboard(page)
    await expect(page.getByLabel('Year')).toHaveValue(String(meta.yearMax))
    await expect(page.getByText(`${meta.avgDemocracyScore}/10`)).toBeVisible()
    await expect(page.getByText(
      `Average democracy score, ${meta.avgDemocracyYear} (${meta.avgDemocracyCountryCount} countries)`)).toBeVisible()
    await expect(page.locator('.stat-card-value', { hasText: meta.topCountry })).toBeVisible()
  })

  test('colours every country that has data, and only those', async ({ page, request }) => {
    const map = await apiGet(request, '/map')
    await openDashboard(page)
    const coloured = () => page.locator('.rsm-geography').evaluateAll(
      paths => paths.filter(p => p.getAttribute('fill') !== 'var(--color-no-data)').length)
    // a few small countries (e.g. Malta, Singapore) are too small for the 110m map;
    // poll because the shapes can be drawn before the scores arrive
    await expect.poll(coloured).toBeGreaterThan(map.rows.length - 10)
    expect(await coloured()).toBeLessThanOrEqual(map.rows.length)
  })

  test('changing the year updates the map data to that year', async ({ page, request }) => {
    const y2016 = await apiGet(request, '/map?year=2016&metric=DemocracyScore')
    await openDashboard(page)
    await page.getByLabel('Year').fill('2016')
    await expect(page.getByText('Democracy score · 2016')).toBeVisible()
    const table = await openDataTable(page.getByRole('region', { name: 'Global map' }))
    await expect(table).toHaveAccessibleName(/Scores by country, 2016/)
    const norway = y2016.rows.find(r => r.country === 'Norway')
    expect(await rowCells(table, 'Norway')).toEqual(
      ['Norway', String(norway.democracyScore), String(norway.pressFreedomScore), expect.any(String)])
  })

  test('hovering a country shows its scores from the API', async ({ page, request }) => {
    const map = await apiGet(request, '/map')
    const usa = map.rows.find(r => r.country === 'United States')
    await openDashboard(page)
    const tip = await mapTooltipFor(page, 'United States')
    expect(tip).toContain(`Democracy: ${usa.democracyScore} / 10`)
    expect(tip).toContain(`Press freedom: ${usa.pressFreedomScore} / 100`)
  })

  test('switching to press freedom shows the RSF methodology note, and no 2022 changes', async ({ page }) => {
    await openDashboard(page)
    await page.getByLabel('Metric').selectOption('PressFreedomScore')
    await expect(page.getByText(/changed its press freedom methodology in 2022/)).toBeVisible()
    await page.getByLabel('Year').fill('2022')
    await expect(page.getByRole('heading', { name: 'Year-on-year change not shown' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Largest increase' })).toHaveCount(0)
  })
})

test.describe('Country trends', () => {
  test('selecting a country shows its figures and dashboard rank from the API', async ({ page, request }) => {
    const usa = await apiGet(request, '/country/United%20States')
    await openDashboard(page)
    await openTab(page, 'Country Trends', 'Country trends')
    await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('United States')
    await expect(page.getByText(`${usa.latestDemocracy}/10`)).toBeVisible()
    await expect(page.getByText(`${usa.latestPress}/100`)).toBeVisible()
    const r = usa.ranking
    await expect(page.locator('.stat-card-value', { hasText: `${r.democracyRank} of ${r.totalCountries}` })).toBeVisible()
    await expect(page.getByText(`among the ${r.totalCountries} countries in this dashboard with ${r.rankingYear} data`)).toBeVisible()
    // the line chart has a line for each metric
    await expect(page.locator('.recharts-line')).toHaveCount(2)
  })

  test('comparing two countries shows both in the chart and the data table', async ({ page, request }) => {
    const [norway, chad] = await Promise.all([apiGet(request, '/country/Norway'), apiGet(request, '/country/Chad')])
    await openDashboard(page)
    await openTab(page, 'Country Trends', 'Country trends')
    await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('Norway')
    await page.getByRole('combobox', { name: 'Compare with (optional)' }).selectOption('Chad')
    await expect(page.getByText('Chad — democracy (dashed)')).toBeVisible()
    await expect(page.locator('.recharts-line')).toHaveCount(4)

    const table = await openDataTable(page.getByRole('region', { name: 'Country trends' }))
    await expect(table).toHaveAccessibleName('Scores by year: Norway and Chad')
    const year = '2020'
    const n = norway.series.find(s => s.year === 2020)
    const c = chad.series.find(s => s.year === 2020)
    expect(await rowCells(table, year)).toEqual(
      [year, String(n.democracyScore), String(n.pressFreedomScore), String(c.democracyScore), String(c.pressFreedomScore)])
  })

  test('searching filters the countries, with an empty state when nothing matches', async ({ page }) => {
    await openDashboard(page)
    await openTab(page, 'Country Trends', 'Country trends')
    const search = page.getByRole('searchbox', { name: 'Search countries' })
    await search.fill('cote')
    await expect(page.getByRole('combobox', { name: 'Country', exact: true }).getByRole('option', { name: "Cote d'Ivoire" })).toHaveCount(1)
    await search.fill('Atlantis')
    await expect(page.getByText('No countries match “Atlantis”')).toBeVisible()
  })

  test('press freedom changes are split at the 2022 methodology change', async ({ page, request }) => {
    const russia = await apiGet(request, '/country/Russia')
    await openDashboard(page)
    await openTab(page, 'Country Trends', 'Country trends')
    await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('Russia')
    const [before, after] = russia.pressChangePeriods
    await expect(page.getByText(`Press freedom change, ${before.fromYear}–${before.toYear} · ${after.fromYear}–${after.toYear}`)).toBeVisible()
    await expect(page.getByText('RSF method change')).toBeVisible()
  })
})

test.describe('Correlation', () => {
  test('changing the year shows that year’s statistics from the API', async ({ page, request }) => {
    const y2019 = await apiGet(request, '/correlation?year=2019')
    await openDashboard(page)
    await openTab(page, 'Correlation', 'Correlation')
    await page.getByRole('combobox', { name: 'Year' }).selectOption('2019')
    await expect(page.locator('.stat-card-value').first()).toHaveText(String(y2019.pearsonR))
    await expect(page.locator('.stat-card-value').nth(1)).toHaveText(String(y2019.sampleSize))
    await expect(page.locator('.recharts-scatter-symbol')).toHaveCount(y2019.points.length)
    const table = await openDataTable(page.getByRole('region', { name: 'Correlation' }))
    const p = y2019.points[0]
    expect(await rowCells(table, p.country)).toEqual(
      [p.country, String(p.year), String(p.democracyScore), String(p.pressFreedomScore)])
  })

  test('zoom buttons narrow the axes and never zoom out past the full view', async ({ page }) => {
    await openDashboard(page)
    await openTab(page, 'Correlation', 'Correlation')
    const zoomOut = page.getByRole('button', { name: 'Zoom out' }).last()
    await expect(zoomOut).toBeDisabled()
    await page.getByRole('button', { name: 'Zoom in' }).last().click()
    await expect(page.getByText('1.5× zoom')).toBeVisible()
    await zoomOut.click()
    await expect(zoomOut).toBeDisabled()
  })
})

test.describe('Data summary', () => {
  test('the top and bottom 10 tables match the API ranking exactly', async ({ page, request }) => {
    const summary = await apiGet(request, '/summary')
    await openDashboard(page)
    await openTab(page, 'Data Summary', 'Data summary')
    for (const [list, name] of [[summary.top10, /Top 10 by combined score/], [summary.bottom10, /Bottom 10 by combined score/]]) {
      const rows = page.getByRole('table', { name }).getByRole('row')
      await expect(rows).toHaveCount(list.length + 1)
      for (const [i, r] of list.entries()) {
        await expect(rows.nth(i + 1).locator('th, td')).toHaveText(
          [String(r.rank), r.country, String(r.democracyScore), String(r.pressFreedomScore), String(r.combinedScore)])
      }
    }
    await expect(page.getByText(`among the ${summary.rankedCountries} countries in this dashboard`).first()).toBeVisible()
  })

  test('a failed request shows an error with Retry, which recovers', async ({ page }) => {
    let fail = true
    await page.route('**/api/summary', route => (fail
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Internal server error"}' })
      : route.continue()))
    await openDashboard(page)
    await openTab(page, 'Data Summary', 'Data summary')
    await expect(page.getByRole('alert')).toContainText('Internal server error')
    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByRole('table', { name: /Top 10/ })).toBeVisible()
  })
})

test('every chart is drawn at a usable size on a laptop screen', async ({ page }) => {
  // regression: added notes and tables once squeezed the line chart to zero height
  await page.setViewportSize({ width: 1280, height: 720 })
  await openDashboard(page)
  for (const [tab, heading, chart] of [
    ['Global Map', 'Global map', '.map-stage'],
    ['Country Trends', 'Country trends', '.chart-container'],
    ['Correlation', 'Correlation', '.chart-container'],
    ['Data Summary', 'Data summary', '.dist-chart']
  ]) {
    await openTab(page, tab, heading)
    const box = await page.locator(chart).first().boundingBox()
    expect(box?.height, `${tab} chart height`).toBeGreaterThanOrEqual(170)
    // and the data table toggle can still be reached
    await page.locator('details.chart-data summary').first().scrollIntoViewIfNeeded()
    await expect(page.locator('details.chart-data summary').first()).toBeInViewport()
  }
})

test('keyboard users can move between tabs with the arrow keys', async ({ page }) => {
  await openDashboard(page)
  await page.getByRole('tab', { name: 'Global Map' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Country Trends' })).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Country trends', level: 2 })).toBeVisible()
  await page.keyboard.press('End')
  await expect(page.getByRole('heading', { name: 'Data summary', level: 2 })).toBeVisible()
})
