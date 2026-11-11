// Zoom and pan maths for the correlation chart. The chart never changes size:
// zooming narrows the axis ranges, and the full data extent is the zoomed-out limit.
import { describe, expect, it } from 'vitest'
import { useLayoutEffect } from 'react'
import { act, render } from '@testing-library/react'
import { useChartZoom, zoomLevel } from './useChartZoom'

const FULL = { x0: 0, x1: 10, y0: 0, y1: 100 }

// fake axis scales for a 500×400 plot area starting at the element's top-left
const scales = view => ({
  x: Object.assign(v => ((v - view.x0) / (view.x1 - view.x0)) * 500, {
    invert: px => view.x0 + (px / 500) * (view.x1 - view.x0), range: () => [0, 500]
  }),
  y: Object.assign(v => 400 - ((v - view.y0) / (view.y1 - view.y0)) * 400, {
    invert: py => view.y0 + ((400 - py) / 400) * (view.y1 - view.y0), range: () => [400, 0]
  })
})

// renders a 500×400 div wired to the hook and returns the hook's latest state
function setup(resetKey = 'a') {
  const result = { current: null }
  function Harness({ k }) {
    const zoom = useChartZoom(FULL, k)
    // reports scales after each render, as the chart does
    useLayoutEffect(() => zoom.reportScales(scales(zoom.view)))
    useLayoutEffect(() => { result.current = zoom })
    return <div data-testid="chart" ref={zoom.containerRef} />
  }
  const utils = render(<Harness k={resetKey} />)
  const el = utils.getByTestId('chart')
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 400, right: 500, bottom: 400 })
  return { result, el, rerender: k => utils.rerender(<Harness k={k} />) }
}

const pointer = (el, type, x, y, id = 1) => act(() => {
  const e = new Event(type, { bubbles: true })
  Object.assign(e, { clientX: x, clientY: y, pointerId: id })
  el.dispatchEvent(e)
})

const wheel = (el, deltaY, x = 250, y = 200) => {
  const e = new WheelEvent('wheel', { deltaY, clientX: x, clientY: y, bubbles: true, cancelable: true })
  act(() => { el.dispatchEvent(e) })
  return e
}

describe('zoom level', () => {
  it('is how many times narrower the view is than the full range', () => {
    expect(zoomLevel(FULL, FULL)).toBe(1)
    expect(zoomLevel({ x0: 2, x1: 7, y0: 0, y1: 50 }, FULL)).toBe(2)
  })
})

describe('zoom buttons', () => {
  it('start at the full view, unable to zoom out', () => {
    const { result } = setup()
    expect(result.current.view).toEqual(FULL)
    expect(result.current.isZoomed).toBe(false)
    expect(result.current.canZoomIn).toBe(true)
  })

  it('zoom in by 1.5× around the centre', () => {
    const { result } = setup()
    act(() => result.current.zoomIn())
    const v = result.current.view
    expect(result.current.zoomLevel).toBeCloseTo(1.5)
    expect((v.x0 + v.x1) / 2).toBeCloseTo(5)
    expect((v.y0 + v.y1) / 2).toBeCloseTo(50)
  })

  it('never zoom out past the full view', () => {
    const { result } = setup()
    act(() => result.current.zoomIn())
    act(() => { result.current.zoomOut(); result.current.zoomOut(); result.current.zoomOut() })
    expect(result.current.view).toEqual(FULL)
  })

  it('stop at 8× zoom', () => {
    const { result } = setup()
    act(() => { for (let i = 0; i < 20; i++) result.current.zoomIn() })
    expect(result.current.zoomLevel).toBeCloseTo(8)
    expect(result.current.canZoomIn).toBe(false)
  })

  it('reset returns to the full view, as does changing the reset key (the year)', () => {
    const { result, rerender } = setup('2019')
    act(() => result.current.zoomIn())
    act(() => result.current.reset())
    expect(result.current.view).toEqual(FULL)
    act(() => result.current.zoomIn())
    rerender('2020')
    expect(result.current.view).toEqual(FULL)
  })
})

describe('mouse wheel', () => {
  it('zooms in towards the cursor, keeping the point under it in place', () => {
    const { result, el } = setup()
    const e = wheel(el, -100, 400, 100)   // data point (8, 75)
    expect(e.defaultPrevented).toBe(true)
    const v = result.current.view
    expect(v.x0 + (400 / 500) * (v.x1 - v.x0)).toBeCloseTo(8)
    expect(v.y0 + ((400 - 100) / 400) * (v.y1 - v.y0)).toBeCloseTo(75)
  })

  it('at the full view, scrolling out is left to the page', () => {
    const { result, el } = setup()
    const e = wheel(el, 100)
    expect(e.defaultPrevented).toBe(false)
    expect(result.current.view).toEqual(FULL)
  })
})

describe('dragging to pan', () => {
  it('does nothing at the full view', () => {
    const { result, el } = setup()
    pointer(el, 'pointerdown', 250, 200)
    pointer(el, 'pointermove', 100, 300)
    pointer(el, 'pointerup', 100, 300)
    expect(result.current.view).toEqual(FULL)
  })

  it('pans when zoomed in, and the click that ends a pan is consumed', () => {
    const { result, el } = setup()
    act(() => result.current.zoomIn())
    const before = result.current.view
    pointer(el, 'pointerdown', 250, 200)
    pointer(el, 'pointermove', 200, 200)  // drag left 50px → view moves right
    pointer(el, 'pointerup', 200, 200)
    expect(result.current.view.x0).toBeGreaterThan(before.x0)
    expect(result.current.consumeDrag()).toBe(true)
    expect(result.current.consumeDrag()).toBe(false)
  })

  it('a tiny movement is a tap, not a pan', () => {
    const { result, el } = setup()
    act(() => result.current.zoomIn())
    const before = result.current.view
    pointer(el, 'pointerdown', 250, 200)
    pointer(el, 'pointermove', 252, 201)
    pointer(el, 'pointerup', 252, 201)
    expect(result.current.view).toEqual(before)
    expect(result.current.consumeDrag()).toBe(false)
  })

  it('never pans beyond the edges of the data', () => {
    const { result, el } = setup()
    act(() => result.current.zoomIn())
    pointer(el, 'pointerdown', 250, 200)
    pointer(el, 'pointermove', 5000, -5000)   // far right and up → lowest x, lowest y
    pointer(el, 'pointerup', 5000, -5000)
    const v = result.current.view
    expect(v.x0).toBe(0)
    expect(v.y0).toBe(0)
  })
})

describe('pinch', () => {
  it('two fingers moving apart zoom in; moving together never goes past the full view', () => {
    const { result, el } = setup()
    pointer(el, 'pointerdown', 200, 200, 1)
    pointer(el, 'pointerdown', 300, 200, 2)
    pointer(el, 'pointermove', 100, 200, 1)
    pointer(el, 'pointermove', 400, 200, 2)   // 100px → 300px apart: 3× zoom
    expect(result.current.zoomLevel).toBeCloseTo(3)
    pointer(el, 'pointermove', 245, 200, 1)
    pointer(el, 'pointermove', 255, 200, 2)   // squeezed together
    expect(result.current.view).toEqual(FULL)
    pointer(el, 'pointerup', 245, 200, 1)
    pointer(el, 'pointerup', 255, 200, 2)
  })
})
