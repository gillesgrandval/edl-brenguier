import { db, nouvelId } from '../db/base'
import type { Photo } from '../db/types'

/* ------------------------------------------------------------------
   Traitement des photos, entièrement sur la tablette :
   1. redressement selon l'orientation de l'appareil ;
   2. réduction à 1 600 px sur le grand côté (≈ 250-400 Ko) ;
   3. bandeau incrusté en bas : référence, pièce, élément, n° et date-heure ;
   4. création d'une miniature pour l'affichage rapide.
   ------------------------------------------------------------------ */

const TAILLE_MAX = 1600
const TAILLE_MINIATURE = 360
const QUALITE = 0.8

function versBlob(c: HTMLCanvasElement, qualite: number): Promise<Blob> {
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('Conversion impossible'))), 'image/jpeg', qualite))
}

/** Tronque un texte pour qu'il tienne dans la largeur donnée. */
function ajuster(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string {
  if (ctx.measureText(texte).width <= largeur) return texte
  let t = texte
  while (t.length > 4 && ctx.measureText(t + '…').width > largeur) t = t.slice(0, -1)
  return t + '…'
}

function dessinerBandeau(ctx: CanvasRenderingContext2D, w: number, h: number, gauche: string, droite: string) {
  const police = Math.max(16, Math.round(w * 0.017))
  const hauteur = Math.round(police * 2.1)
  const marge = Math.round(police * 0.8)
  ctx.fillStyle = 'rgba(28, 43, 58, 0.82)'
  ctx.fillRect(0, h - hauteur, w, hauteur)
  ctx.fillStyle = '#A8763E'
  ctx.fillRect(0, h - hauteur, w, Math.max(2, Math.round(police * 0.12)))
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${police}px Carlito, Calibri, sans-serif`
  const largeurDroite = ctx.measureText(droite).width
  ctx.fillStyle = '#E9DCC9'
  ctx.textAlign = 'right'
  ctx.fillText(droite, w - marge, h - hauteur / 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'left'
  ctx.fillText(ajuster(ctx, gauche, w - largeurDroite - marge * 3), marge, h - hauteur / 2)
}

export async function traiterPhoto(fichier: Blob, legende: string, date: Date): Promise<{ image: Blob; miniature: Blob }> {
  await document.fonts?.load('700 20px Carlito').catch(() => undefined)
  const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
  const echelle = Math.min(1, TAILLE_MAX / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * echelle)
  const h = Math.round(bmp.height * echelle)

  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()

  const horodatage = date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  dessinerBandeau(ctx, w, h, legende, horodatage)
  const image = await versBlob(c, QUALITE)

  const em = Math.min(1, TAILLE_MINIATURE / Math.max(w, h))
  const m = document.createElement('canvas')
  m.width = Math.round(w * em)
  m.height = Math.round(h * em)
  m.getContext('2d')!.drawImage(c, 0, 0, m.width, m.height)
  const miniature = await versBlob(m, 0.7)

  // Libère la mémoire tout de suite (important sur tablette).
  c.width = c.height = m.width = m.height = 0
  return { image, miniature }
}

/** Numéro suivant, unique et jamais réutilisé dans un même état des lieux. */
async function prochainNumero(edlId: string): Promise<number> {
  const cle = `photos-${edlId}`
  return db.transaction('rw', db.meta, async () => {
    const n = (((await db.meta.get(cle))?.valeur as number | undefined) ?? 0) + 1
    await db.meta.put({ cle, valeur: n })
    return n
  })
}

/** Traite et enregistre une photo ; renvoie son identifiant. */
export async function enregistrerPhoto(params: {
  fichier: Blob
  edlId: string
  reference: string
  pieceId: string
  pieceNom: string
  elementId?: string
  elementNom?: string
}): Promise<{ id: string; numero: number }> {
  const numero = await prochainNumero(params.edlId)
  const date = new Date()
  const legende = [params.reference, params.pieceNom, params.elementNom ?? "Vue d'ensemble", `Photo ${numero}`].join('  ·  ')
  const { image, miniature } = await traiterPhoto(params.fichier, legende, date)
  const photo: Photo = {
    id: nouvelId(),
    edlId: params.edlId,
    pieceId: params.pieceId,
    elementId: params.elementId,
    numero,
    image,
    miniature,
    legende,
    priseLe: date.toISOString(),
  }
  await db.photos.add(photo)
  return { id: photo.id, numero }
}

export async function supprimerPhotos(ids: string[]): Promise<void> {
  if (ids.length) await db.photos.bulkDelete(ids)
}
