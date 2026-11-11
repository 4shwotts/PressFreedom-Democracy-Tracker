// Browser tests against the production build and the real Flask API.
// Playwright starts both servers itself (see webServer below).
import { defineConfig, devices } from '@playwright/test'

// the backend's Python: the project's .venv locally, or whatever `python` is on
// the PATH in CI (set PYTHON to override)
const python = process.env.PYTHON ??
  (process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : '.venv/bin/python')

const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // in CI: failures are annotated on the pull request, and a JUnit file is kept
  // alongside the HTML report as an artifact
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }],
       ['junit', { outputFile: 'playwright-report/junit.xml' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    // journeys, accessibility and the sleeping-server checks run in Chromium;
    // the phone and tablet checks run in both Chromium and WebKit (Safari's engine)
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: /responsive\.spec\.js/ }
  ],
  webServer: [
    {
      command: `${python} app.py`,
      cwd: '../backend',
      url: 'http://127.0.0.1:5000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000
    },
    {
      command: `npm run build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
})
