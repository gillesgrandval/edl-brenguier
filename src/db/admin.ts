/* ------------------------------------------------------------------
   Suppression contrôlée, corbeille, annulation et code administrateur.

   - Un brouillon (non signé) va d'abord à la CORBEILLE : il reste
     restaurable. Sa suppression définitive demande le code.
   - Un état des lieux SIGNÉ ne se supprime jamais : il peut être
     ANNULÉ (archivé) avec un motif, et le code. L'annulation est rangée
     à part : le document signé et son empreinte ne changent pas.
   - Chaque action est inscrite au JOURNAL, qui n'est jamais effacé.
   - La fiche du bien et les autres états des lieux ne sont jamais touchés.

   Le code administrateur est une protection simple contre les fausses
   manœuvres (il n'y a pas de comptes utilisateurs) : seule son empreinte
   SHA-256 est conservée.
   ------------------------------------------------------------------ */

import { db, ecrireMeta, lireMeta, nouvelId } from './base'
import { sha256 } from './cloture'
import { supprimerEdl } from './edl'
import type { ActionJournal, Annulation, Edl } from './types'
import { LIBELLE_ACTE, LIBELLE_STATUT, formatDate } from '../libelles'

const CLE_CODE = 'code-admin'
interface CodeEnregistre {
  sel: string
  empreinte: string
}

export const CODE_VALIDE = /^\d{4,8}$/

export async function codeDefini(): Promise<boolean> {
  return !!(await lireMeta<CodeEnregistre>(CLE_CODE))
}

async function empreinteCode(code: string, sel: string): Promise<string> {
  return sha256(`${sel}:${code}`)
}

export async function verifierCode(code: string): Promise<boolean> {
  const c = await lireMeta<CodeEnregistre>(CLE_CODE)
  if (!c) return false
  return (await empreinteCode(code.trim(), c.sel)) === c.empreinte
}

/** Définit (ou change) le code. Pour changer un code existant, l'ancien est exigé. */
export async function definirCode(nouveau: string, ancien?: string): Promise<void> {
  if (!CODE_VALIDE.test(nouveau)) throw new Error('Le code doit comporter de 4 à 8 chiffres.')
  const existe = await codeDefini()
  if (existe && !(await verifierCode(ancien ?? ''))) throw new Error('Code actuel incorrect.')
  const sel = nouvelId()
  await ecrireMeta(CLE_CODE, { sel, empreinte: await empreinteCode(nouveau, sel) } satisfies CodeEnregistre)
  await journaliser(existe ? 'code_modifie' : 'code_defini', 'Code administrateur ' + (existe ? 'modifié' : 'défini'))
}

/**
 * Code oublié : le code est effacé (à redéfinir). Rien d'autre n'est touché,
 * et la réinitialisation reste inscrite au journal.
 */
export async function reinitialiserCode(motif: string): Promise<void> {
  if (!motif.trim()) throw new Error('Indiquez la raison de la réinitialisation.')
  await db.meta.delete(CLE_CODE)
  await journaliser('code_reinitialise', 'Code administrateur réinitialisé (oublié)', motif.trim())
}

// --- Journal ---------------------------------------------------------

/** Description lisible : référence, bien, date, type, statut. */
export function descriptionEdl(edl: Edl): string {
  const bien = [edl.bien.lot ? `Lot ${edl.bien.lot}` : '', edl.bien.adresse, [edl.bien.codePostal, edl.bien.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return `${edl.reference} · ${LIBELLE_ACTE[edl.typeActe]} · ${bien || 'adresse non renseignée'} · ${formatDate(edl.dateVisite)} · ${LIBELLE_STATUT[edl.statut]}`
}

export async function journaliser(action: ActionJournal, description: string, motif?: string, edlId?: string): Promise<void> {
  await db.journal.add({ id: nouvelId(), le: new Date().toISOString(), action, description, ...(motif ? { motif } : {}), ...(edlId ? { edlId } : {}) })
}

export const LIBELLE_ACTION: Record<ActionJournal, string> = {
  corbeille: 'Mis à la corbeille',
  restauration: 'Restauré depuis la corbeille',
  suppression_definitive: 'Supprimé définitivement',
  annulation: 'Annulé (archivé)',
  retablissement: 'Annulation levée',
  code_defini: 'Code défini',
  code_modifie: 'Code modifié',
  code_reinitialise: 'Code réinitialisé',
  visite_terminee: 'Visite commune terminée',
}

// --- Corbeille (brouillons) -------------------------------------------

/** Met un brouillon à la corbeille. Un état des lieux signé est refusé. */
export async function mettreALaCorbeille(id: string, motif?: string): Promise<void> {
  await db.transaction('rw', db.edls, db.journal, async () => {
    const e = await db.edls.get(id)
    if (!e) throw new Error('État des lieux introuvable.')
    if (e.statut === 'signe') throw new Error('Un état des lieux signé ne peut pas être supprimé : il peut seulement être annulé.')
    const le = new Date().toISOString()
    await db.edls.update(id, { corbeille: { le, ...(motif?.trim() ? { motif: motif.trim() } : {}) }, modifieLe: le })
    await journaliser('corbeille', descriptionEdl(e), motif?.trim() || undefined, id)
  })
}

export async function restaurerDeLaCorbeille(id: string): Promise<void> {
  await db.transaction('rw', db.edls, db.journal, async () => {
    const e = await db.edls.get(id)
    if (!e?.corbeille) return
    const restaure: Edl = { ...e, modifieLe: new Date().toISOString() }
    delete restaure.corbeille
    await db.edls.put(restaure)
    await journaliser('restauration', descriptionEdl(e), undefined, id)
  })
}

/** Suppression définitive : uniquement depuis la corbeille, avec le code. Photos et signatures comprises. */
export async function supprimerDefinitivement(id: string, code: string): Promise<void> {
  if (!(await verifierCode(code))) throw new Error('Code incorrect.')
  const e = await db.edls.get(id)
  if (!e) return
  if (e.statut === 'signe') throw new Error('Un état des lieux signé ne peut pas être supprimé.')
  if (!e.corbeille) throw new Error("Mettez d'abord l'état des lieux à la corbeille.")
  await supprimerEdl(id)
  await journaliser('suppression_definitive', descriptionEdl(e), e.corbeille.motif, id)
}

// --- Annulation (états des lieux signés) --------------------------------

export async function annulerEdl(id: string, motif: string, code: string): Promise<void> {
  if (!motif.trim()) throw new Error("Indiquez le motif de l'annulation.")
  if (!(await verifierCode(code))) throw new Error('Code incorrect.')
  const e = await db.edls.get(id)
  if (!e) throw new Error('État des lieux introuvable.')
  if (e.statut !== 'signe') throw new Error("Un état des lieux non signé se met à la corbeille, il ne s'annule pas.")
  const a: Annulation = { edlId: id, le: new Date().toISOString(), motif: motif.trim() }
  await db.annulations.put(a)
  await journaliser('annulation', descriptionEdl(e), a.motif, id)
}

export async function retablirEdl(id: string, code: string): Promise<void> {
  if (!(await verifierCode(code))) throw new Error('Code incorrect.')
  const e = await db.edls.get(id)
  await db.annulations.delete(id)
  if (e) await journaliser('retablissement', descriptionEdl(e), undefined, id)
}

/** Autres états des lieux qui s'appuient sur celui-ci (sortie préparée depuis une entrée). */
export async function edlsLies(id: string): Promise<Edl[]> {
  return (await db.edls.toArray()).filter((x) => x.edlEntreeId === id && !x.corbeille)
}
