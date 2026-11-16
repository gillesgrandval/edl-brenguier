import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  MessageSquareText,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react'
import { useEdl } from '../hooks/useEdl'
import { nouvelId } from '../db/base'
import { progressionPiece } from '../db/edl'
import type { Categorie, Element, Etat, Fonctionnement, Piece as TPiece } from '../db/types'
import { ETATS } from '../libelles'
import { LIBELLE_CATEGORIE, LOCALISATIONS, NATURES, OBSERVATIONS } from '../modeles/listes'
import { enregistrerPhoto, supprimerPhotos } from '../photos/traitement'
import { BarreProgression, Champ, Compteur, Confirmation, Interrupteur, Puces } from '../components/ui'
import { BoutonsPhoto, GaleriePhotos } from '../components/Photos'
import { BoutonDictee } from '../components/Dictee'
import Chargement from '../components/Chargement'

/**
 * Saisie d'une pièce, élément par élément.
 * Un seul élément est ouvert à la fois ; « Élément suivant » ouvre le prochain
 * élément non renseigné, puis propose la pièce suivante.
 */
export default function Piece() {
  const { id, pieceId } = useParams()
  const navigate = useNavigate()
  const { edl, modifier, sauvegarde } = useEdl(id)
  const [ouvert, setOuvert] = useState<string | null | undefined>(undefined)
  const [traitement, setTraitement] = useState(0)
  const [renommer, setRenommer] = useState(false)
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)
  const [ajout, setAjout] = useState(false)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})

  const piece = edl?.pieces.find((p) => p.id === pieceId)

  // À l'ouverture de chaque pièce : premier élément non renseigné.
  const [initPour, setInitPour] = useState<string>()
  useEffect(() => {
    if (piece && initPour !== piece.id) {
      setInitPour(piece.id)
      setOuvert(piece.elements.find((e) => !e.etat)?.id ?? null)
      window.scrollTo({ top: 0 })
    }
  }, [piece, initPour])

  // Fait défiler jusqu'à l'élément ouvert.
  useEffect(() => {
    if (!ouvert) return
    const t = window.setTimeout(() => refs.current[ouvert]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    return () => window.clearTimeout(t)
  }, [ouvert])

  if (edl === undefined) return <Chargement />
  if (!edl || !piece) return <Chargement introuvable />

  const index = edl.pieces.findIndex((p) => p.id === piece.id)
  const suivante = edl.pieces[index + 1]
  const pr = progressionPiece(piece)
  const finie = pr.total > 0 && pr.faits === pr.total
  const verrouille = edl.statut === 'signe'

  const majPiece = (f: (p: TPiece) => void) =>
    modifier((e) => {
      const p = e.pieces.find((x) => x.id === piece.id)
      if (p) f(p)
    })
  const majElement = (elementId: string, f: (el: Element) => void) =>
    majPiece((p) => {
      const el = p.elements.find((x) => x.id === elementId)
      if (el) f(el)
    })

  function elementSuivant(apres: string) {
    const i = piece!.elements.findIndex((e) => e.id === apres)
    const prochain = [...piece!.elements.slice(i + 1), ...piece!.elements.slice(0, i)].find((e) => !e.etat && e.id !== apres)
    setOuvert(prochain?.id ?? null)
    if (!prochain) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  async function ajouterPhotos(fichiers: File[], element?: Element) {
    setTraitement(fichiers.length)
    try {
      for (const f of fichiers) {
        const { id: photoId } = await enregistrerPhoto({
          fichier: f,
          edlId: edl!.id,
          reference: edl!.reference,
          pieceId: piece!.id,
          pieceNom: piece!.nom,
          elementId: element?.id,
          elementNom: element?.libelle,
        })
        if (element) majElement(element.id, (el) => void el.photoIds.push(photoId))
        else majPiece((p) => void p.photoIds.push(photoId))
        setTraitement((n) => n - 1)
      }
    } catch (err) {
      alert("La photo n'a pas pu être enregistrée : " + (err as Error).message)
    } finally {
      setTraitement(0)
    }
  }

  async function supprimerPhoto(photoId: string, element?: Element) {
    await supprimerPhotos([photoId])
    if (element) majElement(element.id, (el) => void (el.photoIds = el.photoIds.filter((x) => x !== photoId)))
    else majPiece((p) => void (p.photoIds = p.photoIds.filter((x) => x !== photoId)))
  }

  function toutEnBonEtat() {
    majPiece((p) => p.elements.forEach((el) => void (el.etat ??= 'bon')))
    setOuvert(null)
  }

  async function supprimerPiece() {
    await supprimerPhotos([...piece!.photoIds, ...piece!.elements.flatMap((e) => e.photoIds)])
    modifier((e) => void (e.pieces = e.pieces.filter((p) => p.id !== piece!.id)))
    navigate(`/edl/${edl!.id}`, { replace: true })
  }

  function dupliquer() {
    const base = piece!.nom.replace(/\s*\d+$/, '')
    const n = edl!.pieces.filter((p) => p.nom.replace(/\s*\d+$/, '') === base).length + 1
    const copie: TPiece = {
      id: nouvelId(),
      modele: piece!.modele,
      nom: `${base} ${n}`,
      photoIds: [],
      elements: piece!.elements.map((el) => ({ id: nouvelId(), libelle: el.libelle, categorie: el.categorie, equipement: el.equipement, nature: el.nature, observations: [], photoIds: [] })),
    }
    modifier((e) => void e.pieces.splice(index + 1, 0, copie))
    navigate(`/edl/${edl!.id}/piece/${copie.id}`, { replace: true })
    setOuvert(undefined)
  }

  return (
    <div className="saisie-piece">
      {/* --- En-tête collant --- */}
      <div className="piece-entete">
        <button className="bouton-icone" onClick={() => navigate(`/edl/${edl.id}`)} aria-label="Retour au tableau de bord">
          <ArrowLeft />
        </button>
        <div className="piece-entete-titre">
          {renommer ? (
            <input
              className="saisie saisie-titre"
              autoFocus
              value={piece.nom}
              onChange={(e) => majPiece((p) => void (p.nom = e.target.value))}
              onBlur={() => setRenommer(false)}
              onKeyDown={(e) => e.key === 'Enter' && setRenommer(false)}
            />
          ) : (
            <button className="titre-modifiable" onClick={() => !verrouille && setRenommer(true)}>
              <h1>{piece.nom}</h1>
              {!verrouille && <Pencil size={18} />}
            </button>
          )}
          <div className="piece-entete-progression">
            <BarreProgression pourcent={pr.total ? (pr.faits / pr.total) * 100 : 0} fine />
            <span>
              {pr.faits}/{pr.total}
            </span>
            <span className={`indicateur-sauvegarde ${sauvegarde}`}>{sauvegarde === 'ok' ? 'Enregistré' : '…'}</span>
          </div>
        </div>
      </div>

      {!verrouille && pr.faits < pr.total && (
        <button className="bouton bouton-discret bouton-tout-bon" onClick={toutEnBonEtat}>
          <CheckCheck size={20} /> Tout le reste en bon état ({pr.total - pr.faits})
        </button>
      )}

      {/* --- Éléments --- */}
      <div className="liste-elements">
        {piece.elements.map((el) => (
          <div key={el.id} ref={(n) => void (refs.current[el.id] = n)} className="ancre-element">
            <CarteElement
              element={el}
              ouvert={ouvert === el.id}
              verrouille={verrouille}
              onBasculer={() => setOuvert(ouvert === el.id ? null : el.id)}
              maj={(f) => majElement(el.id, f)}
              onSuivant={() => elementSuivant(el.id)}
              onSupprimer={async () => {
                await supprimerPhotos(el.photoIds)
                majPiece((p) => void (p.elements = p.elements.filter((x) => x.id !== el.id)))
              }}
              traitement={traitement}
              onPhotos={(f) => ajouterPhotos(f, el)}
              onSupprimerPhoto={(pid) => supprimerPhoto(pid, el)}
            />
          </div>
        ))}
      </div>

      {!verrouille && (
        <button className="bouton bouton-discret bouton-ajout" onClick={() => setAjout(true)}>
          <Plus size={20} /> Ajouter un élément
        </button>
      )}

      {/* --- Vue d'ensemble et commentaire --- */}
      <section className="carte piece-ensemble">
        <h2>
          <Camera size={20} /> Vue d'ensemble de la pièce
        </h2>
        <p className="texte-doux">Photos générales (une par mur, par exemple) et remarques sur la pièce.</p>
        {!verrouille && <BoutonsPhoto onFichiers={(f) => ajouterPhotos(f)} enCours={traitement} />}
        <GaleriePhotos ids={piece.photoIds} onSupprimer={(pid) => supprimerPhoto(pid)} />
        <div className="grille" style={{ marginTop: 16 }}>
          <Champ label="Dimensions (facultatif)" valeur={piece.dimensions} onChange={(v) => majPiece((p) => void (p.dimensions = v))} placeholder="ex. 4,20 x 3,50 m" />
        </div>
        <ChampCommentaire label="Commentaire sur la pièce" valeur={piece.commentaire} onChange={(v) => majPiece((p) => void (p.commentaire = v))} />
      </section>

      {/* --- Fin de pièce --- */}
      <div className={`fin-piece ${finie ? 'fin-piece-ok' : ''}`}>
        {finie ? (
          <p>
            <span className="pastille-ok">
              <Check size={18} strokeWidth={3} />
            </span>{' '}
            <strong>{piece.nom} terminée.</strong>
          </p>
        ) : (
          <p className="texte-doux">
            Il reste {pr.total - pr.faits} élément{pr.total - pr.faits > 1 ? 's' : ''} à renseigner.
          </p>
        )}
        <div className="fin-piece-actions">
          <button className="bouton bouton-discret" onClick={() => navigate(`/edl/${edl.id}`)}>
            Tableau de bord
          </button>
          {suivante && (
            <button
              className="bouton bouton-principal"
              onClick={() => {
                setOuvert(undefined)
                navigate(`/edl/${edl.id}/piece/${suivante.id}`, { replace: true })
              }}
            >
              {suivante.nom} <ArrowRight size={20} />
            </button>
          )}
        </div>
      </div>

      {!verrouille && (
        <div className="actions-piece">
          <button className="bouton bouton-discret bouton-petit" onClick={dupliquer}>
            <Copy size={18} /> Dupliquer la pièce
          </button>
          <button className="bouton bouton-discret bouton-petit bouton-danger-texte" onClick={() => setConfirmerSuppression(true)}>
            <Trash2 size={18} /> Supprimer la pièce
          </button>
        </div>
      )}

      <Confirmation
        ouvert={confirmerSuppression}
        danger
        titre={`Supprimer « ${piece.nom} » ?`}
        message="Tous ses éléments, observations et photos seront effacés."
        libelleOk="Supprimer la pièce"
        onAnnuler={() => setConfirmerSuppression(false)}
        onOk={supprimerPiece}
      />

      {ajout && (
        <AjoutElement
          onAnnuler={() => setAjout(false)}
          onAjouter={(libelle, categorie, equipement) => {
            const el: Element = { id: nouvelId(), libelle, categorie, equipement, observations: [], photoIds: [] }
            majPiece((p) => void p.elements.push(el))
            setAjout(false)
            setOuvert(el.id)
          }}
        />
      )}
    </div>
  )
}

// =====================================================================
// Carte d'un élément
// =====================================================================

function CarteElement(props: {
  element: Element
  ouvert: boolean
  verrouille: boolean
  onBasculer: () => void
  maj: (f: (el: Element) => void) => void
  onSuivant: () => void
  onSupprimer: () => void
  traitement: number
  onPhotos: (f: File[]) => void
  onSupprimerPhoto: (id: string) => void
}) {
  const { element: el, maj } = props
  const etat = ETATS.find((e) => e.cle === el.etat)
  const [confirmer, setConfirmer] = useState(false)
  const resume = [el.nature, ...el.observations, el.trousChevilles ? `${el.trousChevilles} trou(s) de cheville` : '', el.aNettoyer ? 'À nettoyer' : '']
    .filter(Boolean)
    .join(' · ')

  const basculer = (liste: 'observations', v: string) =>
    maj((e) => void (e[liste] = e[liste].includes(v) ? e[liste].filter((x) => x !== v) : [...e[liste], v]))

  return (
    <div className={`carte-element ${props.ouvert ? 'carte-element-ouverte' : ''} ${el.etat ? 'carte-element-faite' : ''}`}>
      <button className="carte-element-entete" onClick={props.onBasculer} aria-expanded={props.ouvert}>
        <span className="pastille-etat" style={{ background: etat?.couleur ?? 'transparent', borderColor: etat?.couleur ?? 'var(--trait)' }}>
          {etat ? etat.code : ''}
        </span>
        <span className="carte-element-titre">
          <strong>{el.libelle}</strong>
          {!props.ouvert && (resume || etat) && (
            <span className="carte-element-resume">
              {etat?.libelle}
              {resume ? ` — ${resume}` : ''}
            </span>
          )}
        </span>
        {el.photoIds.length > 0 && (
          <span className="compte-photos">
            <Camera size={15} /> {el.photoIds.length}
          </span>
        )}
        <ChevronDown className="chevron" />
      </button>

      {props.ouvert && (
        <fieldset className="carte-element-corps" disabled={props.verrouille}>
          {/* État */}
          <div className="bloc">
            <div className="bloc-titre">État</div>
            <div className="boutons-etat">
              {ETATS.map((e) => (
                <button
                  key={e.cle}
                  type="button"
                  className={`bouton-etat ${el.etat === e.cle ? 'bouton-etat-actif' : ''}`}
                  style={{ '--couleur': e.couleur } as React.CSSProperties}
                  onClick={() => maj((x) => void (x.etat = x.etat === e.cle ? undefined : (e.cle as Etat)))}
                >
                  <span className="bouton-etat-code">{e.code}</span>
                  <span className="bouton-etat-libelle">{e.libelle}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fonctionnement */}
          {el.equipement && (
            <div className="bloc">
              <div className="bloc-titre">
                <Wrench size={16} /> Fonctionnement
              </div>
              <div className="segment segment-large">
                {(
                  [
                    ['ok', 'Testé OK'],
                    ['defaillant', 'Défaillant'],
                    ['non_teste', 'Non testé'],
                  ] as [Fonctionnement, string][]
                ).map(([v, l]) => (
                  <button key={v} type="button" className={el.fonctionnement === v ? `segment-actif fonct-${v}` : ''} onClick={() => maj((x) => void (x.fonctionnement = x.fonctionnement === v ? undefined : v))}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nature */}
          <div className="bloc">
            <div className="bloc-titre">Nature / matériau</div>
            <Puces options={NATURES[el.categorie]} choisies={el.nature ? [el.nature] : []} onBasculer={(v) => maj((x) => void (x.nature = x.nature === v ? undefined : v))} />
          </div>

          {/* Observations */}
          <div className="bloc">
            <div className="bloc-titre">Observations</div>
            <Puces options={OBSERVATIONS} choisies={el.observations} onBasculer={(v) => basculer('observations', v)} />
            {el.observations.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="bloc-sous-titre">Localisation</div>
                <Puces options={LOCALISATIONS} choisies={el.localisation ? [el.localisation] : []} onBasculer={(v) => maj((x) => void (x.localisation = x.localisation === v ? undefined : v))} />
              </div>
            )}
          </div>

          <div className="bloc bloc-ligne">
            <div className="ligne-compteur">
              <span>Trous de chevilles</span>
              <Compteur valeur={el.trousChevilles ?? 0} max={99} onChange={(v) => maj((x) => void (x.trousChevilles = v || undefined))} />
            </div>
            <div className="ligne-compteur">
              <span>Quantité</span>
              <Compteur valeur={el.quantite ?? 1} min={0} max={99} onChange={(v) => maj((x) => void (x.quantite = v === 1 ? undefined : v))} />
            </div>
          </div>
          <div className="bloc bloc-ligne">
            <Interrupteur libelle="À nettoyer" valeur={!!el.aNettoyer} onChange={(v) => maj((x) => void (x.aNettoyer = v || undefined))} />
            <Interrupteur libelle="Sous réserve" valeur={!!el.reserve} onChange={(v) => maj((x) => void (x.reserve = v || undefined))} />
          </div>

          <ChampCommentaire label="Commentaire" valeur={el.commentaire} onChange={(v) => maj((x) => void (x.commentaire = v || undefined))} />

          {/* Photos */}
          <div className="bloc">
            <div className="bloc-titre">
              <Camera size={16} /> Photos {el.photoIds.length > 0 && `(${el.photoIds.length})`}
            </div>
            {!props.verrouille && <BoutonsPhoto onFichiers={props.onPhotos} enCours={props.traitement} />}
            <GaleriePhotos ids={el.photoIds} onSupprimer={props.onSupprimerPhoto} />
          </div>

          <div className="carte-element-pied">
            {confirmer ? (
              <span className="confirmation-ligne">
                Retirer « {el.libelle} » ?
                <button type="button" className="bouton bouton-discret bouton-petit" onClick={() => setConfirmer(false)}>
                  Non
                </button>
                <button type="button" className="bouton bouton-danger bouton-petit" onClick={props.onSupprimer}>
                  Retirer
                </button>
              </span>
            ) : (
              <button type="button" className="bouton bouton-discret bouton-petit bouton-danger-texte" onClick={() => setConfirmer(true)}>
                <Trash2 size={18} /> Retirer l'élément
              </button>
            )}
            <button type="button" className="bouton bouton-principal" onClick={props.onSuivant}>
              {el.etat ? <Check size={20} /> : null} Élément suivant <ArrowRight size={20} />
            </button>
          </div>
        </fieldset>
      )}
    </div>
  )
}

function ChampCommentaire(props: { label: string; valeur?: string; onChange: (v: string) => void }) {
  return (
    <div className="bloc">
      <div className="bloc-titre">
        <MessageSquareText size={16} /> {props.label}
        <BoutonDictee onTexte={(t) => props.onChange(props.valeur ? `${props.valeur} ${t}` : t)} />
      </div>
      <textarea className="saisie" rows={2} value={props.valeur ?? ''} onChange={(e) => props.onChange(e.target.value)} placeholder="Saisir ou dicter…" />
    </div>
  )
}

// =====================================================================
// Ajout d'un élément libre
// =====================================================================

function AjoutElement(props: { onAnnuler: () => void; onAjouter: (libelle: string, c: Categorie, equipement: boolean) => void }) {
  const [libelle, setLibelle] = useState('')
  const [categorie, setCategorie] = useState<Categorie>('equipement')
  const [equipement, setEquipement] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const cats = Object.entries(LIBELLE_CATEGORIE) as [Categorie, string][]
  return (
    <dialog ref={ref} className="dialogue" onCancel={props.onAnnuler}>
      <h2>
        <Sparkles size={22} /> Ajouter un élément
      </h2>
      <Champ label="Nom de l'élément" valeur={libelle} onChange={setLibelle} placeholder="ex. Interphone vidéo, Store banne…" />
      <div className="bloc-sous-titre" style={{ marginTop: 16 }}>
        Catégorie
      </div>
      <div className="puces">
        {cats.map(([c, l]) => (
          <button key={c} type="button" className={`puce ${categorie === c ? 'puce-active' : ''}`} onClick={() => setCategorie(c)}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <Interrupteur libelle="Équipement à tester (fonctionnement)" valeur={equipement} onChange={setEquipement} />
      </div>
      <div className="dialogue-actions">
        <button className="bouton bouton-discret" onClick={props.onAnnuler}>
          Annuler
        </button>
        <button className="bouton bouton-principal" disabled={!libelle.trim()} onClick={() => props.onAjouter(libelle.trim(), categorie, equipement)}>
          <Plus size={20} /> Ajouter
        </button>
      </div>
    </dialog>
  )
}
