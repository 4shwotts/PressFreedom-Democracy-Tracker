import { useEffect, useState } from 'react'
import { ThemeProvider } from './ThemeContext'
import TopBar from './components/TopBar'
import TabNav from './components/TabNav'
import GlobalMapPage from './pages/GlobalMapPage'
import CountryTrendsPage from './pages/CountryTrendsPage'
import CorrelationPage from './pages/CorrelationPage'
import DataSummaryPage from './pages/DataSummaryPage'
import { api } from './api'

function AppShell() {
  const [activeTab, setActiveTab] = useState('map')
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    api.getMeta().then(setMeta).catch(() => {})
  }, [])

  function handleExport() {
    window.print()
  }

  return (
    <div className="app">
      <TopBar onExport={handleExport} />
      <TabNav active={activeTab} onChange={setActiveTab} />
      <main className="page">
        {activeTab === 'map' && <GlobalMapPage meta={meta} />}
        {activeTab === 'trends' && <CountryTrendsPage meta={meta} />}
        {activeTab === 'correlation' && <CorrelationPage meta={meta} />}
        {activeTab === 'summary' && <DataSummaryPage meta={meta} />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}
