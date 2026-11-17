import { useEffect } from 'react'
import { Routes, Route, useLocation, Link, NavLink } from 'react-router-dom'
import { Building2, CircleHelp, ClipboardList, Settings, Wifi, WifiOff } from 'lucide-react'
import Accueil from './pages/Accueil'
import Infos from './pages/Infos'
import TableauDeBord from './pages/TableauDeBord'
import Piece from './pages/Piece'
import Signature from './pages/Signature'
import ChoixBien from './pages/ChoixBien'
import Patrimoine from './pages/Patrimoine'
import FicheBien from './pages/FicheBien'
import ImportExcel from './pages/ImportExcel'
import Comparatif from './pages/Comparatif'
import Parametres from './pages/Parametres'
import Aide from './pages/Aide'
import { Cles, Compteurs, Detecteur, Observations } from './pages/Rubriques'
import MiseAJour from './components/MiseAJour'
import logoSignatureBlanc from './assets/charte/logo-signature-blanc.png'
import { useEnLigne } from './hooks/useEnLigne'

export default function App() {
  const enLigne = useEnLigne()
  const { pathname } = useLocation()

  // Revenir en haut de l'écran à chaque changement de page.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="app">
      <header className="entete">
        <Link to="/" className="entete-accueil" aria-label="Accueil">
          <img className="entete-logo" src={logoSignatureBlanc} alt="Groupe Brenguier" />
        </Link>
        <nav className="entete-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive || pathname.startsWith('/edl') || pathname === '/nouveau' ? 'actif' : '')}>
            <ClipboardList size={18} /> <span>États des lieux</span>
          </NavLink>
          <NavLink to="/patrimoine" className={({ isActive }) => (isActive ? 'actif' : '')}>
            <Building2 size={18} /> <span>Patrimoine</span>
          </NavLink>
          <NavLink to="/parametres" className={({ isActive }) => (isActive ? 'actif' : '')} aria-label="Paramètres">
            <Settings size={18} />
          </NavLink>
          <NavLink to="/aide" className={({ isActive }) => (isActive ? 'actif' : '')} aria-label="Aide">
            <CircleHelp size={18} />
          </NavLink>
        </nav>
        <div className="reseau" aria-live="polite">
          {enLigne ? <Wifi size={18} /> : <WifiOff size={18} />}
          {enLigne ? 'En ligne' : 'Hors ligne'}
        </div>
      </header>

      <main className="contenu">
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/nouveau" element={<ChoixBien />} />
          <Route path="/parametres" element={<Parametres />} />
          <Route path="/aide" element={<Aide />} />
          <Route path="/patrimoine" element={<Patrimoine />} />
          <Route path="/patrimoine/import" element={<ImportExcel />} />
          <Route path="/patrimoine/:id" element={<FicheBien />} />
          <Route path="/edl/:id" element={<TableauDeBord />} />
          <Route path="/edl/:id/infos" element={<Infos />} />
          <Route path="/edl/:id/piece/:pieceId" element={<Piece />} />
          <Route path="/edl/:id/compteurs" element={<Compteurs />} />
          <Route path="/edl/:id/cles" element={<Cles />} />
          <Route path="/edl/:id/detecteur" element={<Detecteur />} />
          <Route path="/edl/:id/observations" element={<Observations />} />
          <Route path="/edl/:id/signature" element={<Signature />} />
          <Route path="/edl/:id/comparatif" element={<Comparatif />} />
          <Route path="*" element={<Accueil />} />
        </Routes>
      </main>

      <MiseAJour />
    </div>
  )
}
