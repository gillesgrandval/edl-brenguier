/* ------------------------------------------------------------------
   Sauvegarde complète et restauration.

   Toutes les données sont sur l'appareil : une sauvegarde régulière,
   rangée ailleurs (Google Drive, ordinateur, clé USB), protège contre
   la perte ou la panne de la tablette.

   Fichier « .zip » :
     donnees.json            états des lieux, biens, entités, paramètres
     photos/<id>.jpg         photo (avec annotations)
     photos/<id>-mini.jpg    miniature
     photos/<id>-base.jpg    photo d'origine (si annotée)
     signatures/<id>.png     signatures manuscrites

   La restauration AJOUTE ce qui manque et met à jour ce qui est plus
   récent dans la sauvegarde. Elle ne supprime jamais rien, et ne remplace
   jamais un état des lieux signé.
   ------------------------------------------------------------------ */

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { db, ecrireMeta, lireMeta } from './base'
import type { Bien, Edl, Entite, Meta, Photo, SignatureImage } from './types'

const FORMAT = 'edl-brenguier-sauvegarde'
export const CLE_DERNIERE = 'derniere-sauvegarde'

type PhotoSansImages = Omit<Photo, 'image' | 'miniature' | 'base'> & { aBase: boolean }
interface Donnees {
  format: typeof FORMAT
  version: 1
  creeLe: string
  versionApp: string
  edls: Edl[]
  biens: Bien[]
  entites: Entite[]
  meta: Meta[]
  photos: PhotoSansImages[]
  signatures: Omit<SignatureImage, 'image'>[]
}

const octets = async (b: Blob) => new Uint8Array(await b.arrayBuffer())

export interface Avancement {
  (fait: number, total: number): void
}

/** Fabrique la sauvegarde complète (fichier .zip). */
export async function creerSauvegarde(avancement: Avancement = () => {}): Promise<{ blob: Blob; nom: string; resume: string }> {
  const [edls, biens, entites, meta, photos, signatures] = await Promise.all([db.edls.toArray(), db.biens.toArray(), db.entites.toArray(), db.meta.toArray(), db.photos.toArray(), db.signatures.toArray()])
  const fichiers: Zippable = {}
  let i = 0
  for (const p of photos) {
    avancement(++i, photos.length + signatures.length)
    // Les images sont déjà compressées (JPEG) : rangées telles quelles (« level 0 »), c'est plus rapide.
    fichiers[`photos/${p.id}.jpg`] = [await octets(p.image), { level: 0 }]
    fichiers[`photos/${p.id}-mini.jpg`] = [await octets(p.miniature), { level: 0 }]
    if (p.base) fichiers[`photos/${p.id}-base.jpg`] = [await octets(p.base), { level: 0 }]
  }
  for (const s of signatures) {
    avancement(++i, photos.length + signatures.length)
    fichiers[`signatures/${s.id}.png`] = [await octets(s.image), { level: 0 }]
  }
  const maintenant = new Date().toISOString()
  const donnees: Donnees = {
    format: FORMAT,
    version: 1,
    creeLe: maintenant,
    versionApp: __APP_VERSION__,
    edls,
    biens,
    entites,
    meta: meta.filter((m) => m.cle !== CLE_DERNIERE),
    photos: photos.map(({ image: _i, miniature: _m, base, ...reste }) => ({ ...reste, aBase: !!base })),
    signatures: signatures.map(({ image: _i, ...reste }) => reste),
  }
  fichiers['donnees.json'] = strToU8(JSON.stringify(donnees))
  const zip = zipSync(fichiers)
  await ecrireMeta(CLE_DERNIERE, maintenant)
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    blob: new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }),
    nom: `EDL-Brenguier-sauvegarde-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`,
    resume: `${edls.length} état(s) des lieux, ${biens.length} bien(s), ${photos.length} photo(s)`,
  }
}

export interface BilanRestauration {
  ajoutes: number
  misAJour: number
  inchanges: number
  signesProteges: number
  photos: number
}

/** Restaure une sauvegarde : ajoute et met à jour, ne supprime jamais rien. */
export async function restaurerSauvegarde(fichier: Blob): Promise<BilanRestauration> {
  let contenu: Record<string, Uint8Array>
  try {
    contenu = unzipSync(await octets(fichier))
  } catch {
    throw new Error('Ce fichier n’est pas une sauvegarde EDL Brenguier (.zip).')
  }
  if (!contenu['donnees.json']) throw new Error('Sauvegarde incomplète : donnees.json est absent.')
  const d = JSON.parse(strFromU8(contenu['donnees.json'])) as Donnees
  if (d.format !== FORMAT) throw new Error('Ce fichier n’est pas une sauvegarde EDL Brenguier.')

  const bilan: BilanRestauration = { ajoutes: 0, misAJour: 0, inchanges: 0, signesProteges: 0, photos: 0 }
  const plusRecent = (a?: string, b?: string) => (a ?? '') > (b ?? '')

  await db.transaction('rw', [db.edls, db.biens, db.entites, db.meta, db.photos, db.signatures], async () => {
    for (const e of d.edls) {
      const actuel = await db.edls.get(e.id)
      if (!actuel) {
        await db.edls.add(e)
        bilan.ajoutes++
      } else if (actuel.statut === 'signe') {
        // Un état des lieux signé sur l'appareil n'est jamais remplacé.
        if (JSON.stringify(actuel) !== JSON.stringify(e)) bilan.signesProteges++
        else bilan.inchanges++
      } else if (e.statut === 'signe' || plusRecent(e.modifieLe, actuel.modifieLe)) {
        await db.edls.put(e)
        bilan.misAJour++
      } else bilan.inchanges++
    }
    for (const b of d.biens) {
      const actuel = await db.biens.get(b.id)
      if (!actuel || plusRecent(b.modifieLe, actuel.modifieLe)) await db.biens.put(b)
    }
    for (const x of d.entites) if (!(await db.entites.get(x.id))) await db.entites.add(x)
    for (const m of d.meta) {
      // Compteur de références : on garde le plus grand, pour ne jamais réutiliser un numéro.
      const actuel = await db.meta.get(m.cle)
      if (!actuel) await db.meta.add(m)
      else if (m.cle.startsWith('compteur-') && Number(m.valeur) > Number(actuel.valeur)) await db.meta.put(m)
    }
    for (const p of d.photos) {
      if (await db.photos.get(p.id)) continue
      const image = contenu[`photos/${p.id}.jpg`]
      const miniature = contenu[`photos/${p.id}-mini.jpg`]
      if (!image || !miniature) continue
      const { aBase, ...reste } = p
      const base = aBase ? contenu[`photos/${p.id}-base.jpg`] : undefined
      await db.photos.add({
        ...reste,
        image: new Blob([image as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }),
        miniature: new Blob([miniature as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }),
        ...(base ? { base: new Blob([base as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }) } : {}),
      })
      bilan.photos++
    }
    for (const s of d.signatures) {
      if (await db.signatures.get(s.id)) continue
      const image = contenu[`signatures/${s.id}.png`]
      if (image) await db.signatures.add({ ...s, image: new Blob([image as Uint8Array<ArrayBuffer>], { type: 'image/png' }) })
    }
  })
  return bilan
}

export async function derniereSauvegarde(): Promise<string | undefined> {
  return lireMeta<string>(CLE_DERNIERE)
}
