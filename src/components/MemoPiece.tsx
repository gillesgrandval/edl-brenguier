import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Mic, Sparkles, Square, Wand2, X } from 'lucide-react'
import { analyserMemo, type Analyse } from '../analyse/memo'
import type { Piece } from '../db/types'
import { ETATS } from '../libelles'
import { useDicteeContinue } from '../hooks/useDicteeContinue'

const EXEMPLE =
  "La pièce est en bon état. Sur le mur est, il reste des vis et trois trous de chevilles, des traces et une plante arrachée. Le parquet est rayé côté fenêtre. Le radiateur ne fonctionne pas."

/**
 * Mémo vocal d'une pièce : on décrit librement ce que l'on voit,
 * l'application remplit les éléments correspondants après vérification.
 */
export default function MemoPiece(props: { piece: Piece; onFermer: () => void; onAppliquer: (a: Analyse, retenues: Set<string>, general: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [texte, setTexte] = useState('')
  const [etape, setEtape] = useState<'dictee' | 'verification'>('dictee')
  const dictee = useDicteeContinue((t) => setTexte((x) => (x ? `${x} ${t}` : t)))

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const analyse = useMemo(() => (etape === 'verification' ? analyserMemo(texte, props.piece) : null), [etape, texte, props.piece])
  const [decochees, setDecochees] = useState<Set<string>>(new Set())
  const [general, setGeneral] = useState(true)

  function analyser() {
    dictee.arreter()
    setDecochees(new Set())
    setGeneral(true)
    setEtape('verification')
  }

  function appliquer() {
    if (!analyse) return
    const retenues = new Set(analyse.propositions.map((p) => p.elementId).filter((id) => !decochees.has(id)))
    props.onAppliquer(analyse, retenues, general)
  }

  const nbRetenues = analyse ? analyse.propositions.filter((p) => !decochees.has(p.elementId)).length : 0

  return (
    <dialog ref={ref} className="dialogue dialogue-large memo" onCancel={props.onFermer}>
      <div className="memo-entete">
        <h2>
          <Mic size={22} /> Dicter la pièce — {props.piece.nom}
        </h2>
        <button className="bouton-icone" onClick={props.onFermer} aria-label="Fermer">
          <X />
        </button>
      </div>

      {etape === 'dictee' && (
        <>
          <p className="texte-doux">
            Décrivez librement ce que vous voyez : l'état général, puis chaque défaut avec l'élément et l'endroit. Exemple :{' '}
            <em>« {EXEMPLE} »</em>
          </p>

          {dictee.disponible && (
            <button className={`bouton bouton-xl memo-micro ${dictee.ecoute ? 'memo-micro-actif' : ''}`} onClick={dictee.ecoute ? dictee.arreter : dictee.demarrer}>
              {dictee.ecoute ? <Square size={24} /> : <Mic size={26} />}
              {dictee.ecoute ? 'Arrêter la dictée' : texte ? 'Reprendre la dictée' : 'Commencer à dicter'}
            </button>
          )}
          {dictee.ecoute && <p className="memo-provisoire">{dictee.provisoire || 'J’écoute…'}</p>}
          {dictee.erreur && <p className="dictee-erreur">{dictee.erreur}</p>}

          <textarea
            className="saisie memo-texte"
            rows={7}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Le texte dicté apparaît ici. Vous pouvez aussi le corriger, ou dicter avec le micro du clavier."
          />

          <div className="dialogue-actions">
            <button className="bouton bouton-discret" onClick={props.onFermer}>
              Annuler
            </button>
            <button className="bouton bouton-principal" disabled={!texte.trim()} onClick={analyser}>
              <Wand2 size={20} /> Analyser
            </button>
          </div>
        </>
      )}

      {etape === 'verification' && analyse && (
        <>
          <p className="texte-doux">Vérifiez ce que l'application a compris. Décochez ce qui est faux, puis appliquez. Tout reste modifiable ensuite.</p>

          {analyse.propositions.length === 0 && !analyse.etatGeneral && (
            <p className="rappel">Aucun élément de la pièce n'a été reconnu. Reformulez en citant l'élément (mur, sol, porte, robinet…), ou saisissez à la main.</p>
          )}

          <div className="memo-propositions">
            {analyse.propositions.map((p) => {
              const actif = !decochees.has(p.elementId)
              const etat = ETATS.find((e) => e.cle === p.etat)
              return (
                <button
                  key={p.elementId}
                  className={`memo-prop ${actif ? '' : 'memo-prop-off'}`}
                  onClick={() => {
                    const n = new Set(decochees)
                    if (actif) n.add(p.elementId)
                    else n.delete(p.elementId)
                    setDecochees(n)
                  }}
                >
                  <span className={`case ${actif ? 'case-on' : ''}`}>{actif && <Check size={18} strokeWidth={3} />}</span>
                  <span className="memo-prop-corps">
                    <span className="memo-prop-titre">
                      <strong>{p.libelle}</strong>
                      {etat && (
                        <span className="badge" style={{ background: etat.couleur, color: '#fff' }}>
                          {etat.libelle}
                          {p.etatDeduit ? ' (déduit)' : ''}
                        </span>
                      )}
                      {p.fonctionnement && <span className="badge badge-gris">{p.fonctionnement === 'ok' ? 'Fonctionne' : 'Défaillant'}</span>}
                    </span>
                    {(p.observations.length > 0 || p.localisation || p.trousChevilles) && (
                      <span className="memo-prop-detail">
                        {[p.localisation, ...p.observations, p.trousChevilles ? `${p.trousChevilles} trou(s) de cheville` : ''].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    <span className="memo-prop-extrait">« {p.extraits.join(' — ')} »</span>
                  </span>
                </button>
              )
            })}

            {analyse.etatGeneral && analyse.nbEtatGeneral > 0 && (
              <button className={`memo-prop ${general ? '' : 'memo-prop-off'}`} onClick={() => setGeneral(!general)}>
                <span className={`case ${general ? 'case-on' : ''}`}>{general && <Check size={18} strokeWidth={3} />}</span>
                <span className="memo-prop-corps">
                  <span className="memo-prop-titre">
                    <Sparkles size={18} />
                    <strong>
                      {analyse.nbEtatGeneral} autre{analyse.nbEtatGeneral > 1 ? 's' : ''} élément{analyse.nbEtatGeneral > 1 ? 's' : ''} non renseigné{analyse.nbEtatGeneral > 1 ? 's' : ''}
                    </strong>
                    <span className="badge" style={{ background: ETATS.find((e) => e.cle === analyse.etatGeneral)?.couleur, color: '#fff' }}>
                      {ETATS.find((e) => e.cle === analyse.etatGeneral)?.libelle}
                    </span>
                  </span>
                  <span className="memo-prop-detail">État général de la pièce, appliqué à tout ce qui n'a pas été cité.</span>
                </span>
              </button>
            )}

            {analyse.commentairePiece.length > 0 && (
              <div className="memo-commentaire">
                <strong>Ajouté au commentaire de la pièce :</strong> « {analyse.commentairePiece.join('. ')} »
              </div>
            )}
          </div>

          <div className="dialogue-actions">
            <button className="bouton bouton-discret" onClick={() => setEtape('dictee')}>
              <ArrowLeft size={20} /> Modifier le texte
            </button>
            <button className="bouton bouton-accent" onClick={appliquer} disabled={nbRetenues === 0 && !(general && analyse.etatGeneral) && !analyse.commentairePiece.length}>
              <Check size={20} /> Appliquer
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
