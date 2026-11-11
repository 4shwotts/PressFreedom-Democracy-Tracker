import { useEffect, useState } from 'react'

// phone-width breakpoint — matches the 600px block in responsive.css
export const NARROW_QUERY = '(max-width: 600px)'

export const isNarrowNow = () => window.matchMedia(NARROW_QUERY).matches

/** Whether the viewport is phone-width; updates on rotate/resize. */
export function useIsNarrow() {
  const [narrow, setNarrow] = useState(isNarrowNow)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const onChange = e => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}
