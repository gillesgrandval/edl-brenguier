import Dexie, { type EntityTable } from 'dexie'
import type { Bien, Edl, Entite, Meta, Photo, SignatureImage } from './types'

/**
 * Base de données interne à la tablette (IndexedDB).
 * Rien n'est envoyé sur Internet.
 *
 * ⚠️ Toute modification de structure doit passer par une nouvelle
 *    « version » (db.version(2)…) pour ne jamais perdre les données existantes.
 */
export const db = new Dexie('edl-brenguier') as Dexie & {
  edls: EntityTable<Edl, 'id'>
  photos: EntityTable<Photo, 'id'>
  entites: EntityTable<Entite, 'id'>
  meta: EntityTable<Meta, 'cle'>
  signatures: EntityTable<SignatureImage, 'id'>
  biens: EntityTable<Bien, 'id'>
}

db.version(1).stores({
  edls: 'id, reference, statut, typeActe, typeBien, modifieLe',
  photos: 'id, edlId, elementId',
  entites: 'id, raisonSociale',
  meta: 'cle',
})

// Version 2 (étape 6) : ajout des signatures manuscrites. Les données existantes sont conservées.
db.version(2).stores({
  signatures: 'id, edlId',
})

// Version 3 : patrimoine immobilier, et lien de chaque état des lieux vers son bien.
db.version(3).stores({
  edls: 'id, reference, statut, typeActe, typeBien, modifieLe, bienId',
  biens: 'id, identifiantExterne, ville, categorie, residence, societe, lot',
})

/** Demande à Android de ne jamais effacer automatiquement les données. */
export async function demanderStockagePersistant(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function lireMeta<T>(cle: string): Promise<T | undefined> {
  return (await db.meta.get(cle))?.valeur as T | undefined
}

export async function ecrireMeta(cle: string, valeur: unknown): Promise<void> {
  await db.meta.put({ cle, valeur })
}

export const nouvelId = (): string => crypto.randomUUID()
