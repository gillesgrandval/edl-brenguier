import { useEffect } from 'react'
import { Routes, Route, useLocation, Link } from 'react-router-dom'
import { Wifi, WifiOff } from 'lucide-react'
import Accueil from './pages/Accueil'
import Infos from './pages/Infos'
import TableauDeBord from './pages/TableauDeBord'
import Piece from './pages/Piece'
import MiseAJour from './components/MiseAJour'
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
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
          <div className="marque">
            EDL <span>Brenguier</span>
          </div>
        </Link>
        <div className="reseau" aria-live="polite">
          {enLigne ? <Wifi size={18} /> : <WifiOff size={18} />}
          {enLigne ? 'En ligne' : 'Hors ligne'}
        </div>
      </header>

      <main className="contenu">
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/edl/:id" element={<TableauDeBord />} />
          <Route path="/edl/:id/infos" element={<Infos />} />
          <Route path="/edl/:id/piece/:pieceId" element={<Piece />} />
          <Route path="*" element={<Accueil />} />
        </Routes>
      </main>

      <MiseAJour />
    </div>
  )
}
