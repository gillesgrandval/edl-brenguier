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
  Hash,
  MessageSquareText,
  Mic,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
  Lock,
  Minus,
  History,
} from 'lucide-react'
import { useEdl } from '../hooks/useEdl'
import { useLiveQuery } from 'dexie-react-hooks'
import { elementsParId, evolution } from '../db/sortie'
import { db, nouvelId } from '../db/base'
import { progressionPiece } from '../db/edl'
import type { Categorie, Element, Etat, Fonctionnement, GenreElement, Piece as TPiece, UniteClim } from '../db/types'
import { constatsPiece, elementFait, fixerNombre, genreDe, GENRES, majSyntheseClim, photosElement, texteNombre, uniteVide } from '../modeles/comptes'
import { copieVierge, creerElement, ELEMENTS_COMPTES } from '../modeles/pieces'
import { ETATS } from '../libelles'
import { LIBELLE_CATEGORIE, LOCALISATIONS, NATURES, OBSERVATIONS } from '../modeles/listes'
import { enregistrerPhoto, supprimerPhotos } from '../photos/traitement'
import { BarreProgression, Champ, Compteur, Confirmation, Interrupteur, Puces } from '../components/ui'
import { BoutonsPhoto, GaleriePhotos, LectureSeule } from '../components/Photos'
import { BoutonDictee } from '../components/Dictee'
import Chargement from '../components/Chargement'
import MemoPiece from '../components/MemoPiece'
import { appliquerAnalyse } from '../analyse/memo'
import { elementDeReference } from '../db/reference'
import { formatDate } from '../libelles'

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
  const [confirmerTout, setConfirmerTout] = useState(false)
  const [traitement, setTraitement] = useState(0)
  const [renommer, setRenommer] = useState(false)
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)
  const [ajout, setAjout] = useState(false)
  const [memo, setMemo] = useState(false)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})

  const piece = edl?.pieces.find((p) => p.id === pieceId)

  // À l'ouverture de chaque pièce : premier élément non renseigné.
  const [initPour, setInitPour] = useState<string>()
  useEffect(() => {
    if (piece && initPour !== piece.id) {
      setInitPour(piece.id)
      setOuvert(piece.elements.find((e) => !elementFait(e))?.id ?? null)
      window.scrollTo({ top: 0 })
    }
  }, [piece, initPour])

  // Fait défiler jusqu'à l'élément ouvert.
  useEffect(() => {
    if (!ouvert) return
    const t = window.setTimeout(() => refs.current[ouvert]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    return () => window.clearTimeout(t)
  }, [ouvert])

  // Sortie : éléments de l'état des lieux d'entrée, pour comparer sur place.
  const idEntree = edl?.edlEntreeId
  const entree = useLiveQuery(async () => (idEntree ? elementsParId(await db.edls.get(idEntree)) : null), [idEntree])

  if (edl === undefined) return <Chargement />
  if (!edl || !piece) return <Chargement introuvable />

  const index = edl.pieces.findIndex((p) => p.id === piece.id)
  const suivante = edl.pieces[index + 1]
  const pr = progressionPiece(piece)
  const finie = pr.total > 0 && pr.faits === pr.total
  const verrouille = edl.statut === 'signe'
  const aConfirmer = piece.elements.filter((e) => e.aConfirmer).length

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
    const prochain = [...piece!.elements.slice(i + 1), ...piece!.elements.slice(0, i)].find((e) => !elementFait(e) && e.id !== apres)
    setOuvert(prochain?.id ?? null)
    if (!prochain) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  async function ajouterPhotos(fichiers: File[], element?: Element, uniteId?: string) {
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
          elementNom: element ? element.libelle + (uniteId ? ` — unité ${(element.unites ?? []).findIndex((u) => u.id === uniteId) + 1}` : '') : undefined,
        })
        if (element && uniteId)
          majElement(element.id, (el) => {
            el.unites?.find((u) => u.id === uniteId)?.photoIds.push(photoId)
            delete el.quantiteSource
          })
        else if (element) majElement(element.id, (el) => void el.photoIds.push(photoId))
        else majPiece((p) => void p.photoIds.push(photoId))
        setTraitement((n) => n - 1)
      }
    } catch (err) {
      alert("La photo n'a pas pu être enregistrée : " + (err as Error).message)
    } finally {
      setTraitement(0)
    }
  }

  async function supprimerPhoto(photoId: string, element?: Element, uniteId?: string) {
    await supprimerPhotos([photoId])
    if (element && uniteId)
      majElement(element.id, (el) => {
        const u = el.unites?.find((x) => x.id === uniteId)
        if (u) u.photoIds = u.photoIds.filter((x) => x !== photoId)
      })
    else if (element) majElement(element.id, (el) => void (el.photoIds = el.photoIds.filter((x) => x !== photoId)))
    else majPiece((p) => void (p.photoIds = p.photoIds.filter((x) => x !== photoId)))
  }

  function toutEnBonEtat() {
    // La climatisation n'est jamais présumée : son nombre et l'état de chaque unité se constatent.
    majPiece((p) => p.elements.forEach((el) => void (genreDe(el) !== 'climatisation' && (el.etat ??= 'bon'))))
    setOuvert(null)
  }

  async function supprimerPiece() {
    await supprimerPhotos([...piece!.photoIds, ...piece!.elements.flatMap(photosElement)])
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
      elements: piece!.elements.map(copieVierge),
    }
    modifier((e) => void e.pieces.splice(index + 1, 0, copie))
    navigate(`/edl/${edl!.id}/piece/${copie.id}`, { replace: true })
    setOuvert(undefined)
  }

  return (
    <LectureSeule.Provider value={verrouille}>
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

      {verrouille && (
        <div className="bandeau-signe">
          <Lock size={18} /> Signé — consultation seule, aucune modification possible.
        </div>
      )}
      {!verrouille && (
        <div className="actions-rapides">
          <button className="bouton bouton-accent bouton-dicter" onClick={() => setMemo(true)}>
            <Mic size={22} /> Dicter la pièce
          </button>
          {pr.faits < pr.total && (
            <button className="bouton bouton-discret bouton-tout-bon" onClick={toutEnBonEtat}>
              <CheckCheck size={20} /> Tout le reste en bon état ({pr.total - pr.faits})
            </button>
          )}
        </div>
      )}

      {memo && (
        <MemoPiece
          piece={piece}
          onFermer={() => setMemo(false)}
          onAppliquer={(a, retenues, general) => {
            majPiece((p) => appliquerAnalyse(p, a, retenues, general))
            setMemo(false)
            setOuvert(null)
          }}
        />
      )}

      {/* --- Éléments repris du précédent état des lieux, à confirmer --- */}
      {!verrouille && aConfirmer > 0 && (
        <div className="carte bandeau-visite" style={{ alignItems: 'center' }}>
          <History size={20} />
          <div style={{ flex: 1 }}>
            <strong>{aConfirmer} élément{aConfirmer > 1 ? 's' : ''} repris du précédent état des lieux, à confirmer</strong>
            <p className="texte-doux" style={{ margin: '4px 0 0' }}>
              Pour chacun : « Toujours le cas », ou corrigez l'état, les observations, les quantités.
            </p>
          </div>
          <button className="bouton bouton-discret bouton-petit" onClick={() => setConfirmerTout(true)}>
            <CheckCheck size={18} /> Tout confirmer
          </button>
        </div>
      )}
      <Confirmation
        ouvert={confirmerTout}
        titre="Tout confirmer dans cette pièce ?"
        message={<>Les {aConfirmer} élément{aConfirmer > 1 ? 's' : ''} non encore vérifié{aConfirmer > 1 ? 's' : ''} de « {piece.nom} » seront enregistrés <strong>dans le même état qu'au précédent état des lieux</strong>. Ne le faites qu'après avoir constaté que rien n'a changé.</>}
        libelleOk="Oui, tout est toujours le cas"
        onAnnuler={() => setConfirmerTout(false)}
        onOk={() => {
          majPiece((p) => p.elements.forEach((e) => void delete e.aConfirmer))
          setConfirmerTout(false)
        }}
      />

      {/* --- Éléments --- */}
      <div className="liste-elements">
        {piece.elements.map((el) => (
          <div key={el.id} ref={(n) => void (refs.current[el.id] = n)} className="ancre-element">
            <CarteElement
              element={el}
              entree={entree ? (entree.get(el.id) ?? elementDeReference(el) ?? null) : elementDeReference(el)}
              sourceEntree={el.reference && !entree?.get(el.id) && edl.referenceHistorique ? `État des lieux ${edl.referenceHistorique.source} du ${formatDate(edl.referenceHistorique.date)}` : undefined}
              ouvert={ouvert === el.id}
              verrouille={verrouille}
              commune={!!edl.commune}
              onBasculer={() => setOuvert(ouvert === el.id ? null : el.id)}
              maj={(f) => majElement(el.id, f)}
              onSuivant={() => elementSuivant(el.id)}
              onSupprimer={async () => {
                await supprimerPhotos(photosElement(el))
                majPiece((p) => void (p.elements = p.elements.filter((x) => x.id !== el.id)))
              }}
              traitement={traitement}
              onPhotos={(f, u) => ajouterPhotos(f, el, u)}
              onSupprimerPhoto={(pid, u) => supprimerPhoto(pid, el, u)}
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
        message={<MessageSuppressionPiece piece={piece} dansEntree={!!entree?.size && piece.elements.some((e) => entree.has(e.id))} />}
        libelleOk={constatsPiece(piece).constats + constatsPiece(piece).photos > 0 ? 'Supprimer la pièce et ses constatations' : 'Supprimer la pièce'}
        onAnnuler={() => setConfirmerSuppression(false)}
        onOk={supprimerPiece}
      />

      {ajout && (
        <AjoutElement
          onAnnuler={() => setAjout(false)}
          dejaPresents={piece.elements.map(genreDe).filter((g) => g !== undefined)}
          onAjouter={(el) => {
            majPiece((p) => void p.elements.push(el))
            setAjout(false)
            setOuvert(el.id)
          }}
        />
      )}
    </div>
    </LectureSeule.Provider>
  )
}

// =====================================================================
// Carte d'un élément
// =====================================================================

function CarteElement(props: {
  element: Element
  /** Sortie : élément à l'entrée (null = élément ajouté depuis l'entrée ; undefined = pas une sortie). */
  entree?: Element | null
  ouvert: boolean
  verrouille: boolean
  /** Visite commune : observations propres à la sortie ou à l'entrée. */
  commune?: boolean
  /** Origine de l'état précédent quand il vient d'un ancien état des lieux (PDF). */
  sourceEntree?: string
  onBasculer: () => void
  maj: (f: (el: Element) => void) => void
  onSuivant: () => void
  onSupprimer: () => void
  traitement: number
  onPhotos: (f: File[], uniteId?: string) => void
  onSupprimerPhoto: (id: string, uniteId?: string) => void
}) {
  const el = props.element
  // Toute saisie sur un élément repris vaut vérification sur place.
  const maj = (f: (x: Element) => void) =>
    props.maj((x) => {
      f(x)
      delete x.aConfirmer
    })
  const genre = genreDe(el)
  const clim = genre === 'climatisation'
  const etat = ETATS.find((e) => e.cle === el.etat)
  const fait = elementFait(el)
  const [confirmer, setConfirmer] = useState(false)
  const nombre = genre ? (el.quantite === undefined ? '' : texteNombre(genre, el.quantite) + (el.quantiteSource ? ' (à vérifier)' : '')) : ''
  const resume = [nombre, el.nature, ...el.observations, el.trousChevilles ? `${el.trousChevilles} trou(s) de cheville` : '', el.aNettoyer ? 'À nettoyer' : '']
    .filter(Boolean)
    .join(' · ')

  const basculer = (liste: 'observations', v: string) =>
    maj((e) => void (e[liste] = e[liste].includes(v) ? e[liste].filter((x) => x !== v) : [...e[liste], v]))

  return (
    <div className={`carte-element ${props.ouvert ? 'carte-element-ouverte' : ''} ${fait ? 'carte-element-faite' : ''}`}>
      <button className="carte-element-entete" onClick={props.onBasculer} aria-expanded={props.ouvert}>
        <span className="pastille-etat" style={{ background: etat?.couleur ?? 'transparent', borderColor: etat?.couleur ?? 'var(--trait)' }}>
          {etat ? etat.code : clim && fait ? '0' : ''}
        </span>
        <span className="carte-element-titre">
          <strong>{el.libelle}</strong>
          {!props.ouvert && (resume || etat) && (
            <span className="carte-element-resume">
              {etat?.libelle}
              {resume ? `${etat ? ' — ' : ''}${resume}` : ''}
            </span>
          )}
        </span>
        {el.aConfirmer && <span className="pastille-entree pastille-a-confirmer">À confirmer</span>}
        {props.entree !== undefined && <PastilleEntree entree={props.entree} sortie={el} source={props.sourceEntree} />}
        {photosElement(el).length > 0 && (
          <span className="compte-photos">
            <Camera size={15} /> {photosElement(el).length}
          </span>
        )}
        <ChevronDown className="chevron" />
      </button>

      {props.ouvert && (
        <fieldset className="carte-element-corps" disabled={props.verrouille}>
          {props.entree && <RappelEntree entree={props.entree} source={props.sourceEntree} />}
          {el.aConfirmer && (
            <div className="confirmer-reference">
              <p>
                Pré-rempli d'après le précédent état des lieux. Si rien n'a changé, confirmez ; sinon, corrigez ci-dessous.
              </p>
              <button
                type="button"
                className="bouton bouton-principal"
                onClick={() => {
                  maj(() => undefined)
                  props.onSuivant()
                }}
              >
                <Check size={20} /> Toujours le cas
              </button>
            </div>
          )}

          {/* Nombre (prises, interrupteurs, points lumineux, climatisations) */}
          {genre && <ChampNombre element={el} maj={maj} />}

          {/* Climatisation : une fiche par unité */}
          {clim && (
            <BlocUnites
              element={el}
              maj={maj}
              verrouille={props.verrouille}
              traitement={props.traitement}
              onPhotos={props.onPhotos}
              onSupprimerPhoto={props.onSupprimerPhoto}
            />
          )}

          {/* État */}
          {!clim && (
            <div className="bloc">
              <div className="bloc-titre">{genre ? 'État général' : 'État'}</div>
              <BoutonsEtat valeur={el.etat} onChange={(v) => maj((x) => void (x.etat = v))} />
            </div>
          )}

          {/* Fonctionnement */}
          {el.equipement && !clim && (
            <div className="bloc">
              <div className="bloc-titre">
                <Wrench size={16} /> Fonctionnement
              </div>
              <SegmentFonctionnement valeur={el.fonctionnement} onChange={(v) => maj((x) => void (x.fonctionnement = v))} />
            </div>
          )}

          {/* Nature */}
          {!clim && (
            <div className="bloc">
              <div className="bloc-titre">Nature / matériau</div>
              <Puces options={NATURES[el.categorie]} choisies={el.nature ? [el.nature] : []} onBasculer={(v) => maj((x) => void (x.nature = x.nature === v ? undefined : v))} />
            </div>
          )}

          {/* Observations */}
          <div className="bloc">
            <div className="bloc-titre">{genre ? 'Observations, dysfonctionnements' : 'Observations'}</div>
            <Puces options={OBSERVATIONS} choisies={el.observations} onBasculer={(v) => basculer('observations', v)} />
            {el.observations.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="bloc-sous-titre">Localisation</div>
                <Puces options={LOCALISATIONS} choisies={el.localisation ? [el.localisation] : []} onBasculer={(v) => maj((x) => void (x.localisation = x.localisation === v ? undefined : v))} />
              </div>
            )}
          </div>

          {!clim && (
            <div className="bloc bloc-ligne">
              <div className="ligne-compteur">
                <span>Trous de chevilles</span>
                <Compteur valeur={el.trousChevilles ?? 0} max={99} onChange={(v) => maj((x) => void (x.trousChevilles = v || undefined))} />
              </div>
              {!genre && (
                <div className="ligne-compteur">
                  <span>Quantité</span>
                  <Compteur valeur={el.quantite ?? 1} min={0} max={99} onChange={(v) => maj((x) => void (x.quantite = v === 1 ? undefined : v))} />
                </div>
              )}
            </div>
          )}
          <div className="bloc bloc-ligne">
            <Interrupteur libelle="À nettoyer" valeur={!!el.aNettoyer} onChange={(v) => maj((x) => void (x.aNettoyer = v || undefined))} />
            <Interrupteur libelle="Sous réserve" valeur={!!el.reserve} onChange={(v) => maj((x) => void (x.reserve = v || undefined))} />
          </div>

          <ChampCommentaire label={props.commune ? 'Commentaire (repris dans les deux documents)' : 'Commentaire'} valeur={el.commentaire} onChange={(v) => maj((x) => void (x.commentaire = v || undefined))} />
          {props.commune && (
            <details className="notes-propres" open={!!(el.noteSortie || el.noteEntree)}>
              <summary>Observations propres à un seul document (facultatif)</summary>
              <ChampCommentaire label="Propre à la sortie (ex. contestation du sortant)" valeur={el.noteSortie} onChange={(v) => maj((x) => void (x.noteSortie = v || undefined))} />
              <ChampCommentaire label="Réserve de l'entrant (uniquement dans l'entrée)" valeur={el.noteEntree} onChange={(v) => maj((x) => void (x.noteEntree = v || undefined))} />
            </details>
          )}

          {/* Photos */}
          <div className="bloc">
            <div className="bloc-titre">
              <Camera size={16} /> {clim ? 'Photos générales' : 'Photos'} {el.photoIds.length > 0 && `(${el.photoIds.length})`}
            </div>
            {!props.verrouille && <BoutonsPhoto onFichiers={(f) => props.onPhotos(f)} enCours={props.traitement} />}
            <GaleriePhotos ids={el.photoIds} onSupprimer={(pid) => props.onSupprimerPhoto(pid)} />
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
              {fait ? <Check size={20} /> : null} Élément suivant <ArrowRight size={20} />
            </button>
          </div>
        </fieldset>
      )}
    </div>
  )
}

function BoutonsEtat(props: { valeur?: Etat; onChange: (v: Etat | undefined) => void; compact?: boolean }) {
  return (
    <div className={`boutons-etat ${props.compact ? 'boutons-etat-compacts' : ''}`}>
      {ETATS.map((e) => (
        <button
          key={e.cle}
          type="button"
          className={`bouton-etat ${props.valeur === e.cle ? 'bouton-etat-actif' : ''}`}
          style={{ '--couleur': e.couleur } as React.CSSProperties}
          onClick={() => props.onChange(props.valeur === e.cle ? undefined : (e.cle as Etat))}
        >
          <span className="bouton-etat-code">{e.code}</span>
          <span className="bouton-etat-libelle">{e.libelle}</span>
        </button>
      ))}
    </div>
  )
}

function SegmentFonctionnement(props: { valeur?: Fonctionnement; onChange: (v: Fonctionnement | undefined) => void }) {
  return (
    <div className="segment segment-large">
      {(
        [
          ['ok', 'Testé OK'],
          ['defaillant', 'Défaillant'],
          ['non_teste', 'Non testé'],
        ] as [Fonctionnement, string][]
      ).map(([v, l]) => (
        <button key={v} type="button" className={props.valeur === v ? `segment-actif fonct-${v}` : ''} onClick={() => props.onChange(props.valeur === v ? undefined : v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

/**
 * Nombre d'un élément compté, avec trois situations bien distinctes :
 * non renseigné (—), aucun (0), nombre constaté. Un nombre repris de la fiche
 * ou de l'entrée est signalé « à vérifier » jusqu'à confirmation.
 */
function ChampNombre({ element: el, maj }: { element: Element; maj: (f: (el: Element) => void) => void }) {
  const genre = genreDe(el)!
  const g = GENRES[genre]
  const n = el.quantite
  const src = el.quantiteSource
  function fixer(v: number | undefined) {
    // Climatisation : on ne retire jamais une unité déjà renseignée par ce biais.
    const essai = structuredClone(el)
    if (!fixerNombre(essai, v)) {
      alert('Une unité déjà renseignée ne peut pas être retirée ainsi : utilisez « Retirer cette unité » sur sa fiche.')
      return
    }
    maj((x) => void fixerNombre(x, v))
  }
  const statut =
    n === undefined
      ? 'Non renseigné'
      : src
        ? `${texteNombre(genre, n)} — repris ${src === 'fiche' ? 'de la fiche du bien' : "de l'état des lieux d'entrée"}, à vérifier`
        : `${texteNombre(genre, n)} — constaté`
  return (
    <div className="bloc">
      <div className="bloc-titre">
        <Hash size={16} /> Nombre {genre === 'climatisation' ? "d'unités de climatisation" : `de ${g.unite[1]}`}
      </div>
      <div className="nombre-ligne">
        <div className="compteur" aria-label={`Nombre de ${g.unite[1]}`}>
          <button type="button" disabled={n === 0} onClick={() => fixer(n === undefined ? 0 : n - 1)} aria-label="Moins">
            <Minus size={20} />
          </button>
          <span className={n !== undefined ? 'compteur-actif' : 'compteur-vide'}>{n ?? '—'}</span>
          <button type="button" disabled={(n ?? 0) >= 99} onClick={() => fixer((n ?? 0) + 1)} aria-label="Plus">
            <Plus size={20} />
          </button>
        </div>
        <button type="button" className={`puce ${n === 0 && !src ? 'puce-active' : ''}`} onClick={() => fixer(0)}>
          {g.aucun}
        </button>
        {n !== undefined && (
          <button type="button" className="bouton bouton-discret bouton-petit" onClick={() => fixer(undefined)}>
            Non renseigné
          </button>
        )}
      </div>
      <p className={`nombre-statut ${n === undefined ? 'nombre-vide' : src ? 'nombre-a-verifier' : 'nombre-constate'}`}>{statut}</p>
      {src && (
        <button
          type="button"
          className="bouton bouton-accent bouton-petit"
          onClick={() =>
            maj((x) => {
              delete x.quantiteSource
              if (genre === 'climatisation') majSyntheseClim(x)
            })
          }
        >
          <Check size={18} /> Confirmer : {texteNombre(genre, n)}
        </button>
      )}
    </div>
  )
}

/** Climatisation : fiche de chaque unité (type, marque, état, fonctionnement, observations, photos). */
function BlocUnites(props: {
  element: Element
  maj: (f: (el: Element) => void) => void
  verrouille: boolean
  traitement: number
  onPhotos: (f: File[], uniteId?: string) => void
  onSupprimerPhoto: (id: string, uniteId?: string) => void
}) {
  const { element: el, maj } = props
  const unites = el.unites ?? []
  const [aRetirer, setARetirer] = useState<string>()
  const majUnite = (id: string, f: (u: UniteClim) => void) =>
    maj((x) => {
      const u = x.unites?.find((k) => k.id === id)
      if (!u) return
      f(u)
      // Renseigner une unité sur place vaut constat du nombre.
      delete x.quantiteSource
      majSyntheseClim(x)
    })
  async function retirer(u: UniteClim) {
    for (const pid of u.photoIds) props.onSupprimerPhoto(pid, u.id)
    maj((x) => {
      x.unites = (x.unites ?? []).filter((k) => k.id !== u.id)
      x.quantite = x.unites.length
      if (!x.unites.length) delete x.unites
      delete x.quantiteSource
      majSyntheseClim(x)
    })
    setARetirer(undefined)
  }
  if (!unites.length) return null
  const synthese = ETATS.find((e) => e.cle === el.etat)
  return (
    <div className="bloc">
      {unites.map((u, i) => (
        <div key={u.id} className="carte-unite">
          <div className="carte-unite-titre">
            <strong>Unité {i + 1}</strong>
            {u.etat && <span className="texte-doux"> — {ETATS.find((e) => e.cle === u.etat)?.libelle}</span>}
          </div>
          <div className="bloc-sous-titre">Type</div>
          <div className="segment">
            {(
              [
                [true, 'Réversible'],
                [false, 'Froid seul'],
              ] as [boolean, string][]
            ).map(([v, l]) => (
              <button key={l} type="button" className={u.reversible === v ? 'segment-actif' : ''} onClick={() => majUnite(u.id, (x) => void (x.reversible = x.reversible === v ? undefined : v))}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Champ label="Marque / modèle" valeur={u.marque} onChange={(v) => majUnite(u.id, (x) => void (x.marque = v || undefined))} placeholder="ex. Daikin FTXM25" />
          </div>
          <div className="bloc-sous-titre" style={{ marginTop: 12 }}>
            État apparent
          </div>
          <BoutonsEtat compact valeur={u.etat} onChange={(v) => majUnite(u.id, (x) => void (x.etat = v))} />
          <div className="bloc-sous-titre" style={{ marginTop: 12 }}>
            Fonctionnement constaté
          </div>
          <SegmentFonctionnement valeur={u.fonctionnement} onChange={(v) => majUnite(u.id, (x) => void (x.fonctionnement = v))} />
          <ChampCommentaire label="Observations" valeur={u.commentaire} onChange={(v) => majUnite(u.id, (x) => void (x.commentaire = v || undefined))} />
          <div className="bloc-sous-titre">
            <Camera size={14} /> Photos de l'unité {u.photoIds.length > 0 && `(${u.photoIds.length})`}
          </div>
          {!props.verrouille && <BoutonsPhoto onFichiers={(f) => props.onPhotos(f, u.id)} enCours={props.traitement} />}
          <GaleriePhotos ids={u.photoIds} onSupprimer={(pid) => props.onSupprimerPhoto(pid, u.id)} />
          {!props.verrouille && (
            <div className="carte-unite-pied">
              {aRetirer === u.id ? (
                <span className="confirmation-ligne">
                  {uniteVide(u) ? `Retirer l'unité ${i + 1} ?` : `Retirer l'unité ${i + 1} et ce qui a été saisi ?`}
                  <button type="button" className="bouton bouton-discret bouton-petit" onClick={() => setARetirer(undefined)}>
                    Non
                  </button>
                  <button type="button" className="bouton bouton-danger bouton-petit" onClick={() => retirer(u)}>
                    Retirer
                  </button>
                </span>
              ) : (
                <button type="button" className="bouton bouton-discret bouton-petit bouton-danger-texte" onClick={() => setARetirer(u.id)}>
                  <Trash2 size={16} /> Retirer cette unité
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      <p className="texte-doux">
        État d'ensemble : {synthese ? `${synthese.code} — ${synthese.libelle} (le moins bon des unités)` : 'à compléter sur chaque unité'}
      </p>
    </div>
  )
}

/** Avertissement avant de supprimer une pièce : ce qui sera perdu. */
function MessageSuppressionPiece({ piece, dansEntree }: { piece: TPiece; dansEntree: boolean }) {
  const { constats, photos } = constatsPiece(piece)
  return (
    <>
      {constats + photos === 0 ? (
        <p>Cette pièce ne contient encore aucune constatation.</p>
      ) : (
        <p>
          <strong>
            Attention : {constats > 0 && `${constats} élément${constats > 1 ? 's' : ''} déjà renseigné${constats > 1 ? 's' : ''}`}
            {constats > 0 && photos > 0 && ' et '}
            {photos > 0 && `${photos} photo${photos > 1 ? 's' : ''}`}
          </strong>{' '}
          seront définitivement effacés.
        </p>
      )}
      {dansEntree && <p>Cette pièce figure à l'état des lieux d'entrée : elle apparaîtra comme non constatée dans le comparatif.</p>}
      <p className="texte-doux">La fiche permanente du bien n'est pas modifiée.</p>
    </>
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
// Ajout d'un élément (élément compté en un geste, ou élément libre)
// =====================================================================

function AjoutElement(props: { onAnnuler: () => void; onAjouter: (el: Element) => void; dejaPresents: GenreElement[] }) {
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
      <div className="bloc-sous-titre">En un geste</div>
      <div className="puces">
        {ELEMENTS_COMPTES.map((d) => (
          <button key={d[0]} type="button" className="puce" onClick={() => props.onAjouter(creerElement(d))}>
            <Plus size={16} /> {d[0]}
            {props.dejaPresents.includes(d[3]!) ? ' (déjà présent)' : ''}
          </button>
        ))}
      </div>
      <div className="bloc-sous-titre" style={{ marginTop: 20 }}>
        Ou un autre élément
      </div>
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
        <button className="bouton bouton-principal" disabled={!libelle.trim()} onClick={() => props.onAjouter(creerElement([libelle.trim(), categorie, equipement]))}>
          <Plus size={20} /> Ajouter
        </button>
      </div>
    </dialog>
  )
}


/** Sortie : rappel de l'état d'entrée dans l'en-tête de l'élément, et alerte si l'état s'est dégradé. */
function PastilleEntree({ entree, sortie, source }: { entree: Element | null; sortie: Element; source?: string }) {
  if (entree === null) return <span className="pastille-entree pastille-nouveau">Nouveau</span>
  const e = ETATS.find((x) => x.cle === entree.etat)
  const evo = evolution(entree, sortie)
  return (
    <span className={`pastille-entree ${evo === 'degradation' ? 'pastille-degradation' : ''}`} title={source ?? "État à l'entrée"}>
      {source ? 'Avant' : 'Entrée'} : {e?.code ?? '—'}
      {evo === 'degradation' && ' ↘'}
    </span>
  )
}

/** Sortie : ce qui avait été constaté à l'entrée pour cet élément. */
function RappelEntree({ entree, source }: { entree: Element; source?: string }) {
  const e = ETATS.find((x) => x.cle === entree.etat)
  const g = genreDe(entree)
  const nombre = g && entree.quantite !== undefined ? texteNombre(g, entree.quantite) : ''
  const details = [nombre, entree.nature, ...entree.observations, entree.localisation, entree.commentaire].filter(Boolean).join(' · ')
  return (
    <div className="rappel-entree">
      <strong>{source ? `${source} :` : "À l'entrée :"}</strong> {e ? `${e.code} — ${e.libelle}` : 'non vérifié'}
      {details && <span> · {details}</span>}
      {entree.trousChevilles ? <span> · {entree.trousChevilles} trou(s) de cheville</span> : null}
      {entree.photoIds.length > 0 && <span> · {entree.photoIds.length} photo{entree.photoIds.length > 1 ? 's' : ''} (voir le rapport d'entrée)</span>}
    </div>
  )
}
