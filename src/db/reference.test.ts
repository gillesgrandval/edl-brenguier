import { describe, expect, it } from 'vitest'
import { elementDeReference, nbAConfirmer, piecesDepuisReference } from './reference'
import { comparer } from './sortie'
import { preparationVisite, scinderVisite } from './visite'
import { elementFait } from '../modeles/comptes'
import { params, visite } from './__fixtures__/visite'
import type { Edl, EtatReference } from './types'

const ref: EtatReference = {
  source: 'Opéra Groupe',
  date: '2020-03-01',
  mission: '690560',
  pieces: [
    {
      nom: 'Chambre',
      modele: 'chambre',
      elements: [
        { libelle: 'Murs — Peinture', type: 'Murs', nature: 'Peinture', categorie: 'revetement', equipement: false, trous: 2, etat: 'neuf', observations: 'Trous bouchés grossièrement' },
        { libelle: 'Porte — Bois', type: 'Porte', nature: 'Bois', categorie: 'menuiserie', equipement: false, quantite: 1, etat: 'use', observations: 'Eclat(s), Rayure(s)' },
        { libelle: 'Prise classique', type: 'Electricité', nature: 'Prise classique', categorie: 'electricite', equipement: true, quantite: 3, etat: 'bon' },
        { libelle: 'Plafonnier', type: 'Electricité', nature: 'Plafonnier', categorie: 'electricite', equipement: true, quantite: 1, etat: 'absent' },
        { libelle: 'Climatisation réversible', type: 'Chauffage', categorie: 'chauffage', equipement: true, quantite: 1, etat: 'bon' },
      ],
    },
  ],
}

describe('Pré-remplissage depuis un ancien état des lieux (PDF)', () => {
  const pieces = piecesDepuisReference(ref)
  const [murs, porte, prise, plafonnier, clim] = pieces[0].elements

  it('reprend état, quantités, trous et observations, à confirmer', () => {
    expect(murs).toMatchObject({ etat: 'neuf', trousChevilles: 2, commentaire: 'Trous bouchés grossièrement', aConfirmer: true, reference: { etat: 'neuf', trous: 2 } })
    expect(porte).toMatchObject({ etat: 'use', quantite: 1, nature: 'Bois' })
    expect(prise.quantite).toBe(3)
    expect(elementFait(murs)).toBe(false) // à confirmer : pas encore « fait »
    expect(elementFait({ ...murs, aConfirmer: undefined })).toBe(true)
  })
  it('« non vérifié » à l’époque : rien n’est présumé', () => {
    expect(plafonnier.etat).toBeUndefined()
    expect(plafonnier.reference?.etat).toBe('absent')
  })
  it('une climatisation reprise reste un élément simple (pas de saisie par unités)', () => {
    expect(clim.libelle).toBe('Climatisation réversible (relevé)')
    expect(elementFait({ ...clim, aConfirmer: undefined })).toBe(true)
  })
  it('l’élément « tel qu’avant » sert de comparaison', () => {
    expect(elementDeReference({ ...porte, etat: 'mauvais', commentaire: 'Cassée' })).toMatchObject({ etat: 'use', commentaire: 'Eclat(s), Rayure(s)' })
  })
})

describe('Chiffrage de la sortie d’après l’état repris du PDF', () => {
  const sortie = visite()
  sortie.commune = undefined
  sortie.edlEntreeId = undefined
  sortie.dateVisite = '2026-03-01'
  sortie.referenceHistorique = { source: ref.source, date: ref.date }
  sortie.pieces = piecesDepuisReference(ref)
  const [murs, porte, prise] = sortie.pieces[0].elements
  for (const e of sortie.pieces[0].elements) delete e.aConfirmer
  // Constat de sortie : murs dégradés (neuf → mauvais), porte inchangée, prise améliorée.
  murs.etat = 'mauvais'
  prise.etat = 'neuf'
  sortie.degradations = { [murs.id]: { imputable: true, cout: 1000 } }

  const lignes = comparer(sortie, null)
  const ligne = (id: string) => lignes.find((l) => l.element.id === id)!

  it('détecte la dégradation par rapport à l’état du PDF', () => {
    expect(ligne(murs.id).evolution).toBe('degradation')
    expect(ligne(porte.id).evolution).toBe('identique')
    expect(ligne(prise.id).evolution).toBe('mieux')
  })
  it('calcule la vétusté depuis la date du précédent état des lieux (6 ans) et la part du locataire', () => {
    const l = ligne(murs.id)
    expect(l.age).toBeCloseTo(6, 1)
    expect(l.vetuste).toBeGreaterThan(0)
    expect(l.partLocataire).toBe(100 - l.vetuste)
    expect(l.montant).toBe(Math.round(1000 * l.partLocataire) / 100)
  })
})

describe('Visite commune pré-remplie', () => {
  const v = (): Edl => {
    const x = visite()
    x.edlEntreeId = undefined
    x.referenceHistorique = { source: ref.source, date: ref.date }
    x.pieces = piecesDepuisReference(ref)
    return x
  }
  it('terminer la visite exige que chaque élément repris soit confirmé ou corrigé', () => {
    const x = v()
    expect(nbAConfirmer(x)).toBe(5)
    expect(preparationVisite(x).bloquants).toContain("5 éléments repris de l'état des lieux précédent à confirmer ou corriger")
    for (const e of x.pieces[0].elements) delete e.aConfirmer
    expect(preparationVisite(x).bloquants).toEqual([])
  })
  it('la sortie garde l’état précédent (chiffrage) ; l’entrée ne garde que le constat du jour', () => {
    const x = v()
    for (const e of x.pieces[0].elements) delete e.aConfirmer
    const { sortie, entree } = scinderVisite(x, params)
    expect(sortie.referenceHistorique?.date).toBe('2020-03-01')
    expect(sortie.pieces[0].elements[0].reference?.etat).toBe('neuf')
    expect(entree.referenceHistorique).toBeUndefined()
    expect(entree.pieces[0].elements.every((e) => !e.reference && !e.aConfirmer)).toBe(true)
    expect(entree.pieces[0].elements[1].etat).toBe('use')
  })
})
