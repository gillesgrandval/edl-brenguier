/* ------------------------------------------------------------------
   État des lieux de sortie préparé à partir de l'entrée, et comparaison.

   La sortie reprend les MÊMES pièces et éléments que l'entrée (mêmes
   identifiants), ce qui permet de comparer élément par élément. Les
   constats (états, observations, photos) repartent à zéro : la sortie
   est un nouveau constat contradictoire.
   ------------------------------------------------------------------ */

import { db, nouvelId } from './base'
import { genreDe } from '../modeles/comptes'
import { normaliser, prochaineReference } from './edl'
import type { Degradation, Edl, Element, Etat, Piece } from './types'
import { GRILLE_VETUSTE, ageEnAnnees, categorieVetuste, tauxVetuste, type CategorieVetuste, type LigneGrille } from '../modeles/vetuste'

/** Rang d'un état, du meilleur (0) au pire ; « absent / non vérifié » n'est pas comparable. */
const RANG: Partial<Record<Etat, number>> = { neuf: 0, tres_bon: 1, bon: 2, use: 3, mauvais: 4, hs: 5 }

export type Evolution = 'identique' | 'mieux' | 'degradation' | 'nouveau' | 'non_comparable'

export function evolution(entree: Element | undefined, sortie: Element): Evolution {
  if (!entree) return 'nouveau'
  const a = entree.etat ? RANG[entree.etat] : undefined
  const b = sortie.etat ? RANG[sortie.etat] : undefined
  if (a === undefined || b === undefined) return 'non_comparable'
  return b > a ? 'degradation' : b < a ? 'mieux' : 'identique'
}

/** Prépare la sortie d'une entrée (de préférence signée). */
export async function creerSortieDepuisEntree(entree: Edl): Promise<string> {
  const maintenant = new Date().toISOString()
  const e = normaliser(entree)
  const vierge = (el: Element): Element => {
    const v: Element = {
      id: el.id,
      libelle: el.libelle,
      categorie: el.categorie,
      equipement: el.equipement,
      nature: el.nature,
      quantite: el.quantite,
      observations: [],
      photoIds: [],
    }
    const genre = genreDe(el)
    if (genre) {
      v.genre = genre
      // Nombre constaté à l'entrée : repris, mais à vérifier à la sortie.
      if (el.quantite !== undefined) v.quantiteSource = 'entree'
      // Mêmes unités (mêmes identifiants) que l'entrée, sans constatation.
      if (el.unites?.length) v.unites = el.unites.map((u) => ({ id: u.id, reversible: u.reversible, marque: u.marque, photoIds: [] }))
    }
    return v
  }
  const pieces: Piece[] = e.pieces.map((p) => ({ id: p.id, modele: p.modele, nom: p.nom, dimensions: p.dimensions, elements: p.elements.map(vierge), photoIds: [] }))
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const sortie: Edl = {
    id: nouvelId(),
    reference: await prochaineReference(),
    typeActe: 'sortie',
    typeBien: e.typeBien,
    meuble: e.meuble,
    statut: 'brouillon',
    dateVisite: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    creeLe: maintenant,
    modifieLe: maintenant,
    edlEntreeId: e.id,
    bienId: e.bienId,
    bien: structuredClone(e.bien),
    bailleur: structuredClone(e.bailleur),
    mandataire: e.mandataire ? structuredClone(e.mandataire) : undefined,
    operateur: structuredClone(e.operateur),
    locataires: structuredClone(e.locataires),
    chauffage: structuredClone(e.chauffage),
    eauChaude: structuredClone(e.eauChaude),
    pieces,
    // Mêmes compteurs (mêmes identifiants, numéros repris), index à relever.
    compteurs: (e.compteurs ?? []).map((c) => ({ id: c.id, type: c.type, libelle: c.libelle, numero: c.numero, nonApplicable: c.nonApplicable, photoIds: [] })),
    // Mêmes clés ; le nombre restitué est à compter (le nombre remis à l'entrée est rappelé à l'écran).
    cles: (e.cles ?? []).map((c) => ({ id: c.id, libelle: c.libelle, nombre: 0, photoIds: [] })),
    detecteur: { photoIds: [] },
  }
  await db.edls.add(sortie)
  return sortie.id
}

/** Index des éléments de l'entrée par identifiant. */
export function elementsParId(edl: Edl | undefined | null): Map<string, Element> {
  return new Map((edl?.pieces ?? []).flatMap((p) => p.elements.map((e) => [e.id, e] as const)))
}

export interface LigneComparatif {
  piece: string
  element: Element
  entree?: Element
  evolution: Evolution
  degradation?: Degradation
  categorie: string
  age: number
  vetuste: number
  partLocataire: number
  montant?: number
}

/** Tableau comparatif d'une sortie, avec la vétusté de chaque élément dégradé. */
export function comparer(sortie: Edl, entree: Edl | undefined | null, grille: Record<CategorieVetuste, LigneGrille> = GRILLE_VETUSTE): LigneComparatif[] {
  const avant = elementsParId(entree)
  const lignes: LigneComparatif[] = []
  for (const p of sortie.pieces)
    for (const el of p.elements) {
      const ent = avant.get(el.id)
      const evo = evolution(ent, el)
      const deg = sortie.degradations?.[el.id]
      const cat = categorieVetuste(el)
      const g = grille[cat]
      const age = ageEnAnnees(deg?.depuis ?? entree?.dateVisite ?? sortie.dateVisite, sortie.dateVisite)
      const vetuste = tauxVetuste(g, age)
      const imputable = deg ? deg.imputable : evo === 'degradation'
      const partLocataire = imputable ? 100 - vetuste : 0
      lignes.push({
        piece: p.nom,
        element: el,
        entree: ent,
        evolution: evo,
        degradation: deg,
        categorie: g.libelle,
        age,
        vetuste,
        partLocataire,
        montant: imputable && deg?.cout ? Math.round(deg.cout * partLocataire) / 100 : undefined,
      })
    }
  return lignes
}

/** Consommation d'un compteur entre l'entrée et la sortie (si les deux index sont des nombres). */
export function consommation(indexEntree?: string, indexSortie?: string): number | undefined {
  const a = Number((indexEntree ?? '').replace(',', '.'))
  const b = Number((indexSortie ?? '').replace(',', '.'))
  return indexEntree && indexSortie && Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) * 1000) / 1000 : undefined
}
