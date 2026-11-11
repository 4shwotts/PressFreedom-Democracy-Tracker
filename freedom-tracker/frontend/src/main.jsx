import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// fonts are bundled and served from this site (SIL Open Font Licence), so no
// visitor data is sent to a font provider. Latin subset, only the weights used.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/states.css'
import './styles/responsive.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
