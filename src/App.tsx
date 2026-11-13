import { Routes, Route } from 'react-router-dom'
import { Wifi, WifiOff } from 'lucide-react'
import Accueil from './pages/Accueil'
import MiseAJour from './components/MiseAJour'
import { useEnLigne } from './hooks/useEnLigne'

export default function App() {
  const enLigne = useEnLigne()

  return (
    <div className="app">
      <header className="entete">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
        <div className="marque">
          EDL <span>Brenguier</span>
        </div>
        <div className="reseau" aria-live="polite">
          {enLigne ? <Wifi size={18} /> : <WifiOff size={18} />}
          {enLigne ? 'En ligne' : 'Hors ligne'}
        </div>
      </header>

      <main className="contenu">
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="*" element={<Accueil />} />
        </Routes>
      </main>

      <MiseAJour />
    </div>
  )
}
