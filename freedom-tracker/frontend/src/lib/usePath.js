import { useCallback, useEffect, useState } from 'react'

// A minimal client-side router: the site has two pages (the dashboard at / and
// /about-the-data), which doesn't justify a routing library. Links update the
// address bar with history.pushState, and the back/forward buttons work.

export const ABOUT_PATH = '/about-the-data'

export function usePath() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback(to => {
    if (to !== window.location.pathname) window.history.pushState({}, '', to)
    setPath(to)
    window.scrollTo(0, 0)
  }, [])

  return { path, navigate }
}

/**
 * An ordinary link that navigates without reloading the page. Modified clicks
 * (new tab, etc.) are left to the browser.
 */
export function onInternalLink(navigate, to) {
  return e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
}
