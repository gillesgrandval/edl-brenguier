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
import { affinerNoir, trouverRouleaux } from './rouleaux'
import { garderChiffres, sansBords } from './nettoyage'
import { classer, modelesNavigateur, signature } from './gabarits'

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
export function moteur(): Promise<Worker> {
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

/**
 * Prépare l'image : recadrage, agrandissement, niveaux de gris, flou léger, puis noir et blanc.
 * Seuil global (Otsu) par défaut ; seuil local si `local` (éclairage inégal, rouleaux).
 */
export async function preparer(image: Blob, cadre: Cadre, inverser: boolean, entiere: boolean, local = false): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(image)
  const c = cadre
  const sx = Math.round(c.x * bmp.width)
  const sy = Math.round(c.y * bmp.height)
  const sl = Math.max(8, Math.round(c.l * bmp.width))
  const sh = Math.max(8, Math.round(c.h * bmp.height))
  // Un cadre serré autour des chiffres est agrandi pour que les chiffres fassent ~100 px de haut.
  const echelle = entiere ? Math.min(3, 1400 / sl) : Math.min(4, Math.max(1, 160 / sh)) // petites photos agrandies
  const canevas = document.createElement('canvas')
  canevas.width = Math.round(sl * echelle)
  canevas.height = Math.round(sh * echelle)
  const ctx = canevas.getContext('2d', { willReadFrequently: true })!
  ctx.filter = `grayscale(1) contrast(1.4) blur(${Math.max(0.6, echelle * 0.5)}px)`
  ctx.drawImage(bmp, sx, sy, sl, sh, 0, 0, canevas.width, canevas.height)
  bmp.close()

  const img = ctx.getImageData(0, 0, canevas.width, canevas.height)
  const d = img.data
  if (local) {
    // Photo entière : voisinage de la taille d'un chiffre ; cadre serré : un tiers de la hauteur.
    seuilLocal(d, canevas.width, canevas.height, inverser, Math.round(entiere ? Math.min(canevas.width, canevas.height) / 12 : canevas.height / 3))
    ctx.putImageData(img, 0, 0)
    return canevas
  }
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

/**
 * Seuil local : un pixel est un chiffre s'il est nettement plus clair (chiffres blancs, `clairs`)
 * ou plus sombre que la moyenne de son voisinage. Insensible aux reflets et aux ombres.
 */
function seuilLocal(d: Uint8ClampedArray, W: number, H: number, clairs: boolean, rayon: number) {
  const S = new Float64Array((W + 1) * (H + 1)) // image intégrale
  for (let y = 0; y < H; y++) {
    let ligne = 0
    for (let x = 0; x < W; x++) {
      ligne += d[(y * W + x) * 4]
      S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + ligne
    }
  }
  const r = Math.max(4, rayon)
  const ecart = 14
  const sortie = new Uint8Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const xa = Math.max(0, x - r), xb = Math.min(W, x + r + 1), ya = Math.max(0, y - r), yb = Math.min(H, y + r + 1)
      const moyenne = (S[yb * (W + 1) + xb] - S[ya * (W + 1) + xb] - S[yb * (W + 1) + xa] + S[ya * (W + 1) + xa]) / ((xb - xa) * (yb - ya))
      const v = d[(y * W + x) * 4]
      sortie[y * W + x] = (clairs ? v > moyenne + ecart : v < moyenne - ecart) ? 0 : 255
    }
  for (let p = 0; p < W * H; p++) d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = sortie[p]
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

/**
 * Lit une seule ligne de chiffres dans un cadre.
 * Essaie les deux contrastes et deux seuils ; chaque version est lue par Tesseract
 * ET par comparaison à des gabarits. Quand les deux lecteurs sont d'accord, la lecture est sûre.
 */
export async function lireLigne(w: Worker, image: Blob, cadre: Cadre, local = false) {
  const modeles = modelesNavigateur()
  let meilleur = { chiffres: '', confiance: 0, apercu: '', sure: false, variantes: [] as string[] }
  const variantes = new Set<string>()
  const proposer = (chiffres: string, confiance: number, sure: boolean, canevas: HTMLCanvasElement) => {
    if (chiffres.length < 3 || chiffres.length > 9) return
    variantes.add(chiffres)
    if (confiance > meilleur.confiance || (sure && !meilleur.sure)) meilleur = { chiffres, confiance, apercu: canevas.toDataURL('image/png'), sure, variantes: [] }
  }
  for (const seuilLocalActif of local ? [true, false] : [false]) {
    for (const inverser of [true, false]) {
      const brut = await preparer(image, cadre, inverser, false, seuilLocalActif)
      const propre = garderChiffres(brut.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, brut.width, brut.height))
      let canevas = brut
      if (propre.nb >= 2) {
        canevas = document.createElement('canvas')
        canevas.width = propre.image.width
        canevas.height = propre.image.height
        canevas.getContext('2d')!.putImageData(new ImageData(propre.image.data as Uint8ClampedArray<ArrayBuffer>, propre.image.width, propre.image.height), 0, 0)
      }
      // Lecteur 1 : gabarits, chiffre par chiffre (les formes trop éloignées de tout chiffre sont ignorées).
      const lus = propre.pieces.map((p) => classer(signature(p, brut.width), modeles)).filter((r) => r.distance <= 0.7)
      const parGabarits = lus.map((r) => r.chiffre).join('')
      const pire = lus.reduce((m, r) => Math.max(m, r.distance), 0)
      // Lecteur 2 : Tesseract.
      const { data } = await w.recognize(canevas, {}, { text: true, blocks: true })
      const parTesseract = data.text.replace(/\D/g, '')
      if (parTesseract && parTesseract === parGabarits) proposer(parTesseract, 95, true, canevas)
      else {
        // Seul, Tesseract n'est retenu que s'il se dit sûr de lui ; les gabarits, que si chaque chiffre ressemble vraiment à un chiffre.
        if (data.confidence >= 60) proposer(parTesseract, Math.min(85, Math.round(data.confidence)), data.confidence >= 75, canevas)
        if (pire <= 0.42) {
          proposer(parGabarits, Math.round(100 * (1 - pire)), pire <= 0.3, canevas)
          // Chiffre hésitant (deux formes presque aussi proches) : on propose aussi l'autre lecture.
          lus.forEach((r, i) => {
            if (r.distanceSecond - r.distance < 0.06) variantes.add(parGabarits.slice(0, i) + r.second + parGabarits.slice(i + 1))
          })
        }
      }
      if (canevas !== brut) canevas.width = canevas.height = 0
      brut.width = brut.height = 0
      if (meilleur.confiance >= 95) break
    }
    if (meilleur.confiance >= 95) break
  }
  // Les autres lectures possibles sont proposées en un geste (chiffre en train de tourner, etc.).
  meilleur.variantes = [...variantes].filter((v) => v !== meilleur.chiffres)
  return meilleur
}

/** Compteur à rouleaux (eau, gaz) : on repère les décimales rouges et on lit les rouleaux noirs à leur gauche. */
export async function lireCompteurRouleaux(w: Worker, image: Blob): Promise<Lecture | null> {
  const bmp = await createImageBitmap(image)
  const W = Math.min(600, bmp.width), H = Math.round((bmp.height * W) / bmp.width)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, W, H)
  const candidats = trouverRouleaux(ctx.getImageData(0, 0, W, H)).slice(0, 3)
  if (!candidats.length) {
    bmp.close()
    c.width = c.height = 0
    return null
  }
  // Ajustement de la fenêtre noire à pleine résolution, autour de chaque candidat.
  const BW = bmp.width, BH = bmp.height
  const fenetres: Cadre[] = []
  for (const r of candidats) {
    const x0 = Math.max(0, Math.round((r.noir.x - r.noir.l * 0.3) * BW))
    const x1 = Math.round(r.rouge.x * BW)
    const y0 = Math.max(0, Math.round((r.noir.y - r.noir.h) * BH))
    const y1 = Math.min(BH, Math.round((r.noir.y + 2 * r.noir.h) * BH))
    c.width = x1 - x0
    c.height = y1 - y0
    ctx.drawImage(bmp, x0, y0, c.width, c.height, 0, 0, c.width, c.height)
    const f = affinerNoir(ctx.getImageData(0, 0, c.width, c.height))
    if (!f) {
      fenetres.push(r.noir)
      continue
    }
    const m = (f.y1 - f.y0) * 0.08
    fenetres.push({ x: (x0 + f.x0 - m) / BW, y: (y0 + f.y0 - m) / BH, l: (f.x1 - f.x0 + 2 * m) / BW, h: (f.y1 - f.y0 + 2 * m) / BH })
  }
  bmp.close()
  c.width = c.height = 0
  await w.setParameters({ tessedit_pageseg_mode: '7' as never })
  const lectures: Lecture[] = []
  for (const zone of fenetres) {
    const l = await lireLigne(w, image, zone, true)
    if (l.chiffres) lectures.push({ index: l.chiffres, confiance: l.confiance, autres: l.variantes, apercu: l.apercu, zone, sure: l.sure })
  }
  // Des rouleaux ont été repérés mais pas lus : on montre la zone et on demande un cadre,
  // plutôt que de chercher des chiffres ailleurs sur la photo (n° de série…).
  if (!lectures.length) return { index: '', confiance: 0, autres: [], zone: fenetres[0], sure: false }
  lectures.sort((a, b) => Number(b.sure) - Number(a.sure))
  const [premiere, ...suivantes] = lectures
  premiere.autres = [...new Set([...premiere.autres, ...suivantes.map((l) => l.index)])].filter((a) => a.length >= 3 && a !== premiere.index).slice(0, 4)
  return premiere
}

export async function lireIndex(image: Blob, cadre: Cadre | null): Promise<Lecture> {
  const w = await moteur()
  if (!cadre) {
    const rouleaux = await lireCompteurRouleaux(w, image)
    if (rouleaux) return rouleaux
  }
  // Cadre tracé : une seule ligne de chiffres. Photo entière : texte épars.
  await w.setParameters({ tessedit_pageseg_mode: (cadre ? '7' : '11') as never })
  let meilleure: Lecture | null = null
  const score = (l: Lecture) => (l.index ? l.confiance + Math.min(l.index.length, 8) * 4 : -1)
  // Trois traitements : seuil global (chiffres foncés puis clairs), puis seuil local pour
  // chiffres foncés, indispensable sur les écrans LCD (écran clair dans un boîtier sombre).
  for (const [inverser, local] of [[false, false], [true, false], [false, true]]) {
    const canevas = await preparer(image, cadre ?? SANS_BANDEAU, inverser, !cadre, local)
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
      segments = decoderSeptSegments(sansBords(ctx.getImageData(0, 0, canevas.width, canevas.height)))
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
      const zoom = await preparer(image, auto, inverser, false, local)
      segments = decoderSeptSegments(sansBords(zoom.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, zoom.width, zoom.height)))
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
  // Cadre tracé : on tente aussi la lecture fine (seuil local, gabarits), souvent meilleure sur les rouleaux.
  if (cadre) {
    const l = await lireLigne(w, image, cadre, true)
    const m = meilleure!
    if (l.chiffres && ((l.sure && !m.sure) || (l.sure === m.sure && l.confiance > m.confiance))) {
      if (m.index && m.index !== l.chiffres) m.autres.unshift(m.index)
      meilleure = { ...m, index: l.chiffres, confiance: l.confiance, sure: l.sure, apercu: l.apercu || m.apercu }
      m.autres.push(...l.variantes)
    } else if (l.chiffres && l.chiffres !== m.index) m.autres.unshift(l.chiffres, ...l.variantes)
  }
  const fin = meilleure!
  // Lecture sans aucune assurance : on ne suggère rien plutôt qu'un nombre pris au hasard
  // (n° de série, date…). L'utilisateur trace alors un cadre.
  if (fin.confiance < 40 && !fin.sure) return { index: '', confiance: 0, autres: [], sure: false, apercu: fin.apercu, zone: cadre ?? undefined }
  fin.autres = [...new Set(fin.autres.filter((a) => a !== fin.index && a.length >= 3))].slice(0, 4)
  return fin
}
