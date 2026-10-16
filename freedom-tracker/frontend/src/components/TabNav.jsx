// short labels are shown on phone-width screens (see responsive.css) so all
// four tabs fit in one row without the last one being cut off
const TABS = [
  { id: 'map', label: 'Global Map', short: 'Map' },
  { id: 'trends', label: 'Country Trends', short: 'Trends' },
  { id: 'correlation', label: 'Correlation', short: 'Correlation' },
  { id: 'summary', label: 'Data Summary', short: 'Summary' }
]

export default function TabNav({ active, onChange }) {
  return (
    <nav className="tabnav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`tabnav-item ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
          aria-label={tab.label}
        >
          <span className="tabnav-label-full">{tab.label}</span>
          <span className="tabnav-label-short" aria-hidden="true">{tab.short}</span>
        </button>
      ))}
    </nav>
  )
}

export { TABS }
