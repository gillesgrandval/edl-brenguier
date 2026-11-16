/* ------------------------------------------------------------------
   Repérage des compteurs à rouleaux (eau, gaz, anciens compteurs).
   Sur ces compteurs, les m³ sont sur des rouleaux noirs (chiffres blancs)
   et les décimales sur des rouleaux ROUGES, juste à droite.
   On cherche donc une zone rouge compacte précédée d'une bande sombre :
   la bande sombre, c'est l'index à relever.
   ------------------------------------------------------------------ */

import type { Cadre } from './lireIndex'

export interface ImageCouleur {
  width: number
  height: number
  data: Uint8ClampedArray | number[]
}

export interface Rouleaux {
  /** Partie noire (index en m³), en coordonnées relatives. */
  noir: Cadre
  /** Partie rouge (décimales). */
  rouge: Cadre
  score: number
}

const lum = (d: ImageCouleur['data'], i: number) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
/** Noir « neutre » : sombre et peu coloré (le corps bleu d'un compteur est sombre mais coloré). */
const noirNeutre = (d: ImageCouleur['data'], i: number) => lum(d, i) < 90 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 45

/** On photographie le compteur au centre : un compteur au bord de la photo compte moins. */
const centrage = (x: number, y: number) => 1 - Math.min(0.8, Math.hypot(x - 0.5, y - 0.5) * 1.2)

export function trouverRouleaux(img: ImageCouleur): Rouleaux[] {
  const { width: W, height: H, data: d } = img
  // 1. Masque des pixels rouges francs.
  const rouge = new Uint8Array(W * H)
  for (let p = 0, i = 0; p < W * H; p++, i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    if (r > 100 && r > 1.6 * g && r > 1.5 * b) rouge[p] = 1
  }
  // 2. Fermeture (les chiffres blancs coupent la zone rouge) : dilatation horizontale/verticale.
  const rayon = Math.max(1, Math.round(W / 250))
  const ferme = new Uint8Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!rouge[y * W + x]) continue
      for (let j = Math.max(0, y - rayon); j <= Math.min(H - 1, y + rayon); j++)
        for (let i = Math.max(0, x - rayon); i <= Math.min(W - 1, x + rayon); i++) ferme[j * W + i] = 1
    }
  // 3. Composantes connexes.
  const vu = new Int32Array(W * H).fill(-1)
  const zones: { x0: number; y0: number; x1: number; y1: number; n: number }[] = []
  const pile: number[] = []
  for (let p = 0; p < W * H; p++) {
    if (!ferme[p] || vu[p] >= 0) continue
    const z = { x0: W, y0: H, x1: 0, y1: 0, n: 0 }
    vu[p] = zones.length
    pile.push(p)
    while (pile.length) {
      const q = pile.pop()!
      const x = q % W, y = (q / W) | 0
      z.n++
      if (x < z.x0) z.x0 = x
      if (x > z.x1) z.x1 = x
      if (y < z.y0) z.y0 = y
      if (y > z.y1) z.y1 = y
      for (const v of [q - 1, q + 1, q - W, q + W]) {
        if (v < 0 || v >= W * H || vu[v] >= 0 || !ferme[v]) continue
        if ((v === q - 1 && x === 0) || (v === q + 1 && x === W - 1)) continue
        vu[v] = zones.length
        pile.push(v)
      }
    }
    zones.push(z)
  }

  const resultats: Rouleaux[] = []
  for (const z of zones) {
    const l = z.x1 - z.x0 + 1, h = z.y1 - z.y0 + 1
    if (h < H * 0.012 || l < h * 0.8 || l > h * 6) continue
    if (z.n / (l * h) < 0.45) continue // une aiguille, un trait : pas une fenêtre de rouleaux
    // 4. Bande sombre à gauche, à la même hauteur.
    const ya = Math.round(z.y0 + h * 0.15), yb = Math.round(z.y1 - h * 0.15)
    const sombre = (x: number) => {
      let n = 0
      for (let y = ya; y <= yb; y++) if (noirNeutre(d, (y * W + x) * 4)) n++
      return n / (yb - ya + 1)
    }
    let x = z.x0 - 1, trou = 0, gauche = z.x0
    const trouMax = Math.max(1, Math.round(h * 0.3))
    while (x >= 0 && trou <= trouMax) {
      if (sombre(x) > 0.3) {
        gauche = x
        trou = 0
      } else trou++
      x--
    }
    const largeurNoire = z.x0 - gauche
    if (largeurNoire < h * 1.2) continue // pas assez de rouleaux noirs : ce n'est pas un compteur
    // Bande vraiment sombre en moyenne ?
    // Bande sombre en moyenne, avec des chiffres clairs dedans.
    let somme = 0, nb = 0, clairs = 0
    for (let y = ya; y <= yb; y++)
      for (let xx = gauche; xx < z.x0; xx++) {
        const v = lum(d, (y * W + xx) * 4)
        somme += v
        if (v > 140) clairs++
        nb++
      }
    const moyenne = somme / nb
    if (moyenne > 120 || clairs / nb < 0.06 || clairs / nb > 0.55) continue
    const marge = h * 0.15
    const noir: Cadre = {
      x: Math.max(0, gauche - marge) / W,
      y: Math.max(0, z.y0 - marge) / H,
      l: (z.x0 - gauche + marge) / W,
      h: Math.min(H - z.y0, h + 2 * marge) / H,
    }
    resultats.push({ noir, rouge: { x: z.x0 / W, y: z.y0 / H, l: l / W, h: h / H }, score: largeurNoire * h * (1 - moyenne / 255) * centrage((gauche + z.x1) / 2 / W, (z.y0 + z.y1) / 2 / H) })
  }
  return resultats.sort((a, b) => b.score - a.score)
}

/**
 * Ajuste la fenêtre noire à pleine résolution.
 * `img` est un extrait de la photo dont le bord droit touche les rouleaux rouges.
 * Rend la fenêtre (en pixels de l'extrait) : rangées puis colonnes majoritairement noires.
 */
export function affinerNoir(img: ImageCouleur): { x0: number; y0: number; x1: number; y1: number } | null {
  const { width: W, height: H, data: d } = img
  const n = (x: number, y: number) => noirNeutre(d, (y * W + x) * 4)
  // Rangées qui traversent les chiffres : fond noir ET alternances clair/sombre (chiffres blancs).
  // Le cadre métallique, gris et uniforme, est ainsi écarté.
  const xa = Math.round(W * 0.3)
  const pasMin = Math.max(2, Math.round(H / 60)) // ignore le grain de la photo
  const score = Array.from({ length: H }, (_, y) => {
    let sombres = 0, alternances = 0, etat = 0, duree = 0
    for (let x = xa; x < W; x++) {
      const i = (y * W + x) * 4
      if (noirNeutre(d, i)) sombres++
      const v = lum(d, i)
      const e = v > 140 ? 1 : v < 90 ? -1 : 0
      if (e && e !== etat) {
        if (etat && duree >= pasMin) alternances++
        etat = e
        duree = 0
      }
      duree++
    }
    return alternances * (sombres / (W - xa))
  })
  // Lissage sur 3 rangées.
  const lisse = score.map((_, y) => (score[Math.max(0, y - 1)] + score[y] + score[Math.min(H - 1, y + 1)]) / 3)
  let ymax = 0
  for (let y = 1; y < H; y++) if (lisse[y] > lisse[ymax]) ymax = y
  if (lisse[ymax] <= 0) return null
  let ya = ymax, yb = ymax
  while (ya > 0 && lisse[ya - 1] >= lisse[ymax] * 0.3) ya--
  while (yb < H - 1 && lisse[yb + 1] >= lisse[ymax] * 0.3) yb++
  const ext = Math.round((yb - ya) * 0.1)
  const y0 = Math.max(0, ya - ext), y1 = Math.min(H, yb + 1 + ext)
  if (y1 - y0 < H * 0.12) return null
  // Colonnes : de la droite vers la gauche tant que c'est noir (petites coupures tolérées).
  const colonne = (x: number) => {
    let k = 0
    for (let y = y0; y < y1; y++) if (n(x, y)) k++
    return k / (y1 - y0)
  }
  const trouMax = Math.max(2, Math.round((y1 - y0) * 0.4)) // un chiffre blanc coupe le noir sur ~ sa largeur
  let gauche = W - 1, trou = 0, droite = -1
  for (let x = W - 1; x >= 0 && trou <= trouMax; x--) {
    if (colonne(x) > 0.2) {
      if (droite < 0) droite = x
      gauche = x
      trou = 0
    } else if (droite >= 0) trou++
  }
  if (droite < 0 || droite - gauche < (y1 - y0)) return null
  return { x0: gauche, y0, x1: droite + 1, y1 }
}
