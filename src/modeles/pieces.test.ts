import { describe, expect, it } from 'vitest'
import { creerPiecesDepuisBien } from './pieces'

describe('Pièces créées depuis une fiche du patrimoine', () => {
  const pieces = creerPiecesDepuisBien([
    {
      modele: 'piece_vie_cuisine',
      nom: 'Pièce de vie avec cuisine',
      equipements: [
        { libelle: 'Hotte aspirante', remplace: 'Hotte' },
        { libelle: 'Climatisation réversible', categorie: 'chauffage', note: 'Emplacement à confirmer' },
      ],
    },
    { modele: 'salle_eau_wc', nom: "Salle d'eau avec douche et WC", equipements: [{ libelle: 'Sèche-serviettes', remplace: 'Sèche-serviettes / radiateur' }] },
    { modele: 'parking', nom: 'Place de parking' },
  ])
  const libelles = (i: number) => pieces[i].elements.map((e) => e.libelle)

  it('reprend les pièces et leurs noms', () => {
    expect(pieces.map((p) => p.nom)).toEqual(['Pièce de vie avec cuisine', "Salle d'eau avec douche et WC", 'Place de parking'])
  })
  it('remplace ou ajoute les équipements connus, sans doublon', () => {
    expect(libelles(0)).toContain('Hotte aspirante')
    expect(libelles(0)).not.toContain('Hotte')
    expect(libelles(0)).toContain('Climatisation réversible')
    expect(libelles(1)).toContain('Sèche-serviettes')
    expect(libelles(1)).toContain('Cuvette / abattant')
  })
  it('aucun état prérempli : tout reste à vérifier sur place', () => {
    expect(pieces.flatMap((p) => p.elements).every((e) => !e.etat && !e.fonctionnement)).toBe(true)
    expect(pieces[0].elements.find((e) => e.libelle === 'Climatisation réversible')?.commentaire).toBe('Emplacement à confirmer')
  })
})
