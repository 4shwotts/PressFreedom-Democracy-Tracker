// Global setup for the Vitest component tests (jsdom)
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// jsdom has no layout engine, so the browser APIs the app relies on are stubbed:
// matchMedia (phone-width checks) defaults to a desktop-width screen
if (!window.matchMedia) {
  window.matchMedia = query => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  })
}

// ResizeObserver is used by Recharts' ResponsiveContainer
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
