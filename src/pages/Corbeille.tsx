import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { db } from '../db/base'
import { restaurerDeLaCorbeille, supprimerDefinitivement } from '../db/admin'
import type { Edl } from '../db/types'
import { formatDate } from '../libelles'
import { DemandeCode, ResumeEdl } from '../components/Admin'
import Chargement from '../components/Chargement'

/** Corbeille : brouillons supprimés, restaurables. La suppression définitive demande le code. */
export default function Corbeille() {
  const navigate = useNavigate()
  const edls = useLiveQuery(async () => (await db.edls.toArray()).filter((e) => e.corbeille).sort((a, b) => b.corbeille!.le.localeCompare(a.corbeille!.le)), [])
  const [aSupprimer, setASupprimer] = useState<Edl | null>(null)
  if (!edls) return <Chargement />
  return (
    <>
      <div className="tdb-entete">
        <button className="bouton-icone" onClick={() => navigate(-1)} aria-label="Retour">
          <ArrowLeft />
        </button>
        <div className="tdb-titre">
          <h1>
            <Trash2 size={24} style={{ verticalAlign: '-3px' }} /> Corbeille
          </h1>
          <p className="texte-doux">
            Brouillons supprimés : ils restent restaurables. La suppression définitive efface aussi leurs photos et demande le code administrateur. Rien n'est vidé automatiquement.
          </p>
        </div>
      </div>
      {edls.length === 0 && (
        <div className="vide">
          <Trash2 size={36} />
          <p>La corbeille est vide.</p>
        </div>
      )}
      {edls.map((e) => (
        <section key={e.id} className="carte rubrique-carte">
          <ResumeEdl edl={e} />
          <p className="texte-doux" style={{ marginTop: 0 }}>
            Mis à la corbeille le {formatDate(e.corbeille!.le, true)}
            {e.corbeille!.motif ? ` — ${e.corbeille!.motif}` : ''}
          </p>
          <div className="actions-rapides">
            <button className="bouton bouton-principal" onClick={() => restaurerDeLaCorbeille(e.id)}>
              <RotateCcw size={20} /> Restaurer
            </button>
            <button className="bouton bouton-discret bouton-danger-texte" onClick={() => setASupprimer(e)}>
              <Trash2 size={20} /> Supprimer définitivement
            </button>
          </div>
        </section>
      ))}
      {aSupprimer && (
        <DemandeCode
          titre="Supprimer définitivement ?"
          message={
            <>
              <ResumeEdl edl={aSupprimer} />
              <p>
                L'état des lieux, ses photos et ses signatures seront <strong>effacés de l'appareil, sans retour possible</strong>. La suppression reste inscrite au journal.
              </p>
            </>
          }
          libelleOk="Supprimer définitivement"
          onValider={(code) => supprimerDefinitivement(aSupprimer.id, code)}
          onFermer={() => setASupprimer(null)}
        />
      )}
    </>
  )
}
