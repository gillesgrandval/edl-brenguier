/* ------------------------------------------------------------------
   Paramètres de l'application (enregistrés sur l'appareil).
   ------------------------------------------------------------------ */

import { useLiveQuery } from 'dexie-react-hooks'
import { db, ecrireMeta, lireMeta } from './base'
import { GRILLE_VETUSTE, type CategorieVetuste, type LigneGrille } from '../modeles/vetuste'

export interface Parametres {
  /** Grille de vétusté du Groupe Brenguier. */
  grille: Record<CategorieVetuste, LigneGrille>
  /** true quand la grille a été validée (par ex. annexée aux baux) : le PDF ne la dit plus « indicative ». */
  grilleValidee: boolean
  /** Opérateur proposé par défaut pour les nouveaux états des lieux. */
  operateur?: { nom: string; qualite?: string }
  /** Mentions ajoutées à la fin de chaque rapport PDF. */
  mentionsPdf?: string
}

const CLE = 'parametres'

export const PARAMETRES_DEFAUT: Parametres = { grille: GRILLE_VETUSTE, grilleValidee: false }

/** Paramètres enregistrés, complétés par les valeurs par défaut (nouvelles catégories, etc.). */
function completer(p?: Partial<Parametres>): Parametres {
  return {
    ...PARAMETRES_DEFAUT,
    ...p,
    grille: { ...GRILLE_VETUSTE, ...(p?.grille ?? {}) },
  }
}

export async function lireParametres(): Promise<Parametres> {
  return completer(await lireMeta<Partial<Parametres>>(CLE))
}

export async function ecrireParametres(f: (p: Parametres) => void): Promise<void> {
  const p = structuredClone(await lireParametres())
  f(p)
  await ecrireMeta(CLE, p)
}

/** Paramètres à jour dans un écran (undefined pendant le chargement). */
export function useParametres(): Parametres | undefined {
  return useLiveQuery(async () => completer((await db.meta.get(CLE))?.valeur as Partial<Parametres> | undefined), [])
}
