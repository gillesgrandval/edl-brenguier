import { describe, expect, it } from 'vitest'
import { chiffrer, dechiffrer, phraseSuffisante } from './chiffrement'

const fiches = { format: 'edl-brenguier-patrimoine', version: 1, biens: [{ id: 'a', adresse: '1 rue de test', ville: 'Hyères', infos: 'Digicode : 1234A' }] }
const phrase = 'cerise parasol granit voilier lanterne'

describe('Patrimoine chiffré', () => {
  it('se déchiffre avec la bonne phrase (espaces et casse des accents tolérés)', async () => {
    const p = await chiffrer(fiches, phrase, '2026-11-24', 1, 1000)
    expect(await dechiffrer(p, phrase)).toEqual(fiches)
    expect(await dechiffrer(p, `  ${phrase.replace(/ /g, '   ')} `)).toEqual(fiches)
  })
  it('reste illisible sans la phrase : rien en clair, phrase incorrecte refusée', async () => {
    const p = await chiffrer(fiches, phrase, '2026-11-24', 1, 1000)
    const public_ = JSON.stringify(p)
    for (const v of ['Hyères', 'Digicode', '1234A', 'rue de test', phrase]) expect(public_).not.toContain(v)
    await expect(dechiffrer(p, 'cerise parasol granit voilier lanternes')).rejects.toThrow('Phrase secrète incorrecte.')
  })
  it('deux chiffrements donnent deux blocs différents (sel et vecteur aléatoires)', async () => {
    const [a, b] = [await chiffrer(fiches, phrase, 'v', 1, 1000), await chiffrer(fiches, phrase, 'v', 1, 1000)]
    expect(a.donnees).not.toBe(b.donnees)
    expect(a.sel).not.toBe(b.sel)
  })
  it('exige une phrase longue', () => {
    expect(phraseSuffisante('motdepasse')).not.toBeNull()
    expect(phraseSuffisante('un deux trois quatre')).not.toBeNull()
    expect(phraseSuffisante(phrase)).toBeNull()
  })
})
