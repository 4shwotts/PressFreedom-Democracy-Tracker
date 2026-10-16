import { useCallback, useEffect, useRef, useState } from 'react'

// Zoom + pan for a fixed-size Recharts chart. Zooming works by narrowing the
// axis domains (the chart itself never changes size), and the full data extent
// is the zoomed-out limit — you can't zoom out past the default view or pan
// beyond the edges of the data.

const MAX_ZOOM       = 8    // narrowest view is 1/8 of the full range on each axis
const BUTTON_STEP    = 1.5  // zoom factor per +/- button press
const WHEEL_STEP     = 1.2  // zoom factor per mouse wheel notch
const DRAG_THRESHOLD = 4    // px a pointer must move before it counts as a pan, not a tap

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

const sameView = (a, b) => a.x0 === b.x0 && a.x1 === b.x1 && a.y0 === b.y0 && a.y1 === b.y1

// how many times narrower the current view is than the full extent
export function zoomLevel(view, full) {
  return (full.x1 - full.x0) / (view.x1 - view.x0)
}

// shifts a view of the given size back inside the full extent
function fitInside(x0, y0, w, h, full) {
  x0 = clamp(x0, full.x0, full.x1 - w)
  y0 = clamp(y0, full.y0, full.y1 - h)
  return { x0, x1: x0 + w, y0, y1: y0 + h }
}

// zooms by `factor` (> 1 zooms in) while keeping the data point (ax, ay) at the same
// spot on screen — so pinching or scrolling zooms towards the finger / cursor
function zoomView(view, full, factor, ax, ay) {
  const level = clamp(zoomLevel(view, full) * factor, 1, MAX_ZOOM)
  const w = (full.x1 - full.x0) / level
  const h = (full.y1 - full.y0) / level
  const sx = w / (view.x1 - view.x0)
  const sy = h / (view.y1 - view.y0)
  return fitInside(ax - (ax - view.x0) * sx, ay - (ay - view.y0) * sy, w, h, full)
}

function panView(view, full, dx, dy) {
  return fitInside(view.x0 + dx, view.y0 + dy, view.x1 - view.x0, view.y1 - view.y0, full)
}

/**
 * @param full       full data extent {x0, x1, y0, y1} — also the zoomed-out limit
 * @param resetKey   the view resets to `full` whenever this changes (e.g. the selected year)
 * @returns view, handlers for the zoom buttons, refs to attach, and consumeDrag() —
 *          call it from a click handler to ignore the click that ends a pan
 */
export function useChartZoom(full, resetKey) {
  const [view, setView] = useState(full)
  const viewRef = useRef(view)
  viewRef.current = view

  // the chart's wrapping element (receives the gestures) — a callback ref held in
  // state, so listeners attach whenever the element mounts, even if that's after
  // the first render — and the live axis scales, which the chart reports on each
  // render so pixels can be mapped to data values
  const [el, containerRef] = useState(null)
  const scalesRef = useRef(null)
  const draggedRef = useRef(false)

  useEffect(() => { setView(full) }, [resetKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const centre = v => [(v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2]

  const zoomIn  = useCallback(() => setView(v => zoomView(v, full, BUTTON_STEP, ...centre(v))), [full])
  const zoomOut = useCallback(() => setView(v => zoomView(v, full, 1 / BUTTON_STEP, ...centre(v))), [full])
  const reset   = useCallback(() => setView(full), [full])

  const consumeDrag = useCallback(() => {
    const dragged = draggedRef.current
    draggedRef.current = false
    return dragged
  }, [])

  useEffect(() => {
    if (!el) return

    // client (screen) coordinates → data coordinates, via the chart's axis scales
    const toData = (clientX, clientY) => {
      const s = scalesRef.current
      if (!s) return centre(viewRef.current)
      const r = el.getBoundingClientRect()
      return [s.x.invert(clientX - r.left), s.y.invert(clientY - r.top)]
    }

    // size of the plot area in px, read from the scales' pixel ranges
    const plotSize = () => {
      const s = scalesRef.current
      if (!s) return null
      const [xa, xb] = s.x.range()
      const [ya, yb] = s.y.range()
      return { width: Math.abs(xb - xa), height: Math.abs(yb - ya) }
    }

    const pointers = new Map()
    let gesture = null

    const startDrag = (x, y, moved) => ({ type: 'drag', sx: x, sy: y, start: viewRef.current, moved })

    const onDown = e => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 1) {
        draggedRef.current = false
        gesture = startDrag(e.clientX, e.clientY, false)
      } else if (pointers.size === 2) {
        // two fingers down: pinch, anchored on the data point between them
        const [a, b] = [...pointers.values()]
        gesture = {
          type: 'pinch',
          dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          start: viewRef.current,
          anchor: toData((a.x + b.x) / 2, (a.y + b.y) / 2)
        }
        draggedRef.current = true
      }
    }

    const onMove = e => {
      if (!pointers.has(e.pointerId) || !gesture) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (gesture.type === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const factor = Math.hypot(a.x - b.x, a.y - b.y) / gesture.dist
        setView(zoomView(gesture.start, full, factor, ...gesture.anchor))
        return
      }

      if (gesture.type === 'drag') {
        const dx = e.clientX - gesture.sx
        const dy = e.clientY - gesture.sy
        if (!gesture.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        if (zoomLevel(gesture.start, full) <= 1) return // nothing to pan at the full view
        const size = plotSize()
        if (!size) return
        if (!gesture.moved) {
          // capture only once a pan has really started (a plain tap must still reach
          // the dot), so the drag keeps tracking after the pointer leaves the chart
          try { el.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
        }
        gesture.moved = true
        draggedRef.current = true
        const v = gesture.start
        // dragging right reveals lower x values; dragging down reveals higher y values
        setView(panView(v, full,
          -dx * (v.x1 - v.x0) / size.width,
          dy * (v.y1 - v.y0) / size.height))
      }
    }

    const onUp = e => {
      pointers.delete(e.pointerId)
      if (pointers.size === 1) {
        // one finger lifted mid-pinch: carry on as a pan from the remaining finger
        const [p] = [...pointers.values()]
        gesture = startDrag(p.x, p.y, true)
      } else if (pointers.size === 0) {
        gesture = null
      }
    }

    const onWheel = e => {
      const v = viewRef.current
      const next = zoomView(v, full, e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, ...toData(e.clientX, e.clientY))
      // already at a zoom limit: leave the event alone so the page can scroll
      if (sameView(next, v)) return
      e.preventDefault()
      setView(next)
    }

    // stops iOS Safari zooming the whole page when pinching over the chart
    const onGesture = e => e.preventDefault()

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false }) // passive: false so preventDefault works
    el.addEventListener('gesturestart', onGesture)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGesture)
    }
  }, [el, full]) // eslint-disable-line react-hooks/exhaustive-deps

  const level = zoomLevel(view, full)

  return {
    view,
    zoomLevel: level,
    isZoomed: level > 1.0001,
    canZoomIn: level < MAX_ZOOM - 0.0001,
    zoomIn,
    zoomOut,
    reset,
    consumeDrag,
    containerRef,
    scalesRef
  }
}
