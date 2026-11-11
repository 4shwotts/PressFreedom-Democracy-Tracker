import { useServerWake } from '../lib/useServerWake'

// Holds back the dashboard until the API has answered a health check, explaining
// the wait if the server is asleep and offering Retry if it never answers —
// instead of a blank page or charts that silently fail to load.
export default function WakeGate({ children, options }) {
  const { status, retry } = useServerWake(options)

  if (status === 'ready') return children

  return (
    <div className="wake-panel" role="status" aria-live="polite">
      {status === 'checking' && <p className="wake-text">Loading…</p>}

      {status === 'waking' && (
        <>
          <span className="wake-spinner" aria-hidden="true" />
          <p className="wake-title">Waking the server — this can take up to a minute</p>
          <p className="wake-text">
            The data is served from a free hosting plan that sleeps when nobody has visited for a while.
          </p>
        </>
      )}

      {status === 'timeout' && (
        <>
          <p className="wake-title">The server didn’t respond</p>
          <p className="wake-text">It may still be starting up, or it may be offline. Please try again.</p>
          <button type="button" className="button-primary" onClick={retry}>Retry</button>
        </>
      )}
    </div>
  )
}
