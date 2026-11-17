import { describe, expect, it } from 'vitest'
import { comparer, consommation, evolution } from './sortie'
import { GRILLE_VETUSTE, categorieVetuste, tauxVetuste } from '../modeles/vetuste'
import type { Edl, Element } from './types'

const el = (id: string, libelle: string, etat?: Element['etat'], extra: Partial<Element> = {}): Element => ({ id, libelle, categorie: 'revetement', equipement: false, etat, observations: [], photoIds: [], ...extra })

describe('Vétusté', () => {
  it('franchise, abattement annuel et valeur résiduelle', () => {
    const g = GRILLE_VETUSTE.peinture // franchise 2 ans, 12 %/an, résiduel 10 %
    expect(tauxVetuste(g, 1)).toBe(0)
    expect(tauxVetuste(g, 5)).toBe(36)
    expect(tauxVetuste(g, 20)).toBe(90)
  })
  it('reconnaît la catégorie des éléments', () => {
    expect(categorieVetuste(el('a', 'Murs'))).toBe('peinture')
    expect(categorieVetuste(el('a', 'Sol', undefined, { nature: 'Moquette' }))).toBe('moquette')
    expect(categorieVetuste(el('a', 'Robinetterie', undefined, { categorie: 'plomberie' }))).toBe('robinetterie')
    expect(categorieVetuste(el('a', 'Hotte aspirante', undefined, { categorie: 'equipement' }))).toBe('electromenager')
  })
})

describe('Comparaison entrée / sortie', () => {
  it('évolution de l’état', () => {
    expect(evolution(el('a', 'Murs', 'bon'), el('a', 'Murs', 'mauvais'))).toBe('degradation')
    expect(evolution(el('a', 'Murs', 'bon'), el('a', 'Murs', 'bon'))).toBe('identique')
    expect(evolution(el('a', 'Murs', 'absent'), el('a', 'Murs', 'bon'))).toBe('non_comparable')
    expect(evolution(undefined, el('a', 'Murs', 'bon'))).toBe('nouveau')
  })
  it('part du locataire après vétusté et montant', () => {
    const entree = { dateVisite: '2021-01-01', pieces: [{ id: 'p', nom: 'Séjour', elements: [el('m', 'Murs', 'bon'), el('s', 'Sol', 'bon')] }] } as unknown as Edl
    const sortie = {
      dateVisite: '2026-01-01',
      pieces: [{ id: 'p', nom: 'Séjour', elements: [el('m', 'Murs', 'mauvais'), el('s', 'Sol', 'bon')] }],
      degradations: { m: { imputable: true, cout: 1000 } },
    } as unknown as Edl
    const [murs, sol] = comparer(sortie, entree)
    expect(murs.evolution).toBe('degradation')
    expect(murs.vetuste).toBe(36) // 5 ans de peinture
    expect(murs.partLocataire).toBe(64)
    expect(murs.montant).toBe(640)
    expect(sol.partLocataire).toBe(0)
  })
  it('consommation des compteurs', () => {
    expect(consommation('1200', '1534,5')).toBe(334.5)
    expect(consommation('', '10')).toBeUndefined()
  })
})
