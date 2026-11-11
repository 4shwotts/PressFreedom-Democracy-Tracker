import { useCallback, useEffect, useState } from 'react'

/**
 * Loads data from the API and tracks its loading and error state.
 *
 * `load` is called again whenever `deps` change (deps must be plain values such
 * as strings and numbers). A response that arrives after the deps have changed
 * again is ignored, so a slow, older request can never overwrite a newer one
 * (e.g. dragging the year slider quickly). Pass `enabled: false` to wait, e.g.
 * until a country has been chosen.
 *
 * Returns { data, error, loading, retry }. `data` keeps the last good result
 * while a new request is loading, so charts don't flash empty between years.
 */
export function useApi(load, deps, { enabled = true } = {}) {
  const [attempt, setAttempt] = useState(0)
  // identifies the current request; loading and error are worked out from it
  // rather than set at the start of the effect
  const key = JSON.stringify([...deps, attempt])
  const [result, setResult] = useState({ key: null, data: null, error: null })

  useEffect(() => {
    if (!enabled) return undefined
    let stale = false
    load()
      .then(data => { if (!stale) setResult({ key, data, error: null }) })
      .catch(error => { if (!stale) setResult(r => ({ key, data: r.data, error })) })
    return () => { stale = true }
  }, [key, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => setAttempt(a => a + 1), [])
  const current = result.key === key
  return {
    data: result.data,
    error: current ? result.error : null,
    loading: enabled && !current,
    retry
  }
}
