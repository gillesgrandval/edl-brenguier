/* ------------------------------------------------------------------
   Patrimoine du groupe livré CHIFFRÉ avec l'application
   (src/patrimoine/patrimoineGroupe.json, produit par scripts/chiffrer-patrimoine.mjs).

   Installation sur l'appareil avec la phrase secrète, une seule fois par version.
   Une fiche modifiée sur l'appareil depuis la dernière installation n'est jamais écrasée.
   ------------------------------------------------------------------ */

import { db, ecrireMeta, lireMeta } from './base'
import { dechiffrer, type PaquetChiffre } from '../patrimoine/chiffrement'
import type { FichierPreparation } from './patrimoine'

const CLE = 'patrimoine-groupe'

export interface Installation {
  version: string
  installeLe: string
  nombre: number
}

// Absent tant que le fichier n'a pas été chiffré : l'application fonctionne sans.
const fichiers = import.meta.glob<PaquetChiffre>('../patrimoine/patrimoineGroupe.json', { import: 'default' })

/** Paquet chiffré livré avec cette version de l'application (null s'il n'y en a pas). */
export async function paquetLivre(): Promise<PaquetChiffre | null> {
  const charger = Object.values(fichiers)[0]
  return charger ? await charger() : null
}

export async function installationActuelle(): Promise<Installation | null> {
  return (await lireMeta<Installation>(CLE)) ?? null
}

export interface ResultatInstallation {
  ajoutes: number
  misAJour: number
  /** Fiches modifiées sur l'appareil depuis la dernière installation : laissées telles quelles. */
  conservees: number
}

export async function installerPatrimoineGroupe(phrase: string): Promise<ResultatInstallation> {
  const paquet = await paquetLivre()
  if (!paquet) throw new Error("Aucun patrimoine n'est livré avec cette version.")
  const contenu = await dechiffrer<FichierPreparation>(paquet, phrase)
  if (contenu.format !== 'edl-brenguier-patrimoine' || !Array.isArray(contenu.biens)) throw new Error('Contenu inattendu.')
  const precedente = await installationActuelle()
  const maintenant = new Date().toISOString()
  const r: ResultatInstallation = { ajoutes: 0, misAJour: 0, conservees: 0 }
  await db.transaction('rw', db.biens, db.meta, async () => {
    for (const b of contenu.biens) {
      const existant = await db.biens.get(b.id)
      if (existant && precedente && existant.modifieLe > precedente.installeLe) {
        // Fiche modifiée sur l'appareil : conservée, mais l'état détaillé du précédent état des lieux est mis à jour.
        if (b.etatReference) await db.biens.put({ ...existant, etatReference: b.etatReference })
        r.conservees++
        continue
      }
      await db.biens.put({ ...b, creeLe: existant?.creeLe ?? maintenant, modifieLe: maintenant })
      if (existant) r.misAJour++
      else r.ajoutes++
    }
    // Horodatage juste après l'écriture : une modification ultérieure sur l'appareil sera reconnue.
    await ecrireMeta(CLE, { version: paquet.version, installeLe: new Date().toISOString(), nombre: contenu.biens.length } satisfies Installation)
  })
  return r
}
