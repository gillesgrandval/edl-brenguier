/* ------------------------------------------------------------------
   Biens du patrimoine intégrés à l'application.
   Ils sont ajoutés automatiquement à la base de chaque appareil
   (sans écraser une fiche déjà présente ou modifiée sur place).

   ⚠️ Ce fichier est publié avec l'application : son contenu est public.
   ------------------------------------------------------------------ */

import type { Bien } from '../db/types'

export const BIENS_INTEGRES: Bien[] = [
  {
    // Identifiant technique permanent : ne jamais le changer.
    id: '891dd677-c2a4-4577-b00c-21554a1171a8',
    reference: 'Lot n° 5',
    lot: '5',
    categorie: 'appartement',
    typologie: 'T3',
    adresse: '1029 route des Vieux Salins',
    codePostal: '83400',
    ville: 'Hyères',
    etage: 'Rez-de-chaussée',
    surface: '69',
    nbPieces: '3',
    chambres: 2,
    sallesEau: 1,
    wc: 1,
    annexes: ['Parking'],
    equipements: ['Cuisine meublée', "Salle d'eau meublée", 'Climatisation réversible', 'Sèche-serviettes', 'Hotte aspirante'],
    pieces: [
      {
        modele: 'piece_vie_cuisine',
        nom: 'Pièce de vie avec cuisine',
        equipements: [
          { libelle: 'Cuisine meublée', categorie: 'equipement' },
          { libelle: 'Hotte aspirante', categorie: 'equipement', remplace: 'Hotte' },
          { libelle: 'Climatisation réversible', categorie: 'chauffage', note: 'Emplacement à confirmer lors de la visite' },
        ],
      },
      { modele: 'chambre', nom: 'Chambre 1' },
      { modele: 'chambre', nom: 'Chambre 2' },
      {
        modele: 'salle_eau_wc',
        nom: "Salle d'eau avec douche et WC",
        equipements: [
          { libelle: "Salle d'eau meublée", categorie: 'equipement' },
          { libelle: 'Sèche-serviettes', categorie: 'chauffage', remplace: 'Sèche-serviettes / radiateur' },
        ],
      },
      { modele: 'buanderie', nom: 'Cellier' },
      { modele: 'parking', nom: 'Place de parking' },
    ],
    compteurs: ['eau_froide', 'electricite'],
    creeLe: '2026-11-17T15:58:29.000Z',
    modifieLe: '2026-11-17T15:58:29.000Z',
  },
]

/** Visites à préparer automatiquement (un brouillon, créé une seule fois par appareil). */
export const VISITES_INTEGREES: { cle: string; bienId: string; date: string }[] = [
  { cle: 'visite-hyeres-lot5-2026-11-18', bienId: '891dd677-c2a4-4577-b00c-21554a1171a8', date: '2026-11-18' },
]
