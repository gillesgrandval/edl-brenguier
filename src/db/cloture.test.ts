import { describe, expect, it } from 'vitest'
import { jsonStable, sha256 } from './cloture'

describe('Empreinte', () => {
  it('le JSON stable ne dépend pas de l’ordre des clés', () => {
    expect(jsonStable({ b: 1, a: [2, { d: 3, c: undefined }] })).toBe(jsonStable({ a: [2, { d: 3 }], b: 1 }))
  })
  it('SHA-256 de référence', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('un seul caractère change toute l’empreinte', async () => {
    expect(await sha256(jsonStable({ index: '00663' }))).not.toBe(await sha256(jsonStable({ index: '00664' })))
  })
})
