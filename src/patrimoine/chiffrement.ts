/* ------------------------------------------------------------------
   Chiffrement du patrimoine du groupe, livré avec l'application.

   Le code de l'application est public : les fiches y sont donc rangées
   CHIFFRÉES (AES-GCM 256 bits). La clé est dérivée d'une phrase secrète
   (PBKDF2-SHA-256, 600 000 itérations) que seul le Groupe connaît : elle
   n'est écrite nulle part dans le code. Sans elle, le bloc est illisible.

   Le même module sert au script de chiffrement (sur l'ordinateur)
   et au déchiffrement (sur la tablette).
   ------------------------------------------------------------------ */

import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate'

export interface PaquetChiffre {
  format: 'edl-brenguier-chiffre'
  /** Version des fiches (date de chiffrement), pour proposer les mises à jour. */
  version: string
  /** Nombre de biens (affiché avant l'installation ; ne révèle rien d'autre). */
  nombre: number
  iterations: number
  sel: string
  iv: string
  donnees: string
}

const ITERATIONS = 600_000

const versBase64 = (o: Uint8Array) => {
  let s = ''
  for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000))
  return btoa(s)
}
const depuisBase64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0))

/** Phrase normalisée : espaces superflus retirés, accents unifiés (la saisie sur tablette peut différer). */
const normaliser = (phrase: string) => phrase.normalize('NFC').trim().replace(/\s+/g, ' ')

async function cle(phrase: string, sel: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', strToU8(normaliser(phrase)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sel as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** Exigence minimale : le bloc chiffré est public, la phrase doit résister à des essais en masse. */
export function phraseSuffisante(phrase: string): string | null {
  const p = normaliser(phrase)
  if (p.length < 24) return 'La phrase doit compter au moins 24 caractères.'
  if (p.split(' ').length < 4) return 'La phrase doit compter au moins 4 mots.'
  return null
}

export async function chiffrer(contenu: unknown, phrase: string, version: string, nombre: number, iterations = ITERATIONS): Promise<PaquetChiffre> {
  const sel = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const clair = gzipSync(strToU8(JSON.stringify(contenu)), { level: 9 })
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cle(phrase, sel, iterations), clair as BufferSource))
  return { format: 'edl-brenguier-chiffre', version, nombre, iterations, sel: versBase64(sel), iv: versBase64(iv), donnees: versBase64(chiffre) }
}

/** Déchiffre le paquet ; une phrase incorrecte est refusée (contrôle d'intégrité AES-GCM). */
export async function dechiffrer<T = unknown>(p: PaquetChiffre, phrase: string): Promise<T> {
  let clair: Uint8Array
  try {
    clair = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: depuisBase64(p.iv) as BufferSource }, await cle(phrase, depuisBase64(p.sel), p.iterations), depuisBase64(p.donnees) as BufferSource),
    )
  } catch {
    throw new Error('Phrase secrète incorrecte.')
  }
  return JSON.parse(strFromU8(gunzipSync(clair))) as T
}
