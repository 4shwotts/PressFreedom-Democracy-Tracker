import { useTheme } from '../ThemeContext'
import Logo from './Logo'

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 14h10v7H7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export default function TopBar({ onPrint }) {
  const { theme, toggleTheme } = useTheme()
  const themeLabel = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="topbar-globe"><Logo /></div>
        <div className="topbar-titles">
          <h1>Global Freedom Tracker</h1>
          <p>Democracy &amp; press freedom</p>
        </div>
      </div>
      <div className="topbar-actions">
        <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
        {/* opens the browser's print dialog, which can also save the view as a PDF */}
        <button type="button" className="icon-btn" onClick={onPrint} aria-label="Print or save as PDF" title="Print or save as PDF">
          <PrintIcon />
        </button>
      </div>
    </header>
  )
}
