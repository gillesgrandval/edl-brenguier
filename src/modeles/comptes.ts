import type { Element, Etat, Fonctionnement, GenreElement, UniteClim } from '../db/types'
import { nouvelId } from '../db/base'

/* ------------------------------------------------------------------
   Éléments comptés : prises, interrupteurs, points lumineux, climatisation.

   Trois situations bien distinctes pour le nombre :
   - non renseigné  → quantite absente ;
   - aucun          → quantite = 0 ;
   - constaté       → quantite = n, sans quantiteSource ;
   (et « repris de la fiche / de l'entrée, à vérifier » → quantiteSource).
   ------------------------------------------------------------------ */

export const GENRES: Record<GenreElement, { libelle: string; unite: [string, string]; aucun: string }> = {
  prises: { libelle: 'Prises électriques', unite: ['prise', 'prises'], aucun: 'Aucune prise' },
  interrupteurs: { libelle: 'Interrupteurs', unite: ['interrupteur', 'interrupteurs'], aucun: 'Aucun interrupteur' },
  points_lumineux: { libelle: 'Points lumineux', unite: ['point lumineux', 'points lumineux'], aucun: 'Aucun point lumineux' },
  climatisation: { libelle: 'Climatisation', unite: ['unité', 'unités'], aucun: 'Aucune climatisation' },
}

/** Libellés des modèles des versions précédentes, reconnus comme éléments comptés. */
const PAR_LIBELLE: Record<string, GenreElement> = {
  'prises électriques': 'prises',
  prises: 'prises',
  interrupteurs: 'interrupteurs',
  'éclairage / points lumineux': 'points_lumineux',
  'points lumineux': 'points_lumineux',
  climatisation: 'climatisation',
  'climatisation réversible': 'climatisation',
}

/** Genre de l'élément : explicite, ou reconnu d'après le libellé (anciens états des lieux). */
export function genreDe(el: Pick<Element, 'genre' | 'libelle'>): GenreElement | undefined {
  return el.genre ?? PAR_LIBELLE[el.libelle.trim().toLowerCase()]
}

export function genreParLibelle(libelle: string): GenreElement | undefined {
  return PAR_LIBELLE[libelle.trim().toLowerCase()]
}

/** « 6 prises », « 1 interrupteur », « Aucune climatisation », « non renseigné ». */
export function texteNombre(genre: GenreElement, n: number | undefined): string {
  const g = GENRES[genre]
  if (n === undefined) return 'nombre non renseigné'
  if (n === 0) return g.aucun
  return `${n} ${n > 1 ? g.unite[1] : g.unite[0]}`
}

/** Toutes les photos d'un élément, y compris celles de ses unités de climatisation. */
export function photosElement(el: Element): string[] {
  return [...el.photoIds, ...(el.unites ?? []).flatMap((u) => u.photoIds)]
}

/**
 * Un élément est « renseigné » quand son état est saisi.
 * Climatisation : « aucune » (0 constaté) suffit ; avec des unités, chacune doit avoir son état.
 */
export function elementFait(el: Element): boolean {
  if (genreDe(el) === 'climatisation') {
    if (el.quantiteSource) return false
    if (el.quantite === 0) return true
    const u = el.unites ?? []
    return u.length > 0 && u.every((x) => !!x.etat)
  }
  return !!el.etat
}

const RANG: Record<Etat, number> = { neuf: 0, tres_bon: 1, bon: 2, use: 3, mauvais: 4, hs: 5, absent: 6 }

/** État et fonctionnement d'ensemble d'une climatisation, déduits de ses unités (le plus défavorable). */
export function syntheseClim(unites: UniteClim[]): { etat?: Etat; fonctionnement?: Fonctionnement } {
  if (!unites.length) return {}
  const etat = unites.every((u) => u.etat) ? unites.map((u) => u.etat!).sort((a, b) => RANG[b] - RANG[a])[0] : undefined
  const f = unites.map((u) => u.fonctionnement)
  // Défaillant dès qu'une unité l'est ; sinon, rien tant que toutes les unités ne sont pas renseignées.
  const fonctionnement: Fonctionnement | undefined = f.includes('defaillant') ? 'defaillant' : !f.every(Boolean) ? undefined : f.every((x) => x === 'ok') ? 'ok' : 'non_teste'
  return { etat, fonctionnement }
}

export function uniteVierge(): UniteClim {
  return { id: nouvelId(), photoIds: [] }
}

/**
 * Fixe le nombre d'un élément compté (undefined = non renseigné).
 * Climatisation : ajoute les unités manquantes ; ne retire que des unités vides
 * (une unité déjà renseignée n'est jamais effacée par ce biais).
 * Retourne false si le nombre demandé obligerait à effacer une unité renseignée.
 */
export function fixerNombre(el: Element, n: number | undefined): boolean {
  const genre = genreDe(el)
  if (genre === 'climatisation') {
    const unites = [...(el.unites ?? [])]
    const cible = n ?? 0
    while (unites.length < cible) unites.push(uniteVierge())
    while (unites.length > cible) {
      const i = unites.map((u, k) => (uniteVide(u) ? k : -1)).filter((k) => k >= 0).pop()
      if (i === undefined) return false
      unites.splice(i, 1)
    }
    el.unites = unites.length ? unites : undefined
    const s = syntheseClim(unites)
    el.etat = s.etat
    el.fonctionnement = s.fonctionnement
  }
  if (genre) el.genre = genre
  el.quantite = n
  delete el.quantiteSource
  return true
}

export function uniteVide(u: UniteClim): boolean {
  return !u.etat && !u.fonctionnement && !u.marque?.trim() && !u.commentaire?.trim() && u.reversible === undefined && u.photoIds.length === 0
}

/** Après modification d'une unité : met à jour l'état d'ensemble de la climatisation. */
export function majSyntheseClim(el: Element): void {
  const s = syntheseClim(el.unites ?? [])
  el.etat = s.etat
  el.fonctionnement = s.fonctionnement
}

/** Une pièce contient-elle des constatations (pour prévenir avant de la supprimer) ? */
export function constatsPiece(p: { elements: Element[]; photoIds: string[]; commentaire?: string }): { constats: number; photos: number } {
  const constats = p.elements.filter(
    (e) =>
      !!e.etat ||
      !!e.fonctionnement ||
      e.observations.length > 0 ||
      !!e.commentaire?.trim() ||
      (genreDe(e) !== undefined && e.quantite !== undefined && !e.quantiteSource) ||
      (e.unites ?? []).some((u) => !uniteVide(u)),
  ).length + (p.commentaire?.trim() ? 1 : 0)
  const photos = p.photoIds.length + p.elements.reduce((n, e) => n + photosElement(e).length, 0)
  return { constats, photos }
}
