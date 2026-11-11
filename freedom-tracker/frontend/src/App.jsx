import { useEffect, useState } from 'react'
import { ThemeProvider } from './ThemeContext'
import TopBar from './components/TopBar'
import TabNav, { panelId, tabId } from './components/TabNav'
import WakeGate from './components/WakeGate'
import StatusMessage from './components/StatusMessage'
import Footer from './components/Footer'
import GlobalMapPage from './pages/GlobalMapPage'
import CountryTrendsPage from './pages/CountryTrendsPage'
import CorrelationPage from './pages/CorrelationPage'
import DataSummaryPage from './pages/DataSummaryPage'
import AboutPage from './pages/AboutPage'
import { api } from './api'
import { useApi } from './lib/useApi'
import { ABOUT_PATH, usePath } from './lib/usePath'

const PAGES = {
  map: GlobalMapPage,
  trends: CountryTrendsPage,
  correlation: CorrelationPage,
  summary: DataSummaryPage
}

const SITE_TITLE = 'Global Freedom Tracker — Democracy & Press Freedom'

// rendered once the server has answered a health check (see WakeGate)
function Dashboard({ activeTab }) {
  const { data: meta, error, loading, retry } = useApi(() => api.getMeta(), [])
  if (!meta) {
    return <StatusMessage loading={loading} error={error} onRetry={retry} loadingText="Loading the dashboard…" />
  }
  const Page = PAGES[activeTab]
  return <Page meta={meta} />
}

export function AppShell({ wakeOptions }) {
  const [activeTab, setActiveTab] = useState('map')
  const { path, navigate } = usePath()
  const onAbout = path === ABOUT_PATH

  // keep the browser tab's title in step with the page
  useEffect(() => {
    document.title = onAbout ? `About the data — ${SITE_TITLE}` : SITE_TITLE
  }, [onAbout])

  return (
    <div className={`app ${onAbout ? 'app-about' : ''}`}>
      <a className="skip-link" href="#main">{onAbout ? 'Skip to the content' : 'Skip to the dashboard'}</a>
      <TopBar onPrint={() => window.print()} />
      {onAbout ? (
        // static text: shown straight away, without waiting for the server to wake
        <main id="main" className="page page-about" tabIndex={-1}>
          <AboutPage navigate={navigate} />
        </main>
      ) : (
        <>
          <TabNav active={activeTab} onChange={setActiveTab} />
          <main id="main" className="page" tabIndex={-1}>
            <div className="tabpanel" role="tabpanel" id={panelId(activeTab)} aria-labelledby={tabId(activeTab)}>
              <WakeGate options={wakeOptions}>
                <Dashboard activeTab={activeTab} />
              </WakeGate>
            </div>
          </main>
        </>
      )}
      <Footer navigate={navigate} />
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
