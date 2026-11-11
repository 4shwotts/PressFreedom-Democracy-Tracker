// short labels are shown on phone-width screens (see responsive.css) so all
// four tabs fit in one row without the last one being cut off
export const TABS = [
  { id: 'map', label: 'Global Map', short: 'Map' },
  { id: 'trends', label: 'Country Trends', short: 'Trends' },
  { id: 'correlation', label: 'Correlation', short: 'Correlation' },
  { id: 'summary', label: 'Data Summary', short: 'Summary' }
]

export const tabId = id => `tab-${id}`
export const panelId = id => `panel-${id}`

// WAI-ARIA tabs: one tab stop for the whole list, arrow keys move between tabs
// and Home/End jump to the first/last
export default function TabNav({ active, onChange }) {
  function onKeyDown(e) {
    const i = TABS.findIndex(t => t.id === active)
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const tab = TABS[(next + TABS.length) % TABS.length]
    onChange(tab.id)
    document.getElementById(tabId(tab.id))?.focus()
  }

  return (
    <nav className="tabnav" aria-label="Dashboard views">
      <div role="tablist" aria-label="Dashboard views" className="tablist">
        {TABS.map(tab => {
          const selected = active === tab.id
          return (
            <button
              key={tab.id}
              id={tabId(tab.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              // only the selected tab's panel is in the page, so only it is referenced
              aria-controls={selected ? panelId(tab.id) : undefined}
              aria-label={tab.label}
              tabIndex={selected ? 0 : -1}
              className={`tabnav-item ${selected ? 'active' : ''}`}
              onClick={() => onChange(tab.id)}
              onKeyDown={onKeyDown}
            >
              <span className="tabnav-label-full">{tab.label}</span>
              <span className="tabnav-label-short" aria-hidden="true">{tab.short}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
