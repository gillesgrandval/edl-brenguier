import { describe, expect, it } from 'vitest'
import { garderChiffres, sansBords } from './nettoyage'
import type { ImageBinaire } from './septSegments'

function image(W: number, H: number, rects: [number, number, number, number][]): ImageBinaire {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  for (const [x, y, l, h] of rects)
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + l; i++) {
        const k = (j * W + i) * 4
        data[k] = data[k + 1] = data[k + 2] = 0
      }
  return { width: W, height: H, data }
}

describe('Nettoyage des chiffres', () => {
  it('sépare des chiffres reliés par les tirets des rouleaux et ôte les poussières', () => {
    // Trois « chiffres » (barres pleines) reliés par des tirets fins, plus une poussière.
    const img = image(200, 100, [
      [20, 20, 20, 60], [40, 48, 30, 4], [70, 20, 20, 60], [90, 48, 30, 4], [120, 20, 20, 60], [170, 10, 4, 4],
    ])
    const r = garderChiffres(img)
    expect(r.pieces.length).toBe(3)
  })
  it('retire le bord d’un écran mais garde les segments', () => {
    const img = image(200, 100, [[0, 0, 200, 6], [50, 30, 8, 30], [80, 30, 30, 6]])
    const r = sansBords(img)
    const noirs = (x: number, y: number) => r.data[(y * 200 + x) * 4] < 128
    expect(noirs(100, 2)).toBe(false)
    expect(noirs(52, 40)).toBe(true)
    expect(noirs(90, 32)).toBe(true)
  })
})
