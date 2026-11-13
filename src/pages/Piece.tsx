import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Construction } from 'lucide-react'
import { db } from '../db/base'
import Chargement from '../components/Chargement'

/**
 * Saisie d'une pièce — version provisoire (étape 1).
 * Affiche les éléments préremplis ; la saisie arrive à l'étape 2.
 */
export default function Piece() {
  const { id, pieceId } = useParams()
  const navigate = useNavigate()
  const edl = useLiveQuery(async () => (id ? ((await db.edls.get(id)) ?? null) : null), [id])
  if (edl === undefined) return <Chargement />
  const piece = edl?.pieces.find((p) => p.id === pieceId)
  if (!edl || !piece) return <Chargement introuvable />

  return (
    <>
      <div className="tdb-entete">
        <button className="bouton-icone" onClick={() => navigate(`/edl/${edl.id}`)} aria-label="Retour">
          <ArrowLeft />
        </button>
        <div className="tdb-titre">
          <span className="reference">{edl.reference}</span>
          <h1>{piece.nom}</h1>
        </div>
      </div>
      <div className="rappel" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Construction size={22} />
        La saisie de l'état de chaque élément (boutons de couleur, observations, photos) arrive à l'étape 2.
      </div>
      <div className="carte" style={{ marginTop: 16 }}>
        {piece.elements.map((e) => (
          <div key={e.id} className="ligne-element-apercu">
            {e.libelle}
            {e.equipement && <span className="texte-doux"> · équipement à tester</span>}
          </div>
        ))}
      </div>
    </>
  )
}
