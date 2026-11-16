/* ------------------------------------------------------------------
   Nettoyage d'une ligne de chiffres déjà en noir (encre) sur blanc :
   on ne garde que les formes qui ont la taille d'un chiffre.
   Disparaissent : tirets entre les rouleaux, poussières, reflets,
   bords du cadre (formes trop larges ou trop plates).
   ------------------------------------------------------------------ */

import type { ImageBinaire } from './septSegments'
import type { Piece } from './gabarits'

export function garderChiffres(img: ImageBinaire): { image: ImageBinaire; nb: number; pieces: Piece[] } {
  const { width: W, height: H, data } = img
  const encre = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) encre[p] = data[p * 4] < 128 ? 1 : 0
  const etiquette = new Int32Array(W * H).fill(-1)
  const formes: { x0: number; y0: number; x1: number; y1: number; n: number; bord: boolean }[] = []
  const pile: number[] = []
  for (let p = 0; p < W * H; p++) {
    if (!encre[p] || etiquette[p] >= 0) continue
    const f = { x0: W, y0: H, x1: 0, y1: 0, n: 0, bord: false }
    const id = formes.length
    etiquette[p] = id
    pile.push(p)
    while (pile.length) {
      const q = pile.pop()!
      const x = q % W, y = (q / W) | 0
      f.n++
      if (x < f.x0) f.x0 = x
      if (x > f.x1) f.x1 = x
      if (y < f.y0) f.y0 = y
      if (y > f.y1) f.y1 = y
      if (x === 0 || x === W - 1) f.bord = true
      if (x > 0 && encre[q - 1] && etiquette[q - 1] < 0) { etiquette[q - 1] = id; pile.push(q - 1) }
      if (x < W - 1 && encre[q + 1] && etiquette[q + 1] < 0) { etiquette[q + 1] = id; pile.push(q + 1) }
      if (y > 0 && encre[q - W] && etiquette[q - W] < 0) { etiquette[q - W] = id; pile.push(q - W) }
      if (y < H - 1 && encre[q + W] && etiquette[q + W] < 0) { etiquette[q + W] = id; pile.push(q + W) }
    }
    formes.push(f)
  }
  const valide = (h: number, l: number, n: number, bord: boolean) => {
    if (h < H * 0.3) return false // tiret, poussière
    if (l > h * 1.3 || l > W * 0.35) return false // trait du cadre, reflet
    if (bord && l < h * 0.25 && h > H * 0.85) return false // bord vertical de la fenêtre
    if (n < l * h * 0.08) return false // contour fantôme
    return true
  }
  const retenus: { pixels: number[]; x0: number; x1: number; y0: number; y1: number }[] = []
  const pixels: number[][] = formes.map(() => [])
  for (let p = 0; p < W * H; p++) if (etiquette[p] >= 0) pixels[etiquette[p]].push(p)
  formes.forEach((f, id) => {
    const h = f.y1 - f.y0 + 1, l = f.x1 - f.x0 + 1
    if (valide(h, l, f.n, f.bord)) {
      retenus.push({ pixels: pixels[id], x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1 })
      return
    }
    // Forme trop large mais assez haute : souvent des chiffres reliés par les tirets
    // entre rouleaux. On coupe aux colonnes presque vides et on réexamine chaque morceau.
    if (h < H * 0.3) return
    const compte = new Array(l).fill(0)
    for (const p of pixels[id]) compte[(p % W) - f.x0]++
    const seuil = Math.max(2, h * 0.15)
    for (let x = 0; x <= l; x++) {
      if (x < l && compte[x] > seuil) continue
      // fin d'un morceau [debut, x)
      let debut = x
      while (debut > 0 && compte[debut - 1] > seuil) debut--
      if (debut === x) continue
      const morceau = pixels[id].filter((p) => {
        const c = (p % W) - f.x0
        return c >= debut && c < x
      })
      let y0 = H, y1 = 0
      for (const p of morceau) {
        const y = (p / W) | 0
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
      if (valide(y1 - y0 + 1, x - debut, morceau.length, false)) {
        retenus.push({ pixels: morceau, x0: f.x0 + debut, x1: f.x0 + x - 1, y0, y1 })
      }
    }
  })
  // Les chiffres d'un index sont alignés et de même taille : on écarte ce qui dépasse
  // (étiquette, vis, bord du cadre) en se calant sur la hauteur et la ligne médianes.
  const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1]
  const hm = retenus.length ? mediane(retenus.map((r) => r.y1 - r.y0 + 1)) : 0
  const cm = retenus.length ? mediane(retenus.map((r) => (r.y0 + r.y1) / 2)) : 0
  const alignes = retenus.filter((r) => {
    const h = r.y1 - r.y0 + 1
    return h >= hm * 0.65 && h <= hm * 1.5 && Math.abs((r.y0 + r.y1) / 2 - cm) <= hm * 0.3
  })
  const garde = new Uint8Array(W * H)
  for (const r of alignes) for (const p of r.pixels) garde[p] = 1
  const nb = alignes.length
  // On recompose l'image, recadrée sur les chiffres gardés, avec une marge blanche
  // (Tesseract lit mieux avec de l'air autour).
  let bx0 = W, by0 = H, bx1 = 0, by1 = 0
  for (let p = 0; p < W * H; p++) {
    if (!garde[p]) continue
    const x = p % W, y = (p / W) | 0
    if (x < bx0) bx0 = x
    if (x > bx1) bx1 = x
    if (y < by0) by0 = y
    if (y > by1) by1 = y
  }
  if (bx1 < bx0) return { image: img, nb: 0, pieces: [] }
  const marge = Math.round((by1 - by0 + 1) * 0.3)
  const W2 = bx1 - bx0 + 1 + 2 * marge, H2 = by1 - by0 + 1 + 2 * marge
  const sortie = new Uint8ClampedArray(W2 * H2 * 4).fill(255)
  for (let p = 0; p < W * H; p++) {
    if (!garde[p]) continue
    const x = (p % W) - bx0 + marge, y = ((p / W) | 0) - by0 + marge
    const k = (y * W2 + x) * 4
    sortie[k] = sortie[k + 1] = sortie[k + 2] = 0
  }
  return { image: { width: W2, height: H2, data: sortie }, nb, pieces: alignes.sort((a, b) => a.x0 - b.x0) }
}

/**
 * Retire les bords (cadre de l'écran, ombre du boîtier) : formes qui touchent le bord de
 * l'image et qui sont très larges ou très hautes. Les segments d'un afficheur LCD,
 * séparés les uns des autres, sont conservés tels quels.
 */
export function sansBords(img: ImageBinaire): ImageBinaire {
  const { width: W, height: H, data } = img
  const sortie = new Uint8ClampedArray(data)
  const vu = new Uint8Array(W * H)
  const pile: number[] = []
  for (let p = 0; p < W * H; p++) {
    if (vu[p] || data[p * 4] >= 128) continue
    const forme: number[] = []
    let x0 = W, x1 = 0, y0 = H, y1 = 0
    vu[p] = 1
    pile.push(p)
    while (pile.length) {
      const q = pile.pop()!
      forme.push(q)
      const x = q % W, y = (q / W) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (const [v, ok] of [[q - 1, x > 0], [q + 1, x < W - 1], [q - W, y > 0], [q + W, y < H - 1]] as const)
        if (ok && !vu[v] && data[v * 4] < 128) {
          vu[v] = 1
          pile.push(v)
        }
    }
    const touche = x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1
    if (touche && (x1 - x0 > W * 0.3 || y1 - y0 > H * 0.8))
      for (const q of forme) sortie[q * 4] = sortie[q * 4 + 1] = sortie[q * 4 + 2] = 255
  }
  return { width: W, height: H, data: sortie }
}
