// The "Key insights" rail on the left of every tab.
// insights is an array of { tone, title, body } built per page in lib/insights.js;
// body is trusted text from that module (figures wrapped in <strong>).
// The coloured dot is decorative — each title says what the insight is about.
export default function InsightPanel({ insights = [] }) {
  return (
    // tabIndex: the panel scrolls on desktop, so keyboard users must be able to focus it
    <aside className="insight-panel" aria-labelledby="insights-title" tabIndex={0}>
      <h2 className="insight-panel-title" id="insights-title">Key insights</h2>
      {insights.length === 0 ? (
        <p className="insight-empty">Insights appear here once the data has loaded.</p>
      ) : (
        <ul className="insight-rail">
          {insights.map(item => (
            <li className="insight-item" key={item.title}>
              <span className={`insight-dot ${item.tone}`} aria-hidden="true" />
              <h3 className="insight-item-title">{item.title}</h3>
              <p className="insight-item-body" dangerouslySetInnerHTML={{ __html: item.body }} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
