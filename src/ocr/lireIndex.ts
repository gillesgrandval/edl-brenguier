/* ------------------------------------------------------------------
   Lecture automatique de l'index d'un compteur sur une photo,
   100 % sur la tablette (Tesseract, moteur libre), sans réseau.

   Pour fiabiliser la lecture :
   - on ne lit que des chiffres ;
   - l'image est convertie en noir et blanc avec un seuil automatique ;
   - un léger flou relie les segments des afficheurs numériques (Linky) ;
   - on essaie les deux contrastes (chiffres foncés / chiffres clairs)
     et on garde la lecture la plus sûre.
   Le résultat est toujours proposé à l'utilisateur, jamais imposé.
   ------------------------------------------------------------------ */

import type { Worker } from 'tesseract.js'
import { decoderSeptSegments } from './septSegments'

export interface Cadre {
  /** Coordonnées relatives (0 à 1) dans l'image. */
  x: number
  y: number
  l: number
  h: number
}

export interface Lecture {
  index: string
  confiance: number
  /** Autres suites de chiffres trouvées (n° de série, etc.). */
  autres: string[]
  apercu?: string
  /** Zone de la photo où l'index a été lu (affichée à l'écran). */
  zone?: Cadre
  /** true si la lecture est assez sûre pour être proposée d'office. */
  sure: boolean
}

let promesseWorker: Promise<Worker> | null = null

/** Charge le moteur une seule fois (quelques secondes la première fois). */
function moteur(): Promise<Worker> {
  promesseWorker ??= (async () => {
    const { createWorker } = await import('tesseract.js')
    const base = `${import.meta.env.BASE_URL}ocr`
    const w = await createWorker('eng', 1, {
      workerPath: `${base}/worker.min.js`,
      corePath: base,
      langPath: `${base}/lang`,
      gzip: true,
      cacheMethod: 'none', // déjà mis en cache par l'application
      workerBlobURL: false,
    })
    await w.setParameters({ tessedit_char_whitelist: '0123456789' })
    return w
  })().catch((e) => {
    promesseWorker = null
    throw e
  })
  return promesseWorker
}

/** Prépare l'image : recadrage, agrandissement, niveaux de gris, flou léger, seuil d'Otsu. */
async function preparer(image: Blob, cadre: Cadre, inverser: boolean, entiere: boolean): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(image)
  const c = cadre
  const sx = Math.round(c.x * bmp.width)
  const sy = Math.round(c.y * bmp.height)
  const sl = Math.max(8, Math.round(c.l * bmp.width))
  const sh = Math.max(8, Math.round(c.h * bmp.height))
  // Un cadre serré autour des chiffres est agrandi pour que les chiffres fassent ~100 px de haut.
  const echelle = entiere ? Math.min(1, 1400 / sl) : Math.min(4, Math.max(1, 160 / sh))
  const canevas = document.createElement('canvas')
  canevas.width = Math.round(sl * echelle)
  canevas.height = Math.round(sh * echelle)
  const ctx = canevas.getContext('2d', { willReadFrequently: true })!
  ctx.filter = `grayscale(1) contrast(1.4) blur(${Math.max(0.6, echelle * 0.5)}px)`
  ctx.drawImage(bmp, sx, sy, sl, sh, 0, 0, canevas.width, canevas.height)
  bmp.close()

  const img = ctx.getImageData(0, 0, canevas.width, canevas.height)
  const d = img.data
  // Histogramme et seuil d'Otsu.
  const histo = new Array(256).fill(0)
  for (let i = 0; i < d.length; i += 4) histo[d[i]]++
  const total = d.length / 4
  let somme = 0
  for (let i = 0; i < 256; i++) somme += i * histo[i]
  let sB = 0, wB = 0, max = 0, seuil = 128
  for (let t = 0; t < 256; t++) {
    wB += histo[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sB += t * histo[t]
    const mB = sB / wB
    const mF = (somme - sB) / wF
    const v = wB * wF * (mB - mF) ** 2
    if (v > max) {
      max = v
      seuil = t
    }
  }
  for (let i = 0; i < d.length; i += 4) {
    let v = d[i] > seuil ? 255 : 0
    if (inverser) v = 255 - v
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return canevas
}

/** Nombres trouvés, du plus gros (en hauteur de caractères) au plus petit : l'index est presque toujours le plus gros. */
function nombres(data: { text: string; confidence: number; blocks?: { paragraphs: { lines: { text: string; confidence: number; bbox: { x0: number; x1: number; y0: number; y1: number } }[] }[] }[] | null }) {
  const lignes = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
  const trouves = lignes
    .map((l) => ({ chiffres: l.text.replace(/\D/g, ''), hauteur: l.bbox.y1 - l.bbox.y0, confiance: l.confidence, bbox: l.bbox }))
    .filter((l) => l.chiffres.length >= 3)
    .sort((a, b) => b.hauteur - a.hauteur || b.confiance - a.confiance)
  const vus = new Set<string>()
  return trouves.filter((t) => !vus.has(t.chiffres) && vus.add(t.chiffres))
}

/** Hors cadre, on ignore le bas de la photo : le bandeau horodaté contient des chiffres (date, n° de photo). */
const SANS_BANDEAU: Cadre = { x: 0, y: 0, l: 1, h: 0.92 }

export async function lireIndex(image: Blob, cadre: Cadre | null): Promise<Lecture> {
  const w = await moteur()
  // Cadre tracé : une seule ligne de chiffres. Photo entière : texte épars.
  await w.setParameters({ tessedit_pageseg_mode: (cadre ? '7' : '11') as never })
  let meilleure: Lecture | null = null
  const score = (l: Lecture) => (l.index ? l.confiance + Math.min(l.index.length, 8) * 4 : -1)
  for (const inverser of [false, true]) {
    const canevas = await preparer(image, cadre ?? SANS_BANDEAU, inverser, !cadre)
    const { data } = await w.recognize(canevas, {}, { text: true, blocks: true })
    const trouves = nombres(data)
    const lecture: Lecture = {
      index: trouves[0]?.chiffres ?? '',
      confiance: Math.round(trouves[0]?.confiance ?? 0),
      autres: trouves.slice(1, 4).map((t) => t.chiffres),
      apercu: canevas.toDataURL('image/png'),
      zone: cadre ?? undefined,
      sure: false,
    }
    // Afficheur numérique : le décodeur 7 segments est plus sûr que Tesseract quand il lit tous les chiffres.
    // Sans cadre tracé, on recadre automatiquement sur le plus gros nombre trouvé.
    let segments: string | null = null
    if (cadre) {
      const ctx = canevas.getContext('2d', { willReadFrequently: true })!
      segments = decoderSeptSegments(ctx.getImageData(0, 0, canevas.width, canevas.height))
    } else if (trouves[0]) {
      const b = trouves[0].bbox
      const mx = (b.x1 - b.x0) * 0.12, my = (b.y1 - b.y0) * 0.25
      const auto: Cadre = {
        x: Math.max(0, (b.x0 - mx) / canevas.width) * SANS_BANDEAU.l,
        y: Math.max(0, (b.y0 - my) / canevas.height) * SANS_BANDEAU.h,
        l: Math.min(1, (b.x1 - b.x0 + 2 * mx) / canevas.width) * SANS_BANDEAU.l,
        h: Math.min(1, (b.y1 - b.y0 + 2 * my) / canevas.height) * SANS_BANDEAU.h,
      }
      lecture.zone = auto
      const zoom = await preparer(image, auto, inverser, false)
      segments = decoderSeptSegments(zoom.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, zoom.width, zoom.height))
      zoom.width = zoom.height = 0
    }
    {
      if (segments && segments.length >= lecture.index.length) {
        if (lecture.index && lecture.index !== segments) lecture.autres.unshift(lecture.index)
        lecture.index = segments
        lecture.confiance = Math.max(lecture.confiance, 90)
      } else if (segments && segments !== lecture.index) {
        lecture.autres.unshift(segments)
      }
    }
    // Sûre : décodée en 7 segments, ou lue par Tesseract avec une bonne fiabilité et une longueur plausible (4 à 9 chiffres).
    lecture.sure = !!lecture.index && (lecture.confiance >= 90 || (lecture.confiance >= 65 && lecture.index.length >= 4 && lecture.index.length <= 9))
    canevas.width = canevas.height = 0
    if (!meilleure || score(lecture) > score(meilleure)) meilleure = lecture
    if (lecture.index && lecture.confiance >= 80) break
  }
  meilleure!.autres = [...new Set(meilleure!.autres.filter((a) => a !== meilleure!.index))].slice(0, 4)
  return meilleure!
}
