import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, Check, ChevronRight } from 'lucide-react'
import { db } from '../db/base'
import { appliquerEcarts, ecartsFiche } from '../db/patrimoine'
import type { Edl } from '../db/types'

/**
 * Après (ou pendant) une visite : propose de reporter sur la fiche permanente du bien
 * les pièces ajoutées et les nombres constatés. Rien n'est reporté sans l'accord de l'utilisateur.
 */
export default function MiseAJourFiche({ edl }: { edl: Edl }) {
  const bien = useLiveQuery(() => (edl.bienId ? db.biens.get(edl.bienId) : undefined), [edl.bienId])
  const [ouvert, setOuvert] = useState(false)
  const [fait, setFait] = useState(false)
  if (!bien) return null
  const ecarts = ecartsFiche(edl, bien)
  if (fait && !ecarts.length)
    return (
      <p className="carte message-import message-ok" style={{ marginBottom: 12 }}>
        <Check size={18} /> Fiche du bien mise à jour.
      </p>
    )
  if (!ecarts.length) return null
  const pieces = ecarts.filter((e) => e.type === 'piece').length
  const nombres = ecarts.length - pieces
  return (
    <>
      <button className="carte tuile-ligne" style={{ marginBottom: 12 }} onClick={() => setOuvert(true)}>
        <span className="tuile-ligne-icone">
          <Building2 size={22} />
        </span>
        <span className="tuile-ligne-texte">
          <strong>Mettre à jour la fiche du bien ?</strong>
          <span className="texte-doux">
            {[pieces && `${pieces} pièce${pieces > 1 ? 's' : ''} absente${pieces > 1 ? 's' : ''} de la fiche`, nombres && `${nombres} nombre${nombres > 1 ? 's' : ''} constaté${nombres > 1 ? 's' : ''} différent${nombres > 1 ? 's' : ''}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <ChevronRight />
      </button>
      {ouvert && (
        <DialogueEcarts
          ecarts={ecarts}
          onAnnuler={() => setOuvert(false)}
          onAppliquer={async (choisis) => {
            await appliquerEcarts(bien.id, choisis)
            setOuvert(false)
            setFait(true)
          }}
        />
      )}
    </>
  )
}

function DialogueEcarts(props: { ecarts: ReturnType<typeof ecartsFiche>; onAnnuler: () => void; onAppliquer: (e: ReturnType<typeof ecartsFiche>) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [choix, setChoix] = useState<Set<string>>(() => new Set(props.ecarts.map((e) => e.cle)))
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className="dialogue" onCancel={props.onAnnuler}>
      <h2>Mettre à jour la fiche du bien</h2>
      <p className="texte-doux">Cochez ce qui doit servir aux prochains états des lieux. L'état des lieux en cours n'est pas modifié.</p>
      <div className="liste-cases">
        {props.ecarts.map((e) => (
          <label key={e.cle} className="ligne-case">
            <input
              type="checkbox"
              checked={choix.has(e.cle)}
              onChange={() =>
                setChoix((c) => {
                  const n = new Set(c)
                  if (n.has(e.cle)) n.delete(e.cle)
                  else n.add(e.cle)
                  return n
                })
              }
            />
            <span>{e.libelle}</span>
          </label>
        ))}
      </div>
      <div className="dialogue-actions">
        <button className="bouton bouton-discret" onClick={props.onAnnuler}>
          Plus tard
        </button>
        <button className="bouton bouton-principal" disabled={!choix.size} onClick={() => props.onAppliquer(props.ecarts.filter((e) => choix.has(e.cle)))}>
          <Check size={20} /> Mettre à jour la fiche
        </button>
      </div>
    </dialog>
  )
}
