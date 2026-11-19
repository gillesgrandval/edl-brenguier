/* ------------------------------------------------------------------
   Visite commune : sortie d'un locataire et entrée du suivant, le même jour.

   Le logement est parcouru UNE fois, dans une fiche de travail (Edl avec
   `commune`), jamais signée. « Terminer la visite » la remplace par DEUX
   états des lieux ordinaires et indépendants :
     A. la sortie — locataire(s) sortant(s) et représentant du bailleur ;
     B. l'entrée — locataire(s) entrant(s) et représentant du bailleur.
   Chacun reçoit sa propre copie des constatations et des photos, puis se
   signe à part, avec sa propre empreinte.

   CONFIDENTIALITÉ : chaque document est construit uniquement avec ses
   propres parties. Les coordonnées du locataire de l'autre document n'y
   sont jamais copiées ; un contrôle automatique le vérifie avant tout
   enregistrement (verifierCloisonnement).
   ------------------------------------------------------------------ */

import { db, nouvelId } from './base'
import { journaliser } from './admin'
import { normaliser, prochaineReference } from './edl'
import { creerSortieDepuisEntree } from './sortie'
import { creerEdlDepuisBien } from './patrimoine'
import type { Bien, Edl, Personne } from './types'

/** Référence d'une visite commune, ex. « VC-2026-003 » (compteur distinct des états des lieux). */
export async function prochaineReferenceVisite(): Promise<string> {
  const annee = new Date().getFullYear()
  const cle = `compteur-vc-${annee}`
  return db.transaction('rw', db.meta, async () => {
    const n = (((await db.meta.get(cle))?.valeur as number | undefined) ?? 0) + 1
    await db.meta.put({ cle, valeur: n })
    return `VC-${annee}-${String(n).padStart(3, '0')}`
  })
}

/** Dernière entrée SIGNÉE d'un bien (hors corbeille et hors annulées) : la référence de la sortie. */
export async function entreePrecedente(bienId: string): Promise<Edl | undefined> {
  const annules = new Set((await db.annulations.toArray()).map((a) => a.edlId))
  return (await db.edls.where('bienId').equals(bienId).toArray())
    .filter((e) => e.typeActe === 'entree' && e.statut === 'signe' && !e.corbeille && !annules.has(e.id))
    .sort((a, b) => b.dateVisite.localeCompare(a.dateVisite))[0]
}

async function marquerCommune(id: string, dateVisite?: string): Promise<void> {
  const e = await db.edls.get(id)
  if (!e) return
  const commune: Edl = { ...e, typeActe: 'sortie', commune: { entrants: [{ id: nouvelId(), nom: '' }] } }
  if (dateVisite) commune.dateVisite = dateVisite
  await db.edls.put(commune)
}

/** Visite commune préparée depuis une entrée signée (comparatif sur chaque élément). */
export async function creerVisiteDepuisEntree(entree: Edl, dateVisite?: string): Promise<string> {
  const id = await creerSortieDepuisEntree(entree, await prochaineReferenceVisite())
  await marquerCommune(id, dateVisite)
  return id
}

/** Visite commune depuis la fiche d'un bien : avec l'entrée précédente si elle existe, sinon sans comparatif. */
export async function creerVisiteDepuisBien(bien: Bien, dateVisite: string): Promise<string> {
  const entree = await entreePrecedente(bien.id)
  if (entree) return creerVisiteDepuisEntree(entree, dateVisite)
  const id = await creerEdlDepuisBien(bien, dateVisite, await prochaineReferenceVisite())
  await marquerCommune(id)
  return id
}

// --- Séparation en deux documents -------------------------------------

const joindre = (...t: (string | undefined)[]) => t.map((x) => x?.trim()).filter(Boolean).join('\n') || undefined

/** Remplace chaque identifiant de photo (« photoIds ») selon la table donnée, partout dans l'objet. */
function renommerPhotos<T>(x: T, table: Map<string, string>): T {
  if (Array.isArray(x)) return x.map((v) => renommerPhotos(v, table)) as T
  if (x && typeof x === 'object') {
    const r: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(x)) r[k] = k === 'photoIds' && Array.isArray(v) ? v.map((p: string) => table.get(p) ?? p) : renommerPhotos(v, table)
    return r as T
  }
  return x
}

export interface ParametresScission {
  idSortie: string
  idEntree: string
  refSortie: string
  refEntree: string
  maintenant: string
  /** Ancien identifiant de photo → identifiant de sa copie dans chaque document. */
  photosSortie: Map<string, string>
  photosEntree: Map<string, string>
}

/**
 * Sépare une visite commune en deux états des lieux (fonction pure, sans base).
 * Seules les données propres à chaque document y sont reprises.
 */
export function scinderVisite(visite: Edl, p: ParametresScission): { sortie: Edl; entree: Edl } {
  const c = visite.commune
  if (!c) throw new Error("Ce n'est pas une visite commune.")
  const commun = structuredClone(visite)
  delete commun.commune
  delete commun.signataires
  delete commun.cloture
  delete commun.corbeille
  commun.statut = 'brouillon'
  commun.creeLe = p.maintenant
  commun.modifieLe = p.maintenant

  // A. Sortie : locataires sortants, observations propres à la sortie, clés restituées.
  const sortie = renommerPhotos(structuredClone(commun), p.photosSortie)
  sortie.id = p.idSortie
  sortie.reference = p.refSortie
  sortie.typeActe = 'sortie'
  sortie.locataires = structuredClone(visite.locataires)
  sortie.observationsGenerales = joindre(visite.observationsGenerales, c.observationsSortie)
  for (const piece of sortie.pieces)
    for (const el of piece.elements) {
      el.commentaire = joindre(el.commentaire, el.noteSortie)
      delete el.noteSortie
      delete el.noteEntree
    }
  for (const cle of sortie.cles ?? []) delete cle.nombreRemis
  sortie.issuDeVisite = { reference: visite.reference, autreId: p.idEntree, autreReference: p.refEntree }

  // B. Entrée : locataires entrants uniquement ; rien qui vienne du sortant ni de la sortie.
  const entree = renommerPhotos(structuredClone(commun), p.photosEntree)
  entree.id = p.idEntree
  entree.reference = p.refEntree
  entree.typeActe = 'entree'
  entree.locataires = structuredClone(c.entrants)
  entree.remarquesLocataire = c.remarquesEntrant
  if (!entree.remarquesLocataire) delete entree.remarquesLocataire
  entree.observationsGenerales = joindre(visite.observationsGenerales, c.observationsEntree)
  delete entree.nouvelleAdresseLocataire
  delete entree.edlEntreeId
  delete entree.degradations
  delete entree.grilleVetuste
  delete entree.dateRestitutionCles
  for (const piece of entree.pieces)
    for (const el of piece.elements) {
      el.commentaire = joindre(el.commentaire, el.noteEntree)
      delete el.noteSortie
      delete el.noteEntree
    }
  for (const cle of entree.cles ?? []) {
    cle.nombre = cle.nombreRemis ?? cle.nombre
    delete cle.nombreRemis
  }
  entree.issuDeVisite = { reference: visite.reference, autreId: p.idSortie, autreReference: p.refSortie }

  for (const d of [sortie, entree]) for (const k of Object.keys(d) as (keyof Edl)[]) if (d[k] === undefined) delete d[k]
  return { sortie, entree }
}

// --- Contrôle anti-fuite -----------------------------------------------

/** Champs dont la valeur est un code (pas un texte saisi) : ignorés par le contrôle. */
const CODES = new Set(['id', 'etat', 'fonctionnement', 'categorie', 'modele', 'genre', 'type', 'typeActe', 'typeBien', 'statut', 'mode', 'presence', 'serrure', 'quantiteSource', 'role', 'autreId', 'edlEntreeId', 'bienId', 'personneId', 'signatureId', 'entiteId', 'creeLe', 'modifieLe', 'dateVisite'])

/** Rubriques d'un document, pour dire à l'opérateur OÙ se trouve un texte. */
const RUBRIQUE: Record<string, string> = {
  bien: 'Le bien',
  bailleur: 'Bailleur',
  operateur: 'Représentant du bailleur',
  mandataire: 'Mandataire',
  locataires: 'Locataires',
  observationsGenerales: 'Observations générales',
  remarquesLocataire: 'Remarques du locataire',
  compteurs: 'Compteurs',
  cles: 'Clés',
  detecteur: 'Détecteur de fumée',
  boiteAuxLettres: 'Boîte aux lettres',
  degradations: 'Comparatif (dégradations)',
  lieuSignature: 'Lieu de signature',
}

/** Tous les textes saisis d'un document (hors codes et identifiants), avec leur emplacement. */
function textes(doc: Edl): { texte: string; ou: string }[] {
  const r: { texte: string; ou: string }[] = []
  const parcourir = (x: unknown, cle: string, ou: string) => {
    if (typeof x === 'string') {
      if (!CODES.has(cle) && !cle.endsWith('Ids')) r.push({ texte: x, ou })
    } else if (Array.isArray(x)) x.forEach((v) => parcourir(v, cle, ou))
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) parcourir(v, k, ou)
  }
  for (const [k, v] of Object.entries(doc)) {
    if (k === 'pieces') {
      for (const p of doc.pieces) {
        parcourir({ nom: p.nom, dimensions: p.dimensions, commentaire: p.commentaire }, '', p.nom)
        for (const el of p.elements) parcourir(el, '', `${p.nom} › ${el.libelle}`)
      }
    } else parcourir(v, k, RUBRIQUE[k] ?? 'Informations générales')
  }
  return r
}

const chiffres = (s: string) => s.replace(/\D/g, '')
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Données personnelles d'une personne, avec leur libellé. */
function donnees(p: Personne): [string, string][] {
  return (
    [
      ['nom', p.nom],
      ['prénom', p.prenom],
      ['téléphone', p.telephone],
      ['e-mail', p.email],
    ] as [string, string | undefined][]
  ).filter((d): d is [string, string] => !!d[1] && d[1].trim().length >= 2)
}

/**
 * Donnée d'un autre locataire retrouvée dans un document.
 * `certaine` : téléphone, e-mail ou adresse (bloquant). Un nom ou un prénom peut
 * aussi être un mot courant (« Port », « Sol ») : à vérifier puis confirmer.
 */
export interface Fuite {
  texte: string
  certaine: boolean
  /** Où le texte a été trouvé (ex. « Séjour › Murs », « Observations générales »). */
  ou?: string
}

/** Recherche dans un document les données d'autres personnes. Renvoie les fuites trouvées (vide = conforme). */
export function rechercherDonnees(doc: Edl, personnes: Personne[], autres: [string, string][] = []): Fuite[] {
  const corpus = textes(doc).map((x) => ({ ...x, normal: sansAccents(x.texte), chiffres: chiffres(x.texte) }))
  const fuites: Fuite[] = []
  const lieux = (test: (x: (typeof corpus)[number]) => boolean) => [...new Set(corpus.filter(test).map((x) => x.ou))].join(', ')
  for (const p of personnes) {
    const qui = [p.prenom, p.nom].filter(Boolean).join(' ').trim() || 'locataire'
    for (const [libelle, valeur] of donnees(p)) {
      const motif = new RegExp(`(^|[^a-z0-9])${sansAccents(valeur.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`)
      const ou =
        libelle === 'téléphone' ? (chiffres(valeur).length >= 6 ? lieux((x) => x.chiffres.includes(chiffres(valeur))) : '') : lieux((x) => motif.test(x.normal))
      if (ou) fuites.push({ texte: `${libelle} de ${qui}`, certaine: libelle === 'téléphone' || libelle === 'e-mail', ou })
    }
  }
  for (const [libelle, valeur] of autres) {
    const ou = valeur.trim().length >= 4 ? lieux((x) => x.normal.includes(sansAccents(valeur.trim()))) : ''
    if (ou) fuites.push({ texte: libelle, certaine: true, ou })
  }
  return fuites
}

/** Vérifie que chaque document ne contient aucune donnée personnelle du locataire de l'autre. */
export function verifierCloisonnement(visite: Edl, sortie: Edl, entree: Edl): { dansSortie: Fuite[]; dansEntree: Fuite[] } {
  const entrants = visite.commune?.entrants ?? []
  return {
    dansSortie: rechercherDonnees(sortie, entrants),
    dansEntree: rechercherDonnees(entree, visite.locataires, visite.nouvelleAdresseLocataire ? [['nouvelle adresse du locataire sortant', visite.nouvelleAdresseLocataire]] : []),
  }
}

/** Ce qui reste à compléter avant de terminer la visite (jamais bloquant, sauf les parties). */
export function preparationVisite(v: Edl): { bloquants: string[]; rappels: string[] } {
  const bloquants: string[] = []
  const rappels: string[] = []
  if (!v.locataires.some((l) => l.nom.trim())) bloquants.push('Locataire sortant (nom)')
  if (!v.commune?.entrants.some((l) => l.nom.trim())) bloquants.push('Locataire entrant (nom)')
  if (!v.operateur.nom.trim()) bloquants.push('Représentant du bailleur (nom)')
  if (!v.nouvelleAdresseLocataire?.trim()) rappels.push('Nouvelle adresse du locataire sortant')
  return { bloquants, rappels }
}

/** Simulation de la séparation, sans rien enregistrer (pour le contrôle affiché avant de terminer). */
export function simulerScission(v: Edl) {
  const vide = new Map<string, string>()
  const docs = scinderVisite(v, { idSortie: 'A', idEntree: 'B', refSortie: 'A', refEntree: 'B', maintenant: '', photosSortie: vide, photosEntree: vide })
  return { ...docs, ...verifierCloisonnement(v, docs.sortie, docs.entree) }
}

/**
 * Termine la visite : crée les deux états des lieux (copies des photos comprises),
 * vérifie le cloisonnement, puis retire la fiche de travail. Tout ou rien.
 * `nomsVerifies` : l'opérateur a vérifié qu'un nom signalé est un mot courant, pas une donnée du locataire.
 */
export async function terminerVisite(id: string, nomsVerifies = false): Promise<{ idSortie: string; idEntree: string }> {
  const brut = await db.edls.get(id)
  if (!brut?.commune) throw new Error('Visite commune introuvable.')
  if (brut.statut === 'signe') throw new Error('Visite déjà signée.')
  const visite = normaliser(brut)
  const { bloquants } = preparationVisite(visite)
  if (bloquants.length) throw new Error(`À compléter d'abord : ${bloquants.join(', ')}.`)

  const photos = await db.photos.where('edlId').equals(id).toArray()
  const photosSortie = new Map(photos.map((ph) => [ph.id, nouvelId()]))
  const photosEntree = new Map(photos.map((ph) => [ph.id, nouvelId()]))
  const idSortie = nouvelId()
  const idEntree = nouvelId()

  const { dansSortie, dansEntree } = simulerScission(visite)
  const bloquantes = [...dansSortie.map((f) => ({ ...f, ou: 'la sortie' })), ...dansEntree.map((f) => ({ ...f, ou: "l'entrée" }))].filter((f) => f.certaine || !nomsVerifies)
  if (bloquantes.length)
    throw new Error(`Contrôle de confidentialité : ${bloquantes.map((f) => `${f.texte} trouvé dans ${f.ou}`).join(' ; ')}. Retirez-le des textes communs, puis recommencez.`)

  const refSortie = await prochaineReference()
  const refEntree = await prochaineReference()
  const maintenant = new Date().toISOString()
  const { sortie, entree } = scinderVisite(visite, { idSortie, idEntree, refSortie, refEntree, maintenant, photosSortie, photosEntree })
  // Second contrôle, sur les documents réellement enregistrés.
  const controle = verifierCloisonnement(visite, sortie, entree)
  if ([...controle.dansSortie, ...controle.dansEntree].some((f) => f.certaine || !nomsVerifies)) throw new Error('Contrôle de confidentialité non satisfait.')

  await db.transaction('rw', [db.edls, db.photos, db.meta, db.journal], async () => {
    const dernierNumero = (((await db.meta.get(`photos-${id}`))?.valeur as number | undefined) ?? 0) || Math.max(0, ...photos.map((ph) => ph.numero))
    await db.photos.bulkAdd([
      ...photos.map((ph) => ({ ...ph, id: photosSortie.get(ph.id)!, edlId: idSortie })),
      ...photos.map((ph) => ({ ...ph, id: photosEntree.get(ph.id)!, edlId: idEntree })),
    ])
    // Les nouvelles photos de chaque document poursuivent la numérotation de la visite.
    await db.meta.bulkPut([
      { cle: `photos-${idSortie}`, valeur: dernierNumero },
      { cle: `photos-${idEntree}`, valeur: dernierNumero },
    ])
    await db.edls.bulkAdd([sortie, entree])
    await db.photos.where('edlId').equals(id).delete()
    await db.meta.delete(`photos-${id}`)
    await db.edls.delete(id)
    await journaliser('visite_terminee', `${visite.reference} → sortie ${refSortie} et entrée ${refEntree} · ${[visite.bien.lot ? `Lot ${visite.bien.lot}` : '', visite.bien.adresse, visite.bien.ville].filter(Boolean).join(', ')}`)
  })
  return { idSortie, idEntree }
}
