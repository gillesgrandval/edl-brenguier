import type { Edl } from '../types'

/** Visite commune d'exemple (données fictives), utilisée par les tests. */
export const visite = (): Edl =>
  ({
    id: 'v',
    reference: 'VC-2026-001',
    typeActe: 'sortie',
    typeBien: 'appartement',
    meuble: false,
    statut: 'brouillon',
    dateVisite: '2026-11-20T10:00',
    creeLe: '',
    modifieLe: '',
    edlEntreeId: 'entree-precedente',
    bienId: 'bien-1',
    bien: { adresse: '1029 route des Vieux Salins', codePostal: '83400', ville: 'Hyères', lot: '5', annexes: [] },
    bailleur: { raisonSociale: 'SCI Les Salins', adresse: '1 avenue du Port, Hyères' },
    operateur: { nom: 'Claire Gestion', qualite: 'Gestionnaire' },
    locataires: [{ id: 's1', nom: 'Durand', prenom: 'Paul', telephone: '06 11 22 33 44', email: 'paul.durand@example.fr' }],
    nouvelleAdresseLocataire: '12 rue des Lilas, 13001 Marseille',
    dateRestitutionCles: '2026-11-20T10:30',
    remarquesLocataire: 'Le sortant conteste la tache du salon.',
    observationsGenerales: 'Logement propre.',
    degradations: { e1: { imputable: true, cout: 80 } },
    chauffage: { mode: 'individuel' },
    eauChaude: { mode: 'individuel' },
    pieces: [
      {
        id: 'p1',
        modele: 'sejour',
        nom: 'Séjour',
        photoIds: ['ph-piece'],
        elements: [
          { id: 'e1', libelle: 'Murs', categorie: 'revetement', equipement: false, etat: 'use', observations: ['Tache'], commentaire: 'Tache près de la fenêtre', noteSortie: 'Contestée par le sortant', noteEntree: "Réserve de l'entrant : à repeindre", photoIds: ['ph-1'] },
          { id: 'e2', libelle: 'Sol', categorie: 'revetement', equipement: false, etat: 'bon', observations: [], photoIds: [] },
        ],
      },
    ],
    compteurs: [{ id: 'c1', type: 'electricite', libelle: 'Électricité', index: '12345', photoIds: ['ph-compteur'] }],
    cles: [
      { id: 'k1', libelle: "Porte d'entrée", nombre: 3, nombreRemis: 2, photoIds: [] },
      { id: 'k2', libelle: 'Boîte aux lettres', nombre: 1, photoIds: [] },
    ],
    detecteur: { present: true, fonctionnement: 'ok', photoIds: [] },
    boiteAuxLettres: { presence: 'oui', numero: '12', etat: 'bon', serrure: 'oui', photoIds: [] },
    commune: {
      entrants: [{ id: 'n1', nom: 'Martin', prenom: 'Léa', telephone: '07 98 76 54 32', email: 'lea.martin@example.fr' }],
      remarquesEntrant: "L'entrant demande le remplacement du joint.",
      observationsSortie: 'Ménage de fin de bail à reprendre.',
      observationsEntree: 'Logement remis propre.',
    },
  }) as Edl

export const params = {
  idSortie: 'A',
  idEntree: 'B',
  refSortie: 'EDL-2026-010',
  refEntree: 'EDL-2026-011',
  maintenant: '2026-11-20T11:00:00.000Z',
  photosSortie: new Map([['ph-1', 'A-1'], ['ph-piece', 'A-2'], ['ph-compteur', 'A-3']]),
  photosEntree: new Map([['ph-1', 'B-1'], ['ph-piece', 'B-2'], ['ph-compteur', 'B-3']]),
}

