import { useEffect, useState } from 'react'
import { Plus, HardDrive, ShieldCheck, CloudOff, Info } from 'lucide-react'

/** Formate un nombre d'octets en Mo / Go lisibles. */
function taille(octets?: number): string {
  if (octets === undefined) return '—'
  if (octets > 1e9) return `${(octets / 1e9).toFixed(1).replace('.', ',')} Go`
  return `${Math.round(octets / 1e6)} Mo`
}

type Diagnostic = {
  utilise?: number
  disponible?: number
  persistant?: boolean
  horsLigne: boolean
}

/**
 * Accueil — version « étape 0 ».
 * Pour l'instant, il vérifie que la tablette offre tout ce dont l'application a besoin.
 * La liste des états des lieux arrivera à l'étape 1.
 */
export default function Accueil() {
  const [diag, setDiag] = useState<Diagnostic>({ horsLigne: false })

  useEffect(() => {
    ;(async () => {
      const estimation = await navigator.storage?.estimate?.()
      const persistant = await navigator.storage?.persisted?.()
      setDiag({
        utilise: estimation?.usage,
        disponible: estimation?.quota,
        persistant,
        horsLigne: 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
      })
    })()
  }, [])

  return (
    <>
      <section className="carte" style={{ padding: '32px 32px 28px' }}>
        <p style={{ margin: 0, color: 'var(--bronze)', fontWeight: 700, letterSpacing: '0.12em', fontSize: 14 }}>
          GROUPE BRENGUIER
        </p>
        <h1 style={{ fontSize: 34, marginTop: 6 }}>États des lieux</h1>
        <hr className="filet" />
        <p style={{ margin: '0 0 24px', color: 'var(--texte-doux)', maxWidth: 640 }}>
          Entrée, sortie, appartements, maisons, locaux et entrepôts. Photos, signatures et rapport PDF, directement sur
          la tablette, même sans connexion.
        </p>
        <button className="bouton bouton-principal" disabled style={{ opacity: 0.55 }}>
          <Plus size={22} /> Nouvel état des lieux
        </button>
        <p style={{ margin: '12px 0 0', fontSize: 15, color: 'var(--texte-doux)' }}>
          <Info size={15} style={{ verticalAlign: '-2px' }} /> Disponible à l'étape 1 du développement.
        </p>
      </section>

      <h2 style={{ fontSize: 22, margin: '36px 0 14px' }}>Vérification de la tablette</h2>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Indicateur
          icone={<HardDrive />}
          titre="Espace de stockage"
          valeur={`${taille(diag.utilise)} utilisés`}
          detail={`sur ${taille(diag.disponible)} autorisés`}
          ok={!!diag.disponible}
        />
        <Indicateur
          icone={<CloudOff />}
          titre="Fonctionnement hors ligne"
          valeur={diag.horsLigne ? 'Activé' : 'Pas encore activé'}
          detail={diag.horsLigne ? 'Utilisable sans réseau' : 'Actif une fois l’application en ligne et installée'}
          ok={diag.horsLigne}
        />
        <Indicateur
          icone={<ShieldCheck />}
          titre="Protection des données"
          valeur={diag.persistant ? 'Stockage protégé' : 'Non protégé'}
          detail="Sera demandée à Android à l’étape 1"
          ok={!!diag.persistant}
        />
      </div>

      <p style={{ marginTop: 40, fontSize: 14, color: 'var(--texte-doux)', textAlign: 'center' }}>
        EDL Brenguier · version {__APP_VERSION__}
      </p>
    </>
  )
}

function Indicateur(props: { icone: React.ReactNode; titre: string; valeur: string; detail: string; ok: boolean }) {
  const couleur = props.ok ? 'var(--etat-neuf)' : 'var(--etat-use)'
  return (
    <div className="carte" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bronze-clair)',
          color: 'var(--encre)',
          flexShrink: 0,
        }}
      >
        {props.icone}
      </div>
      <div>
        <div style={{ fontSize: 15, color: 'var(--texte-doux)' }}>{props.titre}</div>
        <div style={{ fontWeight: 700, color: couleur }}>{props.valeur}</div>
        <div style={{ fontSize: 14, color: 'var(--texte-doux)' }}>{props.detail}</div>
      </div>
    </div>
  )
}
