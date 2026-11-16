/* ------------------------------------------------------------------
   Reconnaissance d'un chiffre isolé par comparaison à des gabarits.
   Chaque chiffre (déjà détouré en noir) est réduit à une grille 12 × 20
   de taux d'encre, puis comparé aux chiffres 0-9 dessinés dans plusieurs
   polices. Robuste sur les rouleaux des compteurs d'eau, où Tesseract
   (fait pour du texte) échoue souvent.
   ------------------------------------------------------------------ */

export const GX = 8
export const GY = 12

export interface Signature {
  grille: Float32Array
  /** largeur / hauteur */
  ratio: number
}

export interface Piece {
  x0: number
  y0: number
  x1: number
  y1: number
  /** Index des pixels (y * largeur + x) dans l'image d'origine. */
  pixels: number[]
}

export function signature(p: Piece, largeur: number): Signature {
  const l = p.x1 - p.x0 + 1, h = p.y1 - p.y0 + 1
  const grille = new Float32Array(GX * GY)
  for (const q of p.pixels) {
    const x = (q % largeur) - p.x0, y = ((q / largeur) | 0) - p.y0
    grille[Math.min(GY - 1, ((y * GY) / h) | 0) * GX + Math.min(GX - 1, ((x * GX) / l) | 0)]++
  }
  const aire = (l / GX) * (h / GY)
  for (let i = 0; i < grille.length; i++) grille[i] = Math.min(1, grille[i] / aire)
  // Flou 3 × 3 puis normalisation (moyenne nulle, norme 1) : la comparaison devient
  // insensible à l'épaisseur du trait et à la luminosité.
  const flou = new Float32Array(GX * GY)
  for (let y = 0; y < GY; y++)
    for (let x = 0; x < GX; x++) {
      let s = 0, n = 0
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const xx = x + i, yy = y + j
          if (xx < 0 || yy < 0 || xx >= GX || yy >= GY) continue
          const poids = i === 0 && j === 0 ? 2 : 1
          s += grille[yy * GX + xx] * poids
          n += poids
        }
      flou[y * GX + x] = s / n
    }
  const moyenne = flou.reduce((a, b) => a + b, 0) / flou.length
  let norme = 0
  for (let i = 0; i < flou.length; i++) {
    flou[i] -= moyenne
    norme += flou[i] * flou[i]
  }
  norme = Math.sqrt(norme) || 1
  for (let i = 0; i < flou.length; i++) flou[i] /= norme
  return { grille: flou, ratio: l / h }
}

export interface Modele {
  chiffre: string
  s: Signature
}

export function classer(s: Signature, modeles: Modele[]): { chiffre: string; distance: number; second: string; distanceSecond: number } {
  // Meilleure distance par chiffre, puis les deux meilleurs chiffres.
  const parChiffre = new Map<string, number>()
  for (const m of modeles) {
    let produit = 0
    for (let i = 0; i < s.grille.length; i++) produit += s.grille[i] * m.s.grille[i]
    const d = 1 - produit + 0.25 * Math.abs(Math.log(s.ratio / m.s.ratio))
    if (d < (parChiffre.get(m.chiffre) ?? Infinity)) parChiffre.set(m.chiffre, d)
  }
  const tri = [...parChiffre.entries()].sort((a, b) => a[1] - b[1])
  return { chiffre: tri[0]?.[0] ?? '?', distance: tri[0]?.[1] ?? Infinity, second: tri[1]?.[0] ?? '?', distanceSecond: tri[1]?.[1] ?? Infinity }
}

let cache: Modele[] | null = null

/** Gabarits dessinés avec les polices de l'appareil (une seule fois). */
export function modelesNavigateur(): Modele[] {
  if (cache) return cache
  const polices = ['bold 120px sans-serif', '120px sans-serif', 'bold 120px Arial', 'bold 120px "Roboto Condensed", sans-serif', '120px monospace', 'bold 120px serif']
  const c = document.createElement('canvas')
  c.width = 120
  c.height = 160
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const modeles: Modele[] = []
  for (const police of polices)
    for (const epaisseur of [0, 8, 16])
    for (const chiffre of '0123456789') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.fillStyle = '#000'
      ctx.font = police
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(chiffre, 60, 80)
      if (epaisseur) {
        ctx.lineWidth = epaisseur
        ctx.strokeStyle = '#000'
        ctx.strokeText(chiffre, 60, 80)
      }
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      const p: Piece = { x0: c.width, y0: c.height, x1: 0, y1: 0, pixels: [] }
      for (let q = 0; q < c.width * c.height; q++) {
        if (d[q * 4] >= 128) continue
        const x = q % c.width, y = (q / c.width) | 0
        p.pixels.push(q)
        if (x < p.x0) p.x0 = x
        if (x > p.x1) p.x1 = x
        if (y < p.y0) p.y0 = y
        if (y > p.y1) p.y1 = y
      }
      if (p.pixels.length) modeles.push({ chiffre, s: signature(p, c.width) })
    }
  c.width = c.height = 0
  cache = modeles
  return modeles
}
