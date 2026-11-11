import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

// The API is hosted on a free tier that sleeps when idle and can take up to a
// minute to wake. These are the defaults; tests pass shorter values or use a fake clock.
export const WAKE_DEFAULTS = {
  slowAfter: 2000,        // show the "waking the server" message after this long
  timeout: 75000,         // give up and offer Retry after this long
  requestTimeout: 20000,  // abandon a single health check that hangs this long
  retryEvery: 3000        // wait between failed health checks
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Pings /api/health until the server answers.
 * status: 'checking' (first 2 s) → 'waking' (still no answer) → 'ready',
 * or 'timeout' if it never answers. retry() starts again.
 */
export function useServerWake(options = {}) {
  const { slowAfter, timeout, requestTimeout, retryEvery } = { ...WAKE_DEFAULTS, ...options }
  const [attempt, setAttempt] = useState(0)
  // status is stored against the attempt it belongs to, so a new attempt starts
  // at 'checking' without the effect having to reset it
  const [state, setState] = useState({ attempt: 0, status: 'checking' })

  useEffect(() => {
    let finished = false
    let controller = null
    const set = status => setState({ attempt, status })

    const finish = result => {
      if (finished) return
      finished = true
      clearTimeout(slowTimer)
      clearTimeout(deadline)
      controller?.abort()
      set(result)
    }

    const slowTimer = setTimeout(() => set('waking'), slowAfter)
    const deadline = setTimeout(() => finish('timeout'), timeout)

    async function ping() {
      while (!finished) {
        controller = new AbortController()
        const abandon = setTimeout(() => controller.abort(), requestTimeout)
        try {
          await api.health({ signal: controller.signal })
          clearTimeout(abandon)
          finish('ready')
          return
        } catch {
          clearTimeout(abandon)
          if (finished) return
          await sleep(retryEvery)
        }
      }
    }
    ping()

    return () => {
      finished = true
      clearTimeout(slowTimer)
      clearTimeout(deadline)
      controller?.abort()
    }
  }, [attempt, slowAfter, timeout, requestTimeout, retryEvery])

  const retry = useCallback(() => setAttempt(a => a + 1), [])
  const status = state.attempt === attempt ? state.status : 'checking'
  return { status, retry }
}
