import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Camera, Check, ListOrdered, Plus } from 'lucide-react'
import { majEdl, progressionPiece } from '../db/edl'
import type { Edl } from '../db/types'
import { creerPieces, modelesPour } from '../modeles/pieces'
import { nouvelId } from '../db/base'
import { BarreProgression, Champ, Section } from './ui'

/** Liste des pièces du tableau de bord : ouverture, ajout, réorganisation. */
export default function BlocPieces({ edl }: { edl: Edl }) {
  const navigate = useNavigate()
  const [ordre, setOrdre] = useState(false)
  const [ajout, setAjout] = useState(false)
  const verrouille = edl.statut === 'signe'

  const deplacer = (i: number, sens: -1 | 1) =>
    majEdl(edl.id, (e) => {
      const j = i + sens
      if (j < 0 || j >= e.pieces.length) return
      ;[e.pieces[i], e.pieces[j]] = [e.pieces[j], e.pieces[i]]
    })

  return (
    <Section
      titre={`Pièces (${edl.pieces.filter((p) => p.modele !== 'mobilier').length})`}
      action={
        !verrouille && (
          <span style={{ display: 'flex', gap: 8 }}>
            <button className={`bouton bouton-discret bouton-petit ${ordre ? 'bouton-actif' : ''}`} onClick={() => setOrdre(!ordre)}>
              {ordre ? <Check size={18} /> : <ListOrdered size={18} />} {ordre ? 'Terminé' : 'Réorganiser'}
            </button>
            <button className="bouton bouton-discret bouton-petit" onClick={() => setAjout(true)}>
              <Plus size={18} /> Ajouter
            </button>
          </span>
        )
      }
    >
      <div className="grille-pieces">
        {edl.pieces.map((p, i) => {
          if (p.modele === 'mobilier') return null
          const pr = progressionPiece(p)
          const finie = pr.total > 0 && pr.faits === pr.total
          const photos = p.photoIds.length + p.elements.reduce((n, e) => n + e.photoIds.length, 0)
          return (
            <div key={p.id} className={`carte tuile-piece ${finie ? 'tuile-piece-finie' : ''}`} role="button" tabIndex={0} onClick={() => !ordre && navigate(`/edl/${edl.id}/piece/${p.id}`)}>
              <div className="tuile-piece-haut">
                <span className="tuile-piece-nom">{p.nom}</span>
                {ordre ? (
                  <span className="fleches">
                    <button aria-label="Monter" disabled={i === 0} onClick={() => deplacer(i, -1)}>
                      <ArrowUp size={20} />
                    </button>
                    <button aria-label="Descendre" disabled={i === edl.pieces.length - 1} onClick={() => deplacer(i, 1)}>
                      <ArrowDown size={20} />
                    </button>
                  </span>
                ) : (
                  finie && (
                    <span className="pastille-ok">
                      <Check size={16} strokeWidth={3} />
                    </span>
                  )
                )}
              </div>
              <BarreProgression pourcent={pr.total ? (pr.faits / pr.total) * 100 : 0} fine />
              <span className="tuile-piece-detail">
                {pr.faits} / {pr.total} éléments
                {photos > 0 && (
                  <>
                    {' '}
                    · <Camera size={14} /> {photos}
                  </>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {ajout && <AjoutPiece edl={edl} onFermer={() => setAjout(false)} />}
    </Section>
  )
}

function AjoutPiece({ edl, onFermer }: { edl: Edl; onFermer: () => void }) {
  const navigate = useNavigate()
  const ref = useRef<HTMLDialogElement>(null)
  const [libre, setLibre] = useState('')
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  async function ajouter(cle: string | null) {
    const nouvelles = cle
      ? creerPieces({ [cle]: 1 }, edl.typeBien)
      : [{ id: nouvelId(), modele: 'libre', nom: libre.trim(), elements: [], photoIds: [] }]
    const piece = nouvelles[0]
    // Numérote si une pièce du même nom existe déjà (« Chambre 3 »).
    const memes = edl.pieces.filter((p) => p.nom.replace(/\s*\d+$/, '') === piece.nom).length
    if (memes > 0) piece.nom = `${piece.nom} ${memes + 1}`
    await majEdl(edl.id, (e) => void e.pieces.push(piece))
    onFermer()
    navigate(`/edl/${edl.id}/piece/${piece.id}`)
  }

  return (
    <dialog ref={ref} className="dialogue dialogue-large" onCancel={onFermer}>
      <h2>Ajouter une pièce</h2>
      <div className="puces">
        {modelesPour(edl.typeBien).map((m) => (
          <button key={m.cle} className="puce" onClick={() => ajouter(m.cle)}>
            <Plus size={16} /> {m.nom}
          </button>
        ))}
      </div>
      <div className="bloc-sous-titre" style={{ marginTop: 20 }}>
        Ou une pièce personnalisée (vide, vous ajoutez les éléments)
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Champ label="Nom" valeur={libre} onChange={setLibre} placeholder="ex. Mezzanine, Véranda…" />
        </div>
        <button className="bouton bouton-principal" disabled={!libre.trim()} onClick={() => ajouter(null)}>
          Créer
        </button>
      </div>
      <div className="dialogue-actions">
        <button className="bouton bouton-discret" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </dialog>
  )
}
