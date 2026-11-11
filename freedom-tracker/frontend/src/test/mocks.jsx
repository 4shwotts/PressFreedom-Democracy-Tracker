// Shared module mocks for component tests.
// Charts and the map can't lay out in jsdom (no real sizes), so tests swap them
// for light stand-ins and check the app's own logic and text instead. The real
// charts are covered by the Playwright browser tests.
import { cloneElement } from 'react'

// Recharts: ResponsiveContainer measures its parent, which is always 0×0 in
// jsdom — give its chart a fixed size instead so the chart still renders
export async function rechartsMock(importOriginal) {
  const actual = await importOriginal()
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: 800, height: 400 }}>{cloneElement(children, { width: 800, height: 400 })}</div>
    )
  }
}

// react-simple-maps: fetches map shapes and draws SVG paths — replaced by an
// empty map so the page around it can be tested
export function simpleMapsMock() {
  return {
    ComposableMap: ({ children }) => <div data-testid="map">{children}</div>,
    ZoomableGroup: ({ children }) => <div>{children}</div>,
    Geographies: ({ children }) => <div>{children({ geographies: [] })}</div>,
    Geography: () => null
  }
}

// a promise the test resolves by hand — used to make API responses arrive out of order
export function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
