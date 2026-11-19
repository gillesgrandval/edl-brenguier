import { describe, expect, it } from 'vitest'
import { analyserMemo, appliquerAnalyse } from './memo'
import { creerPieces } from '../modeles/pieces'

/** Pièce de test : une pièce créée comme dans l'application. */
function piece(modele: string) {
  return creerPieces({ [modele]: 1 }, modele === 'stockage' ? 'local' : 'appartement')[0]
}

function prop(a: ReturnType<typeof analyserMemo>, libelle: string) {
  return a.propositions.find((p) => p.libelle === libelle)
}

describe('Mémo vocal — exemple donné par l’utilisateur', () => {
  const p = piece('chambre')
  const a = analyserMemo(
    "La pièce est en bon état. Sur le mur est, il y a des trous et des vis qui n'ont pas été enlevées, des traces et une plante qui a été arrachée.",
    p,
  )
  it('rattache les défauts aux murs, côté est', () => {
    const murs = prop(a, 'Murs')!
    expect(murs).toBeDefined()
    expect(murs.localisation).toBe('Mur est')
    expect(murs.observations).toEqual(expect.arrayContaining(['Trous', 'Vis / chevilles restantes', 'Traces', 'Arraché']))
    expect(murs.etat).toBe('mauvais') // déduit : « arraché » est grave
    expect(murs.etatDeduit).toBe(true)
  })
  it('applique « bon état » au reste de la pièce', () => {
    expect(a.etatGeneral).toBe('bon')
    // La climatisation est exclue : son état se saisit unité par unité.
    expect(a.nbEtatGeneral).toBe(p.elements.filter((e) => e.genre !== 'climatisation').length - 1)
  })
})

describe('Mémo vocal — cas courants', () => {
  it('« le mur est abîmé » : verbe être, pas l’orientation est', () => {
    const a = analyserMemo('Le mur est abîmé.', piece('chambre'))
    const murs = prop(a, 'Murs')!
    expect(murs.etat).toBe('mauvais')
    expect(murs.localisation).toBeUndefined()
  })

  it('plusieurs éléments dans une phrase', () => {
    const a = analyserMemo('Le sol et le plafond sont en très bon état, les plinthes sont usées.', piece('sejour'))
    expect(prop(a, 'Sol')?.etat).toBe('tres_bon')
    expect(prop(a, 'Plafond')?.etat).toBe('tres_bon')
    expect(prop(a, 'Plinthes')?.etat).toBe('use')
  })

  it('le contexte se poursuit d’une phrase à l’autre', () => {
    const a = analyserMemo('Le parquet est rayé près de la fenêtre. Il y a aussi des taches.', piece('chambre'))
    const sol = prop(a, 'Sol')!
    expect(sol.observations).toEqual(expect.arrayContaining(['Rayures', 'Taches']))
  })

  it('« côté fenêtre » est un emplacement, pas la fenêtre', () => {
    const a = analyserMemo('Le parquet est rayé côté fenêtre. Trace derrière la porte sur le mur.', piece('chambre'))
    expect(prop(a, 'Sol')?.localisation).toBe('Côté fenêtre')
    expect(prop(a, 'Fenêtre(s)')).toBeUndefined()
    expect(prop(a, 'Porte')).toBeUndefined()
    expect(prop(a, 'Murs')?.observations).toContain('Traces')
  })

  it('compte les trous de chevilles', () => {
    const a = analyserMemo('Mur gauche : trois trous de chevilles.', piece('chambre'))
    const murs = prop(a, 'Murs')!
    expect(murs.trousChevilles).toBe(3)
    expect(murs.localisation).toBe('Mur gauche')
  })

  it('négation : « pas de trace »', () => {
    const a = analyserMemo('Le plafond est propre, pas de trace ni de fissure.', piece('chambre'))
    const plafond = prop(a, 'Plafond')!
    expect(plafond.observations).toEqual([])
    expect(plafond.etat).toBe('bon')
  })

  it('équipements : fonctionnement', () => {
    const a = analyserMemo("Les prises fonctionnent. Le radiateur ne marche pas. L'interrupteur est cassé.", piece('chambre'))
    expect(prop(a, 'Prises électriques')?.fonctionnement).toBe('ok')
    expect(prop(a, 'Radiateur / chauffage')?.fonctionnement).toBe('defaillant')
    expect(prop(a, 'Radiateur / chauffage')?.etat).toBe('hs')
    expect(prop(a, 'Interrupteurs')?.observations).toContain('Cassé')
  })

  it('cuisine : robinet qui fuit et hotte sale', () => {
    const a = analyserMemo('Le robinet fuit, la hotte est sale et grasse, les meubles hauts sont en bon état.', piece('cuisine'))
    expect(prop(a, 'Robinetterie')?.observations).toContain('Fuite')
    expect(prop(a, 'Hotte')?.aNettoyer).toBe(true)
    expect(prop(a, 'Meubles hauts')?.etat).toBe('bon')
    expect(prop(a, 'Meubles bas')).toBeUndefined()
  })

  it('salle de bains : joints et moisissures', () => {
    const a = analyserMemo('Dans la douche les joints sont noircis avec de la moisissure. Le lavabo est en bon état.', piece('sdb'))
    const douche = prop(a, 'Baignoire / douche')!
    expect(douche.observations).toEqual(expect.arrayContaining(['Joint abîmé', 'Moisissures']))
    expect(douche.etat).toBe('mauvais')
    expect(prop(a, 'Lavabo / vasque')?.etat).toBe('bon')
  })

  it('entrepôt : dallage et portes sectionnelles', () => {
    const a = analyserMemo('Le dallage présente des fissures au centre. Les portes sectionnelles fonctionnent mais ont des impacts.', piece('stockage'))
    expect(prop(a, 'Dallage / sol')?.observations).toContain('Fissures')
    expect(prop(a, 'Dallage / sol')?.localisation).toBe('Au centre')
    expect(prop(a, 'Portes sectionnelles')?.fonctionnement).toBe('ok')
    expect(prop(a, 'Portes sectionnelles')?.observations).toContain('Impacts')
  })

  it('phrase non reconnue : conservée dans le commentaire de la pièce', () => {
    const a = analyserMemo('Odeur de tabac persistante.', piece('chambre'))
    expect(a.propositions).toEqual([])
    expect(a.commentairePiece).toEqual(['Odeur de tabac persistante'])
  })

  it('application : ne remplace pas ce qui n’est pas retenu, ajoute le commentaire', () => {
    const p = piece('chambre')
    const a = analyserMemo('La pièce est en bon état. Sur le mur est, des trous de chevilles.', p)
    const murs = prop(a, 'Murs')!
    appliquerAnalyse(p, a, new Set([murs.elementId]), true)
    const el = p.elements.find((e) => e.libelle === 'Murs')!
    expect(el.observations).toContain('Trous')
    expect(el.commentaire).toContain('mur est')
    expect(p.elements.filter((e) => e.genre !== 'climatisation').every((e) => e.etat)).toBe(true)
  })
})
