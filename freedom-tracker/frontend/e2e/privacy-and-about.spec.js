// Privacy (no third-party requests) and the about-the-data page, in Chromium.
import { expect, test } from '@playwright/test'
import { openDashboard, openTab } from './helpers'

test('no request leaves this site: fonts, map shapes and data are all self-hosted', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin
  const requests = []
  page.on('request', r => requests.push(r.url()))

  await openDashboard(page)
  for (const [tab, heading] of [['Country Trends', 'Country trends'], ['Correlation', 'Correlation'], ['Data Summary', 'Data summary']]) {
    await openTab(page, tab, heading)
    await page.waitForLoadState('networkidle')
  }
  await page.getByRole('link', { name: 'About the data' }).click()
  await expect(page.getByRole('heading', { name: 'About the data', level: 2 })).toBeVisible()

  const elsewhere = requests.filter(u => !u.startsWith('data:') && new URL(u).origin !== origin)
  expect(elsewhere).toEqual([])
  // and the fonts really were loaded — from this site
  const fonts = requests.filter(u => u.endsWith('.woff2'))
  expect(fonts.length).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.fonts.check('16px Inter'))).toBe(true)
})

test('nothing is stored on the visitor’s device: no cookies and no browser storage', async ({ page, context }) => {
  // matches the privacy note in the footer and on the about-the-data page
  await openDashboard(page)
  for (const [tab, heading] of [['Country Trends', 'Country trends'], ['Correlation', 'Correlation'], ['Data Summary', 'Data summary']]) {
    await openTab(page, tab, heading)
  }
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.getByRole('link', { name: 'About the data' }).click()
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible()

  expect(await context.cookies()).toEqual([])
  expect(await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    indexedDB: (await indexedDB.databases()).length,
    documentCookie: document.cookie
  }))).toEqual({ local: 0, session: 0, indexedDB: 0, documentCookie: '' })
})

test('/about-the-data loads directly, with credits, the disclaimer and a way back', async ({ page }) => {
  await page.goto('/about-the-data')
  await expect(page.getByRole('heading', { name: 'About the data', level: 2 })).toBeVisible()
  await expect(page).toHaveTitle(/^About the data/)
  await expect(page.getByRole('heading', { name: 'Known gaps in the data' })).toBeVisible()
  const footer = page.getByRole('contentinfo')
  await expect(footer.getByRole('link', { name: 'Democracy Index © Economist Intelligence Unit' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'World Press Freedom Index © Reporters Without Borders (RSF)' })).toBeVisible()
  await expect(footer).toContainText('Not affiliated with or endorsed by')

  await page.getByRole('link', { name: '← Back to the dashboard' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Global map' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'About the data', level: 2 })).toBeVisible()
})

test('the footer credits stay visible on the dashboard', async ({ page }) => {
  await openDashboard(page)
  const footer = page.getByRole('contentinfo')
  await expect(footer).toBeInViewport()
  await expect(footer.getByRole('link', { name: 'About the data' })).toBeVisible()
})
