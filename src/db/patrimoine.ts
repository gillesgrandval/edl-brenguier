/* ------------------------------------------------------------------
   Patrimoine immobilier : fiches permanentes des biens, création
   d'un état des lieux prérempli à partir d'un bien, et import d'un
   fichier de préparation (reçu par e-mail, jamais publié en ligne).
   ------------------------------------------------------------------ */

import { db, nouvelId } from './base'
import { normaliser, prochaineReference } from './edl'
import type { Bien, CategorieBien, Edl, ReleveCompteur, TypeBien, TypeCompteur } from './types'
import { creerPiecesDepuisBien } from '../modeles/pieces'

export const LIBELLE_CATEGORIE: Record<CategorieBien, string> = {
  appartement: 'Appartement',
  villa: 'Villa',
  maison: 'Maison',
  immeuble: 'Immeuble',
  entrepot: 'Entrepôt',
  local_commercial: 'Local commercial',
  mobil_home: 'Mobil-home',
  autre: 'Autre',
}

/** Type de bien utilisé par l'état des lieux (modèles de pièces, mentions légales). */
export function typeBienEdl(c: CategorieBien): TypeBien {
  if (c === 'entrepot' || c === 'local_commercial') return 'local'
  if (c === 'villa' || c === 'maison' || c === 'mobil_home') return 'maison'
  return 'appartement'
}

const LIBELLE_COMPTEUR: Record<TypeCompteur, string> = {
  electricite: 'Électricité',
  gaz: 'Gaz',
  eau_froide: 'Eau',
  eau_chaude: 'Eau chaude',
  autre: 'Autre compteur',
}

/** Libellé court d'un bien : « Lot n° 5 · 1029 route des Vieux Salins, Hyères ». */
export function libelleBien(b: Bien): string {
  return [b.reference || (b.lot ? `Lot ${b.lot}` : ''), [b.adresse, b.ville].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
}

/**
 * Prépare un état des lieux (brouillon) à partir d'une fiche du patrimoine.
 * Seules les informations connues sont reprises : locataire, type d'acte et heure
 * restent à compléter. Les équipements sont ajoutés SANS état (à vérifier sur place).
 */
export async function creerEdlDepuisBien(bien: Bien, dateVisite: string): Promise<string> {
  const maintenant = new Date().toISOString()
  const dernier = await db.edls.orderBy('modifieLe').last()
  const typeBien = typeBienEdl(bien.categorie)
  const compteurs: ReleveCompteur[] = bien.compteurs.map((type) => ({ id: nouvelId(), type, libelle: LIBELLE_COMPTEUR[type], photoIds: [] }))
  const edl: Edl = {
    id: nouvelId(),
    reference: await prochaineReference(),
    typeActe: 'a_definir',
    typeBien,
    meuble: !!bien.meuble,
    statut: 'brouillon',
    dateVisite,
    creeLe: maintenant,
    modifieLe: maintenant,
    bienId: bien.id,
    bien: {
      adresse: bien.adresse,
      complement: [bien.residence, bien.batiment && `Bât. ${bien.batiment}`, bien.porte && `Porte ${bien.porte}`, bien.complement].filter(Boolean).join(', ') || undefined,
      codePostal: bien.codePostal,
      ville: bien.ville,
      etage: bien.etage,
      lot: bien.lot,
      surface: bien.surface,
      nbPieces: bien.typologie || bien.nbPieces,
      annexes: [...bien.annexes],
    },
    // Bailleur : la société du bien si elle est connue, sinon à compléter (jamais devinée).
    bailleur: bien.societe ? { raisonSociale: bien.societe, adresse: '' } : { raisonSociale: '', adresse: '' },
    // L'opérateur est la personne qui réalise les états des lieux : on reprend le dernier utilisé.
    operateur: dernier?.operateur ?? { nom: '' },
    locataires: [{ id: nouvelId(), nom: '' }],
    chauffage: { mode: 'individuel' },
    eauChaude: { mode: 'individuel', idemChauffage: true },
    pieces: creerPiecesDepuisBien(bien.pieces),
    compteurs,
  }
  await db.edls.add(normaliser(edl))
  return edl.id
}

// --- Fichier de préparation --------------------------------------------

export interface FichierPreparation {
  format: 'edl-brenguier-patrimoine'
  version: 1
  biens: Bien[]
  /** États des lieux à préparer : un brouillon par bien et par date. */
  visites?: { bienId: string; date: string }[]
}

export interface ResultatImport {
  biensAjoutes: number
  biensMisAJour: number
  edlCrees: string[]
  edlDejaPresents: number
}

/**
 * Importe un fichier de préparation.
 * Rejouer le même fichier ne crée aucun doublon : les biens sont mis à jour
 * (même identifiant) et un état des lieux déjà préparé n'est pas recréé.
 * Aucun état des lieux existant n'est jamais modifié ni supprimé.
 */
export async function importerPreparation(contenu: unknown): Promise<ResultatImport> {
  const f = contenu as FichierPreparation
  if (!f || f.format !== 'edl-brenguier-patrimoine' || !Array.isArray(f.biens)) throw new Error('Ce fichier n’est pas un fichier de patrimoine EDL Brenguier.')
  const r: ResultatImport = { biensAjoutes: 0, biensMisAJour: 0, edlCrees: [], edlDejaPresents: 0 }
  const maintenant = new Date().toISOString()
  for (const b of f.biens) {
    if (!b.id || !b.adresse || !b.ville) throw new Error(`Bien incomplet dans le fichier (${b.reference ?? b.id ?? 'sans référence'}).`)
    const existant = await db.biens.get(b.id)
    await db.biens.put({ ...b, creeLe: existant?.creeLe ?? b.creeLe ?? maintenant, modifieLe: maintenant })
    if (existant) r.biensMisAJour++
    else r.biensAjoutes++
  }
  for (const v of f.visites ?? []) {
    const bien = await db.biens.get(v.bienId)
    if (!bien) continue
    const deja = (await db.edls.where('bienId').equals(v.bienId).toArray()).some((e) => e.dateVisite.slice(0, 10) === v.date.slice(0, 10))
    if (deja) r.edlDejaPresents++
    else r.edlCrees.push(await creerEdlDepuisBien(bien, v.date))
  }
  return r
}

// --- Biens intégrés à l'application -------------------------------------

let installation: Promise<void> | null = null

/**
 * Ajoute à la base de l'appareil les biens intégrés à l'application (s'ils n'y sont pas déjà)
 * et prépare une seule fois les visites prévues. Une fiche déjà présente n'est jamais écrasée,
 * et un état des lieux supprimé par l'utilisateur n'est pas recréé.
 */
export function installerPatrimoineIntegre(): Promise<void> {
  installation ??= (async () => {
    const { BIENS_INTEGRES, VISITES_INTEGREES } = await import('../patrimoine/biensIntegres')
    for (const b of BIENS_INTEGRES) if (!(await db.biens.get(b.id))) await db.biens.add(b)
    for (const v of VISITES_INTEGREES) {
      if (await db.meta.get(v.cle)) continue
      const bien = await db.biens.get(v.bienId)
      if (!bien) continue
      const deja = (await db.edls.where('bienId').equals(v.bienId).toArray()).some((e) => e.dateVisite.slice(0, 10) === v.date)
      if (!deja) await creerEdlDepuisBien(bien, v.date)
      await db.meta.put({ cle: v.cle, valeur: new Date().toISOString() })
    }
  })().catch((e) => {
    installation = null
    console.error('Patrimoine intégré :', e)
  })
  return installation
}

// --- Gestion des fiches -----------------------------------------------------

export function bienVide(): Bien {
  const maintenant = new Date().toISOString()
  return { id: nouvelId(), categorie: 'appartement', adresse: '', codePostal: '', ville: '', annexes: [], equipements: [], pieces: [], compteurs: ['electricite', 'eau_froide'], creeLe: maintenant, modifieLe: maintenant }
}

export async function enregistrerBien(b: Bien): Promise<void> {
  await db.biens.put({ ...b, modifieLe: new Date().toISOString() })
}

/** Une fiche n'est supprimable que si aucun état des lieux n'y est rattaché (l'historique est conservé). */
export async function supprimerBien(id: string): Promise<boolean> {
  return db.transaction('rw', db.biens, db.edls, async () => {
    if ((await db.edls.where('bienId').equals(id).count()) > 0) return false
    await db.biens.delete(id)
    return true
  })
}

const CATEGORIE_DEPUIS_EDL: Record<TypeBien, CategorieBien> = { appartement: 'appartement', maison: 'maison', local: 'local_commercial' }

/**
 * Mode B : enregistre dans le patrimoine le bien d'un état des lieux saisi librement,
 * et rattache l'état des lieux à cette nouvelle fiche. Les états (usure, etc.) ne sont pas repris :
 * seule la composition (pièces, équipements) l'est.
 */
export async function bienDepuisEdl(edl: Edl): Promise<string> {
  const b = bienVide()
  const fiche: Bien = {
    ...b,
    categorie: CATEGORIE_DEPUIS_EDL[edl.typeBien],
    adresse: edl.bien.adresse,
    complement: edl.bien.complement,
    codePostal: edl.bien.codePostal,
    ville: edl.bien.ville,
    etage: edl.bien.etage,
    lot: edl.bien.lot,
    surface: edl.bien.surface,
    nbPieces: edl.bien.nbPieces,
    meuble: edl.meuble,
    societe: edl.bailleur.raisonSociale || undefined,
    annexes: [...edl.bien.annexes],
    pieces: edl.pieces.filter((p) => p.modele !== 'mobilier').map((p) => ({ modele: p.modele, nom: p.nom })),
    compteurs: [...new Set((edl.compteurs ?? []).filter((c) => !c.nonApplicable && c.type !== 'autre').map((c) => c.type))],
  }
  await db.transaction('rw', db.biens, db.edls, async () => {
    await db.biens.add(fiche)
    const e = await db.edls.get(edl.id)
    // Un état des lieux signé n'est jamais modifié : seul un brouillon est rattaché.
    if (e && e.statut !== 'signe') await db.edls.update(edl.id, { bienId: fiche.id })
  })
  return fiche.id
}
