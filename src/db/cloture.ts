/* ------------------------------------------------------------------
   Signature et verrouillage d'un état des lieux.

   À la signature, on calcule une « empreinte » SHA-256 : un code unique
   qui résume tout le contenu (saisies, photos, signatures). Si une seule
   virgule ou un seul pixel change ensuite, l'empreinte ne correspond plus.
   Elle figurera sur le rapport PDF : c'est la preuve que le document
   n'a pas été retouché après signature.
   ------------------------------------------------------------------ */

import { db, nouvelId } from './base'
import { enregistrerEdl } from './edl'
import type { Edl, Signataire } from './types'

/** JSON aux clés triées : le même contenu donne toujours le même texte. */
export function jsonStable(v: unknown): string {
  if (v === undefined) return 'null'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(jsonStable).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${jsonStable(o[k])}`)
    .join(',')}}`
}

export async function sha256(donnees: string | ArrayBuffer): Promise<string> {
  const octets = typeof donnees === 'string' ? new TextEncoder().encode(donnees) : donnees
  const h = await crypto.subtle.digest('SHA-256', octets)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Contenu pris en compte : tout, sauf la date de dernière écriture et la clôture elle-même. */
function contenu(edl: Edl) {
  const { modifieLe: _m, cloture: _c, ...reste } = edl
  return reste
}

/** Empreinte du contenu, de chaque photo (par numéro) et de chaque signature. */
export async function calculerEmpreinte(edl: Edl): Promise<string> {
  const photos = await db.photos.where('edlId').equals(edl.id).sortBy('numero')
  const empreintesPhotos = await Promise.all(photos.map(async (p) => `${p.numero}:${await sha256(await p.image.arrayBuffer())}`))
  const empreintesSignatures: string[] = []
  for (const s of edl.signataires ?? []) {
    if (!s.signatureId) continue
    const img = await db.signatures.get(s.signatureId)
    empreintesSignatures.push(`${s.id}:${img ? await sha256(await img.image.arrayBuffer()) : 'absente'}`)
  }
  return sha256(jsonStable({ contenu: await sha256(jsonStable(contenu(edl))), photos: empreintesPhotos, signatures: empreintesSignatures }))
}

/** Personnes appelées à signer : le bailleur (ou son représentant) puis chaque locataire. */
export function signatairesAttendus(edl: Edl): Signataire[] {
  const representant = edl.operateur.nom.trim() || edl.bailleur.representant || edl.bailleur.raisonSociale || 'Bailleur'
  const qualite = [edl.operateur.qualite, edl.bailleur.raisonSociale ? `pour ${edl.bailleur.raisonSociale}` : ''].filter(Boolean).join(', ')
  return [
    { id: 'bailleur', role: 'bailleur', nom: representant, qualite: qualite || 'Bailleur' },
    ...edl.locataires
      .filter((l) => l.nom.trim())
      .map<Signataire>((l) => ({
        id: l.id,
        role: 'locataire',
        personneId: l.id,
        nom: [l.civilite, l.prenom, l.nom].filter(Boolean).join(' '),
        qualite: edl.typeBien === 'local' ? 'Preneur' : 'Locataire',
      })),
  ]
}

export interface SignatureSaisie {
  signataire: Signataire
  image?: Blob
  absent?: boolean
  motif?: string
}

/** Enregistre les signatures, fige l'état des lieux et calcule son empreinte. */
export async function signerEdl(edl: Edl, saisies: SignatureSaisie[], lieu: string): Promise<Edl> {
  const maintenant = new Date().toISOString()
  const signataires: Signataire[] = []
  for (const s of saisies) {
    const sig: Signataire = { ...s.signataire }
    if (s.absent) {
      sig.absent = true
      sig.motifAbsence = s.motif?.trim() || undefined
    } else if (s.image) {
      sig.signatureId = nouvelId()
      await db.signatures.add({ id: sig.signatureId, edlId: edl.id, image: s.image, traceeLe: maintenant })
    }
    signataires.push(sig)
  }
  const signe: Edl = { ...edl, statut: 'signe', signataires, lieuSignature: lieu.trim() || undefined }
  signe.cloture = { signeLe: maintenant, empreinte: await calculerEmpreinte(signe), versionApp: __APP_VERSION__ }
  await enregistrerEdl(signe)
  return signe
}

/** Vérifie que rien n'a changé depuis la signature. */
export async function verifierEmpreinte(edl: Edl): Promise<boolean> {
  if (!edl.cloture) return false
  return (await calculerEmpreinte(edl)) === edl.cloture.empreinte
}

/** Empreinte lisible : groupes de 4 caractères. */
export const empreinteLisible = (e: string) => e.match(/.{1,4}/g)?.join(' ') ?? e
