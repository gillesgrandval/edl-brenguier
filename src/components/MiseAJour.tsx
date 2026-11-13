import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

/**
 * Enregistre le « service worker » (le moteur hors ligne) et affiche
 * un bandeau quand une nouvelle version de l'application est disponible.
 * La mise à jour n'est jamais forcée : elle s'applique quand l'utilisateur le décide,
 * pour ne jamais interrompre un état des lieux en cours.
 */
export default function MiseAJour() {
  const {
    needRefresh: [miseAJourDispo, setMiseAJourDispo],
    offlineReady: [horsLignePret, setHorsLignePret],
    updateServiceWorker,
  } = useRegisterSW()

  if (miseAJourDispo) {
    return (
      <div className="bandeau-maj" role="status">
        <p>Une nouvelle version de l'application est disponible.</p>
        <button className="bouton bouton-discret" style={{ color: '#fff' }} onClick={() => setMiseAJourDispo(false)}>
          Plus tard
        </button>
        <button className="bouton bouton-accent" onClick={() => updateServiceWorker(true)}>
          <RefreshCw size={18} /> Mettre à jour
        </button>
      </div>
    )
  }

  if (horsLignePret) {
    return (
      <div className="bandeau-maj" role="status">
        <p>L'application est prête à fonctionner sans connexion.</p>
        <button className="bouton bouton-accent" onClick={() => setHorsLignePret(false)}>
          OK
        </button>
      </div>
    )
  }

  return null
}
