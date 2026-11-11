// Loading, error and empty states shared by every page and chart.
// Renders nothing when there's data to show.
export default function StatusMessage({ loading, error, onRetry, empty, emptyText, loadingText = 'Loading…' }) {
  if (error) {
    return (
      <div className="status-message status-error" role="alert">
        <p>Couldn’t load this data. {error.message}</p>
        {onRetry && <button type="button" className="button-secondary" onClick={onRetry}>Retry</button>}
      </div>
    )
  }
  if (loading) {
    return <div className="status-message" role="status">{loadingText}</div>
  }
  if (empty) {
    return <div className="status-message" role="status">{emptyText}</div>
  }
  return null
}
