/* ------------------------------------------------------------------
   Décodeur d'afficheur 7 segments (écran Linky, compteurs numériques).
   Travaille sur une image déjà en noir (chiffres) et blanc (fond).

        aaa
       f   b
        ggg
       e   c
        ddd
   ------------------------------------------------------------------ */

export interface ImageBinaire {
  width: number
  height: number
  /** RGBA, comme ImageData.data. Un pixel noir (< 128) est de l'encre. */
  data: Uint8ClampedArray | number[]
}

const MOTIFS: Record<string, string> = {
  abcdef: '0',
  bc: '1',
  abdeg: '2',
  abcdg: '3',
  bcfg: '4',
  acdfg: '5',
  acdefg: '6',
  abc: '7',
  abcf: '7', // certains afficheurs dessinent le « 7 » avec le segment f
  abcdefg: '8',
  abcdfg: '9',
  abcfg: '9', // « 9 » sans segment d
}

export function decoderSeptSegments(img: ImageBinaire): string | null {
  const { width: W, height: H, data } = img
  const encre = (x: number, y: number) => data[(y * W + x) * 4] < 128

  // 1. Bande horizontale principale contenant les chiffres.
  const lignes = Array.from({ length: H }, (_, y) => {
    let n = 0
    for (let x = 0; x < W; x++) if (encre(x, y)) n++
    return n
  })
  const seuilLigne = Math.max(2, W * 0.01)
  let meilleure = { debut: 0, fin: -1 }
  for (let y = 0, debut = -1; y <= H; y++) {
    const pleine = y < H && lignes[y] >= seuilLigne
    if (pleine && debut < 0) debut = y
    if (!pleine && debut >= 0) {
      if (y - debut > meilleure.fin - meilleure.debut) meilleure = { debut, fin: y - 1 }
      debut = -1
    }
  }
  const y0 = meilleure.debut
  const y1 = meilleure.fin
  const hBande = y1 - y0 + 1
  if (hBande < 12) return null

  // 2. Découpage en chiffres par projection verticale.
  const colonnes = Array.from({ length: W }, (_, x) => {
    let n = 0
    for (let y = y0; y <= y1; y++) if (encre(x, y)) n++
    return n
  })
  const blocs: { x0: number; x1: number }[] = []
  for (let x = 0, debut = -1; x <= W; x++) {
    const pleine = x < W && colonnes[x] > 0
    if (pleine && debut < 0) debut = x
    if (!pleine && debut >= 0) {
      blocs.push({ x0: debut, x1: x - 1 })
      debut = -1
    }
  }

  // Hauteur réelle de chaque bloc ; on écarte les petits éléments (unité « kWh », virgule, poussières).
  const mesures = blocs.map((b) => {
    let haut = y1, bas = y0
    for (let x = b.x0; x <= b.x1; x++)
      for (let y = y0; y <= y1; y++)
        if (encre(x, y)) {
          if (y < haut) haut = y
          if (y > bas) bas = y
        }
    return { ...b, y0: haut, y1: bas, h: bas - haut + 1, l: b.x1 - b.x0 + 1 }
  })
  const hMax = Math.max(...mesures.map((m) => m.h))
  const chiffres = mesures.filter((m) => m.h >= hMax * 0.7)
  if (chiffres.length < 2) return null
  const lMax = Math.max(...chiffres.map((m) => m.l))

  // 3. Lecture des segments de chaque chiffre.
  let resultat = ''
  for (const c of chiffres) {
    // Un « 1 » est étroit : on le reconnaît à sa forme.
    if (c.l < lMax * 0.45) {
      resultat += '1'
      continue
    }
    const proportion = (xa: number, ya: number, xb: number, yb: number) => {
      // Fraction d'encre le long d'un segment de droite (en coordonnées relatives au chiffre).
      const pas = 24
      let n = 0
      for (let i = 0; i <= pas; i++) {
        const x = Math.round(c.x0 + (xa + ((xb - xa) * i) / pas) * (c.l - 1))
        const y = Math.round(c.y0 + (ya + ((yb - ya) * i) / pas) * (c.h - 1))
        if (encre(x, y)) n++
      }
      return n / (pas + 1)
    }
    // Segments horizontaux : on traverse verticalement la zone attendue au centre.
    const horiz = (ya: number, yb: number) => proportion(0.5, ya, 0.5, yb) > 0.12
    // Segments verticaux : on traverse horizontalement sur le bord gauche ou droit.
    const vert = (xa: number, xb: number, y: number) => proportion(xa, y, xb, y) > 0.12
    const seg = {
      a: horiz(0, 0.18),
      g: horiz(0.4, 0.6),
      d: horiz(0.82, 1),
      f: vert(0, 0.3, 0.27),
      b: vert(0.7, 1, 0.27),
      e: vert(0, 0.3, 0.73),
      c: vert(0.7, 1, 0.73),
    }
    const motif = Object.entries(seg)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .sort()
      .join('')
    const chiffre = MOTIFS[motif]
    if (!chiffre) return null // un chiffre illisible : on préfère ne rien proposer
    resultat += chiffre
  }
  return resultat.length >= 3 ? resultat : null
}
