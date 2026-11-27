/* ------------------------------------------------------------------
   Précédent état des lieux hors application (anciens PDF Opéra Groupe).

   La fiche du bien en garde l'état détaillé, pièce par pièce et élément par
   élément. Une visite peut être PRÉ-REMPLIE avec cet état : chaque élément
   arrive avec l'état, les quantités et les observations constatés alors,
   marqué « à confirmer ». Sur place, l'opérateur confirme (« toujours le cas »)
   ou corrige. L'état précédent reste mémorisé dans l'élément : il sert de point
   de comparaison pour la sortie (dégradations, vétusté, chiffrage).
   ------------------------------------------------------------------ */

import { nouvelId } from './base'
import { genreParLibelle } from '../modeles/comptes'
import type { Edl, Element, ElementReference, EtatReference, Piece } from './types'

export function elementDepuisReference(r: ElementReference): Element {
  // Un libellé d'élément compté (« Climatisation réversible ») déclencherait une saisie par unités :
  // l'élément repris garde la forme simple de l'ancien état des lieux.
  const libelle = genreParLibelle(r.libelle) ? `${r.libelle} (relevé)` : r.libelle
  const el: Element = {
    id: nouvelId(),
    libelle,
    categorie: r.categorie,
    equipement: r.equipement,
    observations: [],
    photoIds: [],
    reference: {
      ...(r.etat ? { etat: r.etat } : {}),
      ...(r.observations ? { observations: r.observations } : {}),
      ...(r.quantite !== undefined ? { quantite: r.quantite } : {}),
      ...(r.trous ? { trous: r.trous } : {}),
    },
    aConfirmer: true,
  }
  if (r.nature) el.nature = r.nature
  if (r.quantite !== undefined) el.quantite = r.quantite
  if (r.trous) el.trousChevilles = r.trous
  // « Non vérifié » à l'époque : l'état est à constater, rien n'est présumé.
  if (r.etat && r.etat !== 'absent') el.etat = r.etat
  if (r.observations) el.commentaire = r.observations
  return el
}

export function piecesDepuisReference(ref: EtatReference): Piece[] {
  return ref.pieces.map((p) => ({ id: nouvelId(), modele: p.modele, nom: p.nom, elements: p.elements.map(elementDepuisReference), photoIds: [] }))
}

/** Élément « tel qu'au précédent état des lieux », pour la comparaison (pastille, comparatif, chiffrage). */
export function elementDeReference(el: Element): Element | undefined {
  const r = el.reference
  if (!r) return undefined
  return {
    ...el,
    etat: r.etat === 'absent' ? undefined : r.etat,
    quantite: r.quantite,
    trousChevilles: r.trous,
    observations: [],
    commentaire: r.observations,
    fonctionnement: undefined,
    photoIds: [],
    unites: undefined,
  }
}

/** Nombre d'éléments repris encore à confirmer. */
export function nbAConfirmer(edl: Pick<Edl, 'pieces'>): number {
  return edl.pieces.reduce((n, p) => n + p.elements.filter((e) => e.aConfirmer).length, 0)
}
