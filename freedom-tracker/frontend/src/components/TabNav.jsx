const TABS = [
  { id: 'map', label: 'Global Map' },
  { id: 'trends', label: 'Country Trends' },
  { id: 'correlation', label: 'Correlation' },
  { id: 'summary', label: 'Data Summary' }
]

export default function TabNav({ active, onChange }) {
  return (
    <nav className="tabnav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`tabnav-item ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

export { TABS }
