import { describe, expect, it } from 'vitest'
import { constatsPiece, elementFait, fixerNombre, genreDe, majSyntheseClim, photosElement, texteNombre } from './comptes'
import { creerPieceLibre, creerPieces, creerPiecesDepuisBien, modelesPour } from './pieces'
import { progressionPiece } from '../db/edl'
import { ecartsFiche, nombresConstates } from '../db/patrimoine'
import { libelleElement } from '../rapport/rapport'
import type { Bien, Edl, Element, GenreElement, Piece } from '../db/types'

const par = (p: Piece, g: GenreElement): Element => p.elements.find((e) => genreDe(e) === g)!
const RUBRIQUES = ['Porte', 'Fenêtre(s)', 'Sol', 'Murs', 'Plafond']

describe('Scénario 1 — ajouter un couloir pendant la visite', () => {
  const [couloir] = creerPieces({ couloir: 1 }, 'appartement')
  it('le modèle « Couloir » existe, avec les autres pièces demandées', () => {
    const cles = modelesPour('appartement').map((m) => m.cle)
    for (const c of ['couloir', 'degagement', 'entree', 'dressing', 'buanderie', 'cellier', 'veranda', 'terrasse', 'garage']) expect(cles).toContain(c)
    expect(couloir.nom).toBe('Couloir')
  })
  it('il reçoit sols, murs, plafond, prises, interrupteurs et points lumineux', () => {
    const l = couloir.elements.map((e) => e.libelle)
    for (const x of ['Sol', 'Murs', 'Plafond']) expect(l).toContain(x)
    for (const g of ['prises', 'interrupteurs', 'points_lumineux'] as GenreElement[]) expect(par(couloir, g)).toBeTruthy()
  })
  it('une pièce personnalisée reçoit toutes les rubriques de base, climatisation comprise', () => {
    const p = creerPieceLibre('Mezzanine')
    const l = p.elements.map((e) => e.libelle)
    for (const x of RUBRIQUES) expect(l).toContain(x)
    for (const g of ['prises', 'interrupteurs', 'points_lumineux', 'climatisation'] as GenreElement[]) expect(par(p, g)).toBeTruthy()
  })
})

describe('Scénario 2 — 6 prises, 3 interrupteurs, 2 points lumineux', () => {
  const [chambre] = creerPieces({ chambre: 1 }, 'appartement')
  it('trois champs distincts, non renseignés au départ', () => {
    const prises = par(chambre, 'prises')
    const inter = par(chambre, 'interrupteurs')
    const points = par(chambre, 'points_lumineux')
    expect(new Set([prises.id, inter.id, points.id]).size).toBe(3)
    expect([prises, inter, points].every((e) => e.quantite === undefined)).toBe(true)
    expect(texteNombre('prises', prises.quantite)).toBe('nombre non renseigné')
  })
  it('saisie des nombres, indépendants les uns des autres', () => {
    fixerNombre(par(chambre, 'prises'), 6)
    fixerNombre(par(chambre, 'interrupteurs'), 3)
    fixerNombre(par(chambre, 'points_lumineux'), 2)
    expect(par(chambre, 'prises').quantite).toBe(6)
    expect(par(chambre, 'interrupteurs').quantite).toBe(3)
    expect(par(chambre, 'points_lumineux').quantite).toBe(2)
    expect(nombresConstates(chambre)).toMatchObject({ prises: 6, interrupteurs: 3, points_lumineux: 2 })
  })
  it('distingue non renseigné, zéro et nombre constaté', () => {
    const el = par(chambre, 'points_lumineux')
    fixerNombre(el, 0)
    expect(el.quantite).toBe(0)
    expect(texteNombre('points_lumineux', 0)).toBe('Aucun point lumineux')
    fixerNombre(el, undefined)
    expect(el.quantite).toBeUndefined()
    fixerNombre(el, 2)
    expect(libelleElement(el)).toBe('Points lumineux — 2 points lumineux')
  })
  it("le nombre n'est jamais obligatoire : l'état suffit pour avancer", () => {
    const el = par(chambre, 'interrupteurs')
    fixerNombre(el, undefined)
    el.etat = 'bon'
    expect(elementFait(el)).toBe(true)
  })
})

describe('Scénario 3 — deux climatisations dans un séjour', () => {
  const [sejour] = creerPieces({ sejour: 1 }, 'appartement')
  const clim = par(sejour, 'climatisation')
  it('rien n\x27est présumé : nombre non renseigné, élément à compléter', () => {
    expect(clim.quantite).toBeUndefined()
    expect(elementFait(clim)).toBe(false)
  })
  it('deux unités, chacune avec sa fiche', () => {
    expect(fixerNombre(clim, 2)).toBe(true)
    expect(clim.unites).toHaveLength(2)
    expect(elementFait(clim)).toBe(false)
    clim.unites![0] = { ...clim.unites![0], reversible: true, marque: 'Daikin', etat: 'bon', fonctionnement: 'ok', photoIds: ['p1'] }
    clim.unites![1] = { ...clim.unites![1], reversible: false, etat: 'use', fonctionnement: 'defaillant', commentaire: 'Bruyante', photoIds: [] }
    majSyntheseClim(clim)
    expect(clim.etat).toBe('use')
    expect(clim.fonctionnement).toBe('defaillant')
    expect(elementFait(clim)).toBe(true)
    expect(photosElement(clim)).toContain('p1')
  })
  it('une unité renseignée ne peut pas être effacée en baissant le nombre', () => {
    expect(fixerNombre(clim, 1)).toBe(false)
    expect(clim.unites).toHaveLength(2)
  })
  it('« aucune climatisation » (0) est une réponse complète', () => {
    const [chambre] = creerPieces({ chambre: 1 }, 'appartement')
    const c = par(chambre, 'climatisation')
    fixerNombre(c, 0)
    expect(elementFait(c)).toBe(true)
    expect(c.unites).toBeUndefined()
  })
  it('la progression de la pièce en tient compte', () => {
    const pr = progressionPiece(sejour)
    expect(pr.faits).toBe(1)
  })
})

describe('Nombres connus de la fiche du bien', () => {
  const [piece] = creerPiecesDepuisBien([
    {
      modele: 'piece_vie_cuisine',
      nom: 'Pièce de vie avec cuisine',
      equipements: [{ libelle: 'Climatisation réversible', categorie: 'chauffage', note: 'Emplacement à confirmer' }],
      quantites: { prises: 8, climatisation: 1 },
    },
  ])
  it('la climatisation connue remplace l\x27élément du modèle, sans doublon', () => {
    expect(piece.elements.filter((e) => genreDe(e) === 'climatisation')).toHaveLength(1)
    expect(par(piece, 'climatisation').libelle).toBe('Climatisation réversible')
  })
  it('les nombres repris sont « à vérifier » et ne comptent pas comme constatés', () => {
    expect(par(piece, 'prises').quantite).toBe(8)
    expect(par(piece, 'prises').quantiteSource).toBe('fiche')
    expect(libelleElement(par(piece, 'prises'))).toContain('(à vérifier)')
    expect(elementFait(par(piece, 'climatisation'))).toBe(false)
    expect(nombresConstates(piece)).toBeUndefined()
  })
})

describe('Pièces ajoutées et fiche du bien', () => {
  it('une pièce ajoutée pendant la visite est proposée, pas reportée automatiquement', () => {
    const [chambre, couloir] = [...creerPieces({ chambre: 1 }, 'appartement'), ...creerPieces({ couloir: 1 }, 'appartement')]
    fixerNombre(par(chambre, 'prises'), 4)
    const bien = { pieces: [{ modele: 'chambre', nom: 'Chambre', quantites: { prises: 3 } }] } as unknown as Bien
    const edl = { pieces: [chambre, couloir] } as unknown as Edl
    const ecarts = ecartsFiche(edl, bien)
    expect(ecarts.map((e) => e.type).sort()).toEqual(['nombre', 'piece'])
    expect(ecarts.find((e) => e.type === 'nombre')!.libelle).toContain('4 prises (fiche : 3 prises)')
    expect(bien.pieces).toHaveLength(1)
  })
  it('avant suppression, une pièce signale ses constatations', () => {
    const [p] = creerPieces({ chambre: 1 }, 'appartement')
    expect(constatsPiece(p)).toEqual({ constats: 0, photos: 0 })
    p.elements[0].etat = 'bon'
    p.photoIds.push('x')
    expect(constatsPiece(p)).toEqual({ constats: 1, photos: 1 })
  })
})
