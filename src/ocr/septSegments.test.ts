import { describe, expect, it } from 'vitest'
import { decoderSeptSegments, type ImageBinaire } from './septSegments'

const SEG: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd' }

/** Dessine un nombre en 7 segments (noir sur blanc), avec un léger flou de contour optionnel. */
function dessiner(nombre: string, opts: { e?: number; ecart?: number; unite?: boolean; inclinaison?: number } = {}): ImageBinaire {
  const w = 60, h = 110, e = opts.e ?? 12, ecart = opts.ecart ?? 30, marge = 20
  const W = marge * 2 + nombre.length * (w + ecart) + (opts.unite ? 80 : 0)
  const H = h + marge * 2
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const rect = (x: number, y: number, l: number, hh: number) => {
    for (let j = 0; j < hh; j++)
      for (let i = 0; i < l; i++) {
        const decal = Math.round(((h - (y - marge + j)) * (opts.inclinaison ?? 0)))
        const px = x + i + decal, py = y + j
        if (px >= 0 && px < W && py < H) {
          const k = (py * W + px) * 4
          data[k] = data[k + 1] = data[k + 2] = 0
        }
      }
  }
  nombre.split('').forEach((d, n) => {
    const x = marge + n * (w + ecart), y = marge
    const s: Record<string, [number, number, number, number]> = {
      a: [x + e, y, w - 2 * e, e], g: [x + e, y + h / 2 - e / 2, w - 2 * e, e], d: [x + e, y + h - e, w - 2 * e, e],
      f: [x, y + e, e, h / 2 - e], b: [x + w - e, y + e, e, h / 2 - e], e: [x, y + h / 2, e, h / 2 - e], c: [x + w - e, y + h / 2, e, h / 2 - e],
    }
    for (const k of SEG[d]) rect(...s[k])
  })
  if (opts.unite) rect(W - marge - 60, marge + h - 30, 50, 25) // « kWh » : petit bloc
  return { width: W, height: H, data }
}

describe('Décodeur 7 segments', () => {
  it('lit tous les chiffres', () => {
    expect(decoderSeptSegments(dessiner('0123456789'))).toBe('0123456789')
  })
  it('index Linky avec unité kWh', () => {
    expect(decoderSeptSegments(dessiner('045210', { unite: true }))).toBe('045210')
  })
  it('segments fins', () => {
    expect(decoderSeptSegments(dessiner('98712', { e: 8 }))).toBe('98712')
  })
  it('chiffres légèrement penchés (italique de l’afficheur)', () => {
    expect(decoderSeptSegments(dessiner('34567', { inclinaison: 0.08 }))).toBe('34567')
  })
  it('image vide : rien', () => {
    expect(decoderSeptSegments({ width: 50, height: 50, data: new Uint8ClampedArray(50 * 50 * 4).fill(255) })).toBeNull()
  })
})
