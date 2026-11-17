import { describe, expect, it } from 'vitest'
import { analyserLignes, compositionDepuisTableau, construireBien, devinerCorrespondance, lireCategorie } from './importExcel'
import type { Bien } from '../db/types'

const ENTETES = ['Identifiant', 'Société', 'Ville', 'Code postal', 'Adresse', 'Résidence', 'Type de bien', 'Lot', 'Surface (m²)', 'Nb chambres', "Salles d'eau", 'WC', 'Annexes', 'Équipements']

describe('Import Excel du patrimoine', () => {
  it('devine les colonnes d’après les en-têtes', () => {
    const c = devinerCorrespondance(ENTETES)
    expect(c).toMatchObject({ identifiantExterne: 0, societe: 1, ville: 2, codePostal: 3, adresse: 4, residence: 5, categorie: 6, lot: 7, surface: 8, chambres: 9, sallesEau: 10, wc: 11, annexes: 12, equipements: 13 })
  })

  it('reconnaît les types de biens', () => {
    expect(lireCategorie('Mobil-home')).toBe('mobil_home')
    expect(lireCategorie('Local commercial')).toBe('local_commercial')
    expect(lireCategorie('Entrepôt')).toBe('entrepot')
    expect(lireCategorie('Villa')).toBe('villa')
    expect(lireCategorie('Péniche')).toBeNull()
  })

  const c = devinerCorrespondance(ENTETES)
  const lignes = [
    ['B-001', 'SCI Test', 'Hyères', 83400, '12 rue des Pins', 'Les Pins', 'Appartement', '3', '45,5', 1, 1, 1, 'Cave, Parking', 'Hotte, Sèche-serviettes, Climatisation'],
    ['B-002', 'SCI Test', 'La Crau', 83260, '', '', 'Villa', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['B-001', 'SCI Test', 'Hyères', 83400, '12 rue des Pins', 'Les Pins', 'Appartement', '3', '45', 1, 1, 1, '', ''],
  ]

  it('vérifie chaque ligne : erreurs, lignes vides, doublons dans le fichier', () => {
    const r = analyserLignes(lignes, c, [])
    expect(r[0].action).toBe('creation')
    expect(r[0].valeurs.surface).toBe('45,5')
    expect(r[1].erreurs).toContain('Adresse manquante')
    expect(r[1].action).toBe('ignoree')
    expect(r[2].action).toBe('ignoree')
    expect(r[3].erreurs[0]).toMatch(/double/)
  })

  it('met à jour un bien existant au lieu de le dupliquer, sans effacer ce qui n’est pas renseigné', () => {
    const existant = { id: 'x', identifiantExterne: 'B-001', categorie: 'appartement', adresse: '12 rue des Pins', codePostal: '83400', ville: 'Hyères', infos: 'Note', annexes: [], equipements: [], pieces: [{ modele: 'sejour', nom: 'Séjour' }], compteurs: ['electricite'], creeLe: '', modifieLe: '' } as Bien
    const [l] = analyserLignes([lignes[3]], c, [existant])
    expect(l.action).toBe('mise_a_jour')
    const b = construireBien(l, () => 'nouveau', 'maintenant')
    expect(b.id).toBe('x')
    expect(b.infos).toBe('Note')
    expect(b.surface).toBe('45')
    expect(b.pieces).toEqual([{ modele: 'sejour', nom: 'Séjour' }])
  })

  it('propose une composition à partir des chiffres, équipements placés', () => {
    const p = compositionDepuisTableau({ categorie: 'appartement', chambres: 2, sallesEau: 1, wc: 1, annexes: ['Parking'], equipements: ['Hotte aspirante', 'Sèche-serviettes', 'Climatisation'], nbPieces: '3' })
    expect(p.map((x) => x.nom)).toEqual(['Pièce de vie', 'Chambre 1', 'Chambre 2', "Salle d'eau", 'WC', 'Parking'])
    expect(p[0].equipements?.map((e) => e.libelle)).toEqual(['Hotte aspirante', 'Climatisation'])
    expect(p[0].equipements?.[1].note).toMatch(/confirmer/)
    expect(p[3].equipements?.[0].libelle).toBe('Sèche-serviettes')
  })
})
