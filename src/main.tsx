import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './styles/theme.css'
import App from './App'
import { installerPatrimoineIntegre } from './db/patrimoine'

// Biens du patrimoine intégrés à l'application (et visites déjà prévues).
void installerPatrimoineIntegre()

// HashRouter : les adresses internes ressemblent à « …/edl-brenguier/#/edl/12 ».
// Indispensable sur GitHub Pages, qui ne sait pas servir les sous-pages d'une application.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
