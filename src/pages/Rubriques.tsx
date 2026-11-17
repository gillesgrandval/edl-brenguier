import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlarmSmoke, ArrowLeft, Camera, Check, CircleAlert, Gauge, KeyRound, MessageSquareText, Plus, ScanLine, Trash2, Wrench } from 'lucide-react'
import { useEdl } from '../hooks/useEdl'
import { db, nouvelId } from '../db/base'
import { compteurFait, maintenantLocal } from '../db/edl'
import { consommation } from '../db/sortie'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Edl, Fonctionnement, ReleveCompteur, TypeCompteur } from '../db/types'
import { enregistrerPhoto, supprimerPhotos } from '../photos/traitement'
import { Champ, Compteur, Interrupteur, Tuiles, Verrou } from '../components/ui'
import { BoutonsPhoto, GaleriePhotos } from '../components/Photos'
import { BoutonDictee } from '../components/Dictee'
import Chargement from '../components/Chargement'
import LecteurIndex from '../components/LecteurIndex'

/* Rubriques transversales : compteurs, clés, détecteur de fumée, observations générales. */

type Modifier = (f: (e: Edl) => void) => void

function useRubrique() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ctx = useEdl(id)
  const [traitement, setTraitement] = useState(0)

  /** Ajoute des photos et renvoie leurs identifiants dans l'ordre. */
  async function photos(fichiers: File[], pieceNom: string, elementNom: string, ajouter: (ids: string) => void) {
    if (!ctx.edl) return
    setTraitement(fichiers.length)
    try {
      for (const f of fichiers) {
        const { id: pid } = await enregistrerPhoto({ fichier: f, edlId: ctx.edl.id, reference: ctx.edl.reference, pieceNom, elementNom })
        ajouter(pid)
        setTraitement((n) => n - 1)
      }
    } catch (err) {
      alert("La photo n'a pas pu être enregistrée : " + (err as Error).message)
    } finally {
      setTraitement(0)
    }
  }
  // Sortie : état des lieux d'entrée (index des compteurs, clés remises).
  const idEntree = ctx.edl?.edlEntreeId
  const entree = useLiveQuery(async () => (idEntree ? ((await db.edls.get(idEntree)) ?? null) : null), [idEntree])
  return { ...ctx, navigate, traitement, photos, entree }
}

function Entete(props: { titre: string; icone: ReactNode; edl: Edl; sauvegarde: string; children?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="piece-entete">
      <button className="bouton-icone" onClick={() => navigate(`/edl/${props.edl.id}`)} aria-label="Retour au tableau de bord">
        <ArrowLeft />
      </button>
      <div className="piece-entete-titre">
        <div className="titre-modifiable">
          {props.icone}
          <h1>{props.titre}</h1>
        </div>
        <div className="piece-entete-progression">
          {props.children}
          <span className={`indicateur-sauvegarde ${props.sauvegarde}`}>{props.sauvegarde === 'ok' ? 'Enregistré' : '…'}</span>
        </div>
      </div>
    </div>
  )
}

function Statut({ ok, texteOk, texteAttente }: { ok: boolean; texteOk: string; texteAttente: string }) {
  return ok ? (
    <span className="statut-rubrique statut-ok">
      <Check size={15} strokeWidth={3} /> {texteOk}
    </span>
  ) : (
    <span className="statut-rubrique statut-attente">
      <CircleAlert size={15} /> {texteAttente}
    </span>
  )
}

function Commentaire(props: { label: string; valeur?: string; onChange: (v: string) => void; lignes?: number; placeholder?: string }) {
  return (
    <div className="bloc">
      <div className="bloc-titre">
        <MessageSquareText size={16} /> {props.label}
        <BoutonDictee onTexte={(t) => props.onChange(props.valeur ? `${props.valeur} ${t}` : t)} />
      </div>
      <textarea className="saisie" rows={props.lignes ?? 2} value={props.valeur ?? ''} placeholder={props.placeholder ?? 'Saisir ou dicter…'} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  )
}

/** Sortie : index relevé à l'entrée et consommation depuis. */
function RappelIndex({ entree, sortie, unite }: { entree?: ReleveCompteur; sortie: ReleveCompteur; unite: string }) {
  if (!entree || entree.nonApplicable) return null
  const conso = consommation(entree.index, sortie.index)
  const consoHC = consommation(entree.indexHC, sortie.indexHC)
  return (
    <div className="rappel-entree" style={{ gridColumn: '1 / -1' }}>
      <strong>À l'entrée :</strong> {entree.index ? `${entree.index} ${unite}` : 'non relevé'}
      {entree.indexHC ? ` · HC ${entree.indexHC}` : ''}
      {conso !== undefined && <> · <strong>Consommation : {conso.toLocaleString('fr-FR')} {unite}</strong></>}
      {consoHC !== undefined && <> · HC : {consoHC.toLocaleString('fr-FR')} {unite}</>}
      {conso !== undefined && conso < 0 && <span className="texte-erreur"> Index de sortie inférieur à l'entrée : à vérifier.</span>}
    </div>
  )
}

// =====================================================================
// Compteurs
// =====================================================================

const NUMERO: Record<TypeCompteur, string> = {
  electricite: 'N° PDL (14 chiffres)',
  gaz: 'N° PCE',
  eau_froide: 'N° de compteur',
  eau_chaude: 'N° de compteur',
  autre: 'N° de compteur',
}
/** Saisie d'un index : la date du relevé est notée automatiquement (modifiable). */
function indexSaisi(x: ReleveCompteur, champ: 'index' | 'indexHC', v: string) {
  x[champ] = v
  if (v.trim() && !x.dateReleve) x.dateReleve = maintenantLocal()
}

const UNITE: Record<TypeCompteur, string> = { electricite: 'kWh', gaz: 'm³', eau_froide: 'm³', eau_chaude: 'm³', autre: '' }

export function Compteurs() {
  const r = useRubrique()
  const [lecteur, setLecteur] = useState<{ photoId: string; compteurId: string } | null>(null)
  if (r.edl === undefined) return <Chargement />
  if (!r.edl) return <Chargement introuvable />
  const edl = r.edl
  const liste = edl.compteurs ?? []
  const faits = liste.filter(compteurFait).length
  const maj = (cid: string, f: (c: ReleveCompteur) => void) =>
    r.modifier((e) => {
      const c = e.compteurs?.find((x) => x.id === cid)
      if (c) f(c)
    })

  return (
    <div className="saisie-piece">
      <Entete titre="Compteurs" icone={<Gauge size={24} />} edl={edl} sauvegarde={r.sauvegarde}>
        <span>
          {faits}/{liste.length} relevés
        </span>
      </Entete>
      <Verrou actif={edl.statut === 'signe'} signeLe={edl.cloture?.signeLe}>
      <p className="texte-doux" style={{ marginTop: 0 }}>
        Pour chaque compteur : numéro, index et <strong>photo de l'index</strong> (obligatoire pour valider). Indiquez « Pas de compteur » s'il n'existe pas.
      </p>

      {liste.map((c) => (
        <section key={c.id} className={`carte rubrique-carte ${c.nonApplicable ? 'rubrique-carte-na' : ''}`}>
          <div className="rubrique-carte-entete">
            {c.type === 'autre' ? (
              <input className="saisie saisie-titre" value={c.libelle} onChange={(e) => maj(c.id, (x) => void (x.libelle = e.target.value))} />
            ) : (
              <h2>{c.libelle}</h2>
            )}
            {c.nonApplicable ? (
              <span className="statut-rubrique statut-ok">Sans objet</span>
            ) : (
              <Statut ok={compteurFait(c)} texteOk="Relevé" texteAttente={c.index?.trim() ? 'Photo manquante' : 'À effectuer'} />
            )}
          </div>
          <Interrupteur libelle="Pas de compteur / sans objet" valeur={!!c.nonApplicable} onChange={(v) => maj(c.id, (x) => void (x.nonApplicable = v || undefined))} />
          {!c.nonApplicable && (
            <>
              <div className="grille grille-3" style={{ marginTop: 14 }}>
                <Champ label={NUMERO[c.type]} valeur={c.numero} onChange={(v) => maj(c.id, (x) => void (x.numero = v))} inputMode={c.type === 'electricite' ? 'numeric' : 'text'} />
                <Champ
                  label={c.type === 'electricite' ? `Index HP / base (${UNITE[c.type]})` : `Index${UNITE[c.type] ? ` (${UNITE[c.type]})` : ''}`}
                  valeur={c.index}
                  onChange={(v) => maj(c.id, (x) => indexSaisi(x, 'index', v))}
                  inputMode="decimal"
                />
                <Champ
                  type="datetime-local"
                  label="Date du relevé"
                  valeur={c.dateReleve}
                  onChange={(v) => maj(c.id, (x) => void (x.dateReleve = v || undefined))}
                  aide={c.dateReleve ? undefined : 'Remplie automatiquement à la saisie de l’index'}
                />
                {r.entree && <RappelIndex entree={r.entree.compteurs?.find((x) => x.id === c.id || x.type === c.type)} sortie={c} unite={UNITE[c.type]} />}
                {c.type === 'electricite' && <Champ label="Index HC (kWh)" valeur={c.indexHC} onChange={(v) => maj(c.id, (x) => indexSaisi(x, 'indexHC', v))} inputMode="decimal" aide="Heures creuses, si double tarif" />}
              </div>
              <div className="bloc">
                <div className="bloc-titre">
                  <Camera size={16} /> Photo de l'index
                </div>
                <BoutonsPhoto
                  enCours={r.traitement}
                  onFichiers={async (f) => {
                    let derniere: string | undefined
                    await r.photos(f, 'Compteurs', c.libelle, (pid) => {
                      derniere = pid
                      maj(c.id, (x) => void x.photoIds.push(pid))
                    })
                    // Lecture automatique de l'index dès la photo prise.
                    if (derniere) setLecteur({ photoId: derniere, compteurId: c.id })
                  }}
                />
                {c.photoIds.length > 0 && edl.statut !== 'signe' && (
                  <button className="bouton bouton-discret bouton-lire" onClick={() => setLecteur({ photoId: c.photoIds[c.photoIds.length - 1], compteurId: c.id })}>
                    <ScanLine size={20} /> Lire l'index sur la photo
                  </button>
                )}
                <GaleriePhotos
                  ids={c.photoIds}
                  onSupprimer={async (pid) => {
                    await supprimerPhotos([pid])
                    maj(c.id, (x) => void (x.photoIds = x.photoIds.filter((y) => y !== pid)))
                  }}
                />
              </div>
              <Commentaire label="Commentaire" valeur={c.commentaire} onChange={(v) => maj(c.id, (x) => void (x.commentaire = v || undefined))} />
            </>
          )}
          {c.type === 'autre' && (
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <button
                className="bouton bouton-discret bouton-petit bouton-danger-texte"
                onClick={async () => {
                  await supprimerPhotos(c.photoIds)
                  r.modifier((e) => void (e.compteurs = e.compteurs?.filter((x) => x.id !== c.id)))
                }}
              >
                <Trash2 size={18} /> Retirer ce compteur
              </button>
            </div>
          )}
        </section>
      ))}

      {lecteur && (
        <LecteurIndex
          photoId={lecteur.photoId}
          compteur={liste.find((c) => c.id === lecteur.compteurId)!}
          onFermer={() => setLecteur(null)}
          onValider={(champ, valeur) => {
            maj(lecteur.compteurId, (x) => indexSaisi(x, champ, valeur))
            setLecteur(null)
          }}
        />
      )}

      <button
        className="bouton bouton-discret bouton-ajout"
        onClick={() => r.modifier((e) => void e.compteurs?.push({ id: nouvelId(), type: 'autre', libelle: 'Sous-compteur', photoIds: [] }))}
      >
        <Plus size={20} /> Ajouter un compteur (sous-compteur, compteur d'eau divisionnaire…)
      </button>
      </Verrou>
    </div>
  )
}

// =====================================================================
// Clés
// =====================================================================

export function Cles() {
  const r = useRubrique()
  if (r.edl === undefined) return <Chargement />
  if (!r.edl) return <Chargement introuvable />
  const edl = r.edl
  const cles = edl.cles ?? []
  const total = cles.reduce((n, c) => n + c.nombre, 0)
  const maj = (cid: string, f: (c: (typeof cles)[number]) => void) =>
    r.modifier((e) => {
      const c = e.cles?.find((x) => x.id === cid)
      if (c) f(c)
    })

  return (
    <div className="saisie-piece">
      <Entete titre="Clés, badges et télécommandes" icone={<KeyRound size={24} />} edl={edl} sauvegarde={r.sauvegarde}>
        <span>
          {total} remis{total > 1 ? 'es' : 'e'}
        </span>
      </Entete>
      <Verrou actif={edl.statut === 'signe'} signeLe={edl.cloture?.signeLe}>

      {edl.typeActe === 'sortie' && (
        <section className="carte rubrique-carte">
          <div className="grille">
            <Champ type="datetime-local" label="Date de restitution des clés" valeur={edl.dateRestitutionCles} onChange={(v) => r.modifier((e) => void (e.dateRestitutionCles = v))} />
          </div>
        </section>
      )}

      <section className="carte rubrique-carte">
        {cles.map((c) => (
          <div key={c.id} className="ligne-cle">
            <input className="saisie" value={c.libelle} onChange={(e) => maj(c.id, (x) => void (x.libelle = e.target.value))} aria-label="Désignation" />
            <Compteur valeur={c.nombre} max={50} onChange={(v) => maj(c.id, (x) => void (x.nombre = v))} libelle={c.libelle} />
            {r.entree && (() => {
              const remis = r.entree.cles?.find((x) => x.id === c.id)?.nombre
              return remis !== undefined ? <span className={`pastille-entree ${c.nombre < remis ? 'pastille-degradation' : ''}`}>Remis à l'entrée : {remis}</span> : null
            })()}
            <button
              className="bouton-icone"
              aria-label="Retirer"
              onClick={async () => {
                await supprimerPhotos(c.photoIds)
                r.modifier((e) => void (e.cles = e.cles?.filter((x) => x.id !== c.id)))
              }}
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
        <button className="bouton bouton-discret bouton-ajout" onClick={() => r.modifier((e) => void e.cles?.push({ id: nouvelId(), libelle: '', nombre: 1, photoIds: [] }))}>
          <Plus size={20} /> Ajouter une ligne (cave, garage, portail…)
        </button>
      </section>

      <section className="carte rubrique-carte">
        <div className="bloc-titre">
          <Camera size={16} /> Photo du trousseau
        </div>
        <BoutonsPhoto
          enCours={r.traitement}
          onFichiers={(f) =>
            r.photos(f, 'Clés', 'Trousseau', (pid) =>
              r.modifier((e) => {
                const premiere = e.cles?.[0]
                if (premiere) premiere.photoIds.push(pid)
              }),
            )
          }
        />
        <GaleriePhotos
          ids={cles.flatMap((c) => c.photoIds)}
          onSupprimer={async (pid) => {
            await supprimerPhotos([pid])
            r.modifier((e) => e.cles?.forEach((c) => void (c.photoIds = c.photoIds.filter((y) => y !== pid))))
          }}
        />
        <Commentaire
          label="Commentaire"
          valeur={cles[0]?.commentaire}
          placeholder="ex. 1 clé de boîte aux lettres non fournie, badge testé OK…"
          onChange={(v) =>
            r.modifier((e) => {
              if (e.cles?.[0]) e.cles[0].commentaire = v || undefined
            })
          }
        />
      </section>
      </Verrou>
    </div>
  )
}

// =====================================================================
// Détecteur de fumée
// =====================================================================

export function Detecteur() {
  const r = useRubrique()
  if (r.edl === undefined) return <Chargement />
  if (!r.edl) return <Chargement introuvable />
  const edl = r.edl
  const d = edl.detecteur ?? { photoIds: [] }
  const maj = (f: (x: NonNullable<Edl['detecteur']>) => void) =>
    r.modifier((e) => {
      e.detecteur ??= { photoIds: [] }
      f(e.detecteur)
    })
  const fait = d.present === false || !!d.fonctionnement

  return (
    <div className="saisie-piece">
      <Entete titre="Détecteur de fumée" icone={<AlarmSmoke size={24} />} edl={edl} sauvegarde={r.sauvegarde}>
        <Statut ok={fait} texteOk="Renseigné" texteAttente="À renseigner" />
      </Entete>
      <Verrou actif={edl.statut === 'signe'} signeLe={edl.cloture?.signeLe}>
      <section className="carte rubrique-carte">
        <div className="bloc-titre">Présence</div>
        <Tuiles<'oui' | 'non'>
          colonnes={2}
          valeur={d.present === undefined ? undefined : d.present ? 'oui' : 'non'}
          onChange={(v) => maj((x) => void (x.present = v === 'oui'))}
          options={[
            { valeur: 'oui', libelle: 'Présent', icone: <Check size={26} /> },
            { valeur: 'non', libelle: 'Absent', icone: <CircleAlert size={26} /> },
          ]}
        />
        {d.present && (
          <div className="bloc">
            <div className="bloc-titre">
              <Wrench size={16} /> Test (bouton du détecteur)
            </div>
            <div className="segment segment-large">
              {(
                [
                  ['ok', 'Testé OK'],
                  ['defaillant', 'Défaillant'],
                  ['non_teste', 'Non testé'],
                ] as [Fonctionnement, string][]
              ).map(([v, l]) => (
                <button key={v} className={d.fonctionnement === v ? `segment-actif fonct-${v}` : ''} onClick={() => maj((x) => void (x.fonctionnement = v))}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="bloc">
          <div className="bloc-titre">
            <Camera size={16} /> Photo
          </div>
          <BoutonsPhoto enCours={r.traitement} onFichiers={(f) => r.photos(f, 'Détecteur de fumée', 'Détecteur', (pid) => maj((x) => void x.photoIds.push(pid)))} />
          <GaleriePhotos
            ids={d.photoIds}
            onSupprimer={async (pid) => {
              await supprimerPhotos([pid])
              maj((x) => void (x.photoIds = x.photoIds.filter((y) => y !== pid)))
            }}
          />
        </div>
        <Commentaire label="Commentaire" valeur={d.commentaire} placeholder="Emplacement, date de la pile…" onChange={(v) => maj((x) => void (x.commentaire = v || undefined))} />
      </section>
      </Verrou>
    </div>
  )
}

// =====================================================================
// Observations générales
// =====================================================================

export function Observations() {
  const r = useRubrique()
  if (r.edl === undefined) return <Chargement />
  if (!r.edl) return <Chargement introuvable />
  const edl = r.edl as Edl
  const modifier: Modifier = r.modifier
  return (
    <div className="saisie-piece">
      <Entete titre="Observations générales" icone={<MessageSquareText size={24} />} edl={edl} sauvegarde={r.sauvegarde} />
      <Verrou actif={edl.statut === 'signe'} signeLe={edl.cloture?.signeLe}>
      <section className="carte rubrique-carte">
        <Commentaire
          label="Observations de l'opérateur"
          lignes={6}
          valeur={edl.observationsGenerales}
          placeholder="État général du bien, propreté, points d'attention, travaux prévus…"
          onChange={(v) => modifier((e) => void (e.observationsGenerales = v || undefined))}
        />
        <Commentaire
          label={edl.typeBien === 'local' ? 'Remarques du preneur' : 'Remarques du locataire'}
          lignes={4}
          valeur={edl.remarquesLocataire}
          placeholder="Réserves ou remarques que le locataire souhaite faire figurer."
          onChange={(v) => modifier((e) => void (e.remarquesLocataire = v || undefined))}
        />
      </section>
      </Verrou>
    </div>
  )
}
