/* ------------------------------------------------------------------
   Grille de vétusté.

   La vétusté est l'usure normale due au temps : elle reste à la charge
   du bailleur. Pour un élément dégradé, on calcule :
     vétusté (%) = (âge − franchise) × abattement annuel,
                   plafonnée à (100 − valeur résiduelle) ;
     part du locataire (%) = 100 − vétusté.

   ⚠️ GRILLE INDICATIVE, à valider par le Groupe Brenguier (elle deviendra
   modifiable dans les Paramètres). Idéalement, la grille retenue est
   annexée au bail : elle s'impose alors aux deux parties.
   ------------------------------------------------------------------ */

import type { Element } from '../db/types'

export type CategorieVetuste =
  | 'peinture'
  | 'moquette'
  | 'sol_souple'
  | 'parquet'
  | 'carrelage'
  | 'menuiserie'
  | 'electricite'
  | 'chauffage'
  | 'sanitaire'
  | 'robinetterie'
  | 'electromenager'
  | 'mobilier'
  | 'exterieur'
  | 'autre'

export interface LigneGrille {
  libelle: string
  /** Années sans abattement. */
  franchise: number
  /** Abattement par an au-delà de la franchise (%). */
  abattement: number
  /** Part qui reste toujours imputable en cas de dégradation (%). */
  residuel: number
}

export const GRILLE_VETUSTE: Record<CategorieVetuste, LigneGrille> = {
  peinture: { libelle: 'Peintures, papiers peints', franchise: 2, abattement: 12, residuel: 10 },
  moquette: { libelle: 'Moquette', franchise: 2, abattement: 15, residuel: 10 },
  sol_souple: { libelle: 'Sols souples (lino, PVC)', franchise: 2, abattement: 10, residuel: 10 },
  parquet: { libelle: 'Parquet, stratifié', franchise: 3, abattement: 7, residuel: 20 },
  carrelage: { libelle: 'Carrelage, faïence', franchise: 5, abattement: 5, residuel: 20 },
  menuiserie: { libelle: 'Menuiseries (portes, fenêtres, placards)', franchise: 5, abattement: 4, residuel: 20 },
  electricite: { libelle: 'Électricité (prises, interrupteurs, éclairage)', franchise: 3, abattement: 7, residuel: 10 },
  chauffage: { libelle: 'Chauffage, climatisation', franchise: 3, abattement: 7, residuel: 10 },
  sanitaire: { libelle: 'Sanitaires (lavabo, WC, douche, baignoire)', franchise: 5, abattement: 5, residuel: 20 },
  robinetterie: { libelle: 'Robinetterie, chasse d’eau', franchise: 2, abattement: 10, residuel: 10 },
  electromenager: { libelle: 'Électroménager (four, plaques, hotte…)', franchise: 2, abattement: 12, residuel: 10 },
  mobilier: { libelle: 'Mobilier, équipements', franchise: 2, abattement: 10, residuel: 10 },
  exterieur: { libelle: 'Extérieurs', franchise: 3, abattement: 7, residuel: 20 },
  autre: { libelle: 'Autres éléments', franchise: 2, abattement: 10, residuel: 10 },
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Catégorie de vétusté d'un élément, d'après son libellé, sa nature et sa catégorie. */
export function categorieVetuste(e: Pick<Element, 'libelle' | 'nature' | 'categorie'>): CategorieVetuste {
  const t = sansAccents(`${e.libelle} ${e.nature ?? ''}`)
  if (/moquette/.test(t)) return 'moquette'
  if (/lino|pvc souple|vinyle/.test(t) && /sol/.test(t)) return 'sol_souple'
  if (/parquet|stratifie/.test(t)) return 'parquet'
  if (/carrelage|faience|credence/.test(t)) return 'carrelage'
  if (/robinet|mitigeur|melangeur|chasse/.test(t)) return 'robinetterie'
  if (/four|plaque|hotte|refrigerateur|frigo|lave|micro|electromenager|cuisson/.test(t)) return 'electromenager'
  if (/lavabo|vasque|cuvette|baignoire|douche|evier|receveur|wc/.test(t)) return 'sanitaire'
  switch (e.categorie) {
    case 'revetement':
      return /sol/.test(t) ? 'sol_souple' : 'peinture'
    case 'menuiserie':
      return 'menuiserie'
    case 'electricite':
      return 'electricite'
    case 'chauffage':
      return 'chauffage'
    case 'plomberie':
      return 'sanitaire'
    case 'equipement':
      return 'mobilier'
    case 'exterieur':
      return 'exterieur'
    default:
      return 'autre'
  }
}

/** Taux de vétusté (%) pour un âge donné (années, décimales possibles). */
export function tauxVetuste(g: LigneGrille, age: number): number {
  const brut = Math.max(0, age - g.franchise) * g.abattement
  return Math.round(Math.min(100 - g.residuel, brut))
}

/** Âge en années entre deux dates (AAAA-MM-JJ…). */
export function ageEnAnnees(depuis: string, jusqua: string): number {
  const a = new Date(depuis.slice(0, 10)).getTime()
  const b = new Date(jusqua.slice(0, 10)).getTime()
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, (b - a) / (365.25 * 24 * 3600 * 1000)) : 0
}
