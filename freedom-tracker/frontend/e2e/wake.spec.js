// The sleeping-server experience in a real browser, with Playwright's fake clock:
// the health check is held back to imitate a server that's asleep.
import { expect, test } from '@playwright/test'

const WAKING = 'Waking the server — this can take up to a minute'

test('a sleeping server: message after 2 seconds, then the dashboard once it answers', async ({ page }) => {
  let wake
  const awake = new Promise(resolve => { wake = resolve })
  await page.route('**/api/health', async route => { await awake; await route.continue() })
  await page.clock.install()
  await page.goto('/')

  await page.clock.runFor(1500)
  await expect(page.getByText(WAKING)).toHaveCount(0)
  await page.clock.runFor(600)
  await expect(page.getByText(WAKING)).toBeVisible()

  wake()
  await page.clock.runFor(100)
  await expect(page.getByRole('heading', { name: 'Global map' })).toBeVisible()
})

test('a server that never answers: friendly Retry, which recovers once it is up', async ({ page }) => {
  let down = true
  await page.route('**/api/health', route => (down ? route.abort('connectionrefused') : route.continue()))
  await page.clock.install()
  await page.goto('/')

  await page.clock.runFor(80_000)
  await expect(page.getByText('The server didn’t respond')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Global map' })).toHaveCount(0)

  down = false
  await page.getByRole('button', { name: 'Retry' }).click()
  await page.clock.runFor(100)
  await expect(page.getByRole('heading', { name: 'Global map' })).toBeVisible()
})

test('an awake server shows the dashboard with no waking message', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Global map' })).toBeVisible()
  await expect(page.getByText(WAKING)).toHaveCount(0)
})
