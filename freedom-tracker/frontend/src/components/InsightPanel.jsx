
// renders the vertical timeline rail on the left side of every tab
// insights is an array of { tone, title, body } objects built per-page
export default function InsightPanel({ insights = [] }) {
  return (
    <aside className="insight-panel">
      <h3 className="insight-panel-title">Key Insights</h3>
      {insights.length === 0 ? (
        <p className="insight-empty">Select a country or view to see insights here.</p>
      ) : (
        <div className="insight-rail">
          {insights.map((item, i) => (
            <div className="insight-item" key={i}>
              <span className={`insight-dot ${item.tone}`} />
              <p className="insight-item-title">{item.title}</p>
              <p className="insight-item-body" dangerouslySetInnerHTML={{ __html: item.body }} />
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}