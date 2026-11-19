import { describe, expect, it } from 'vitest'
import { rechercherDonnees, scinderVisite, simulerScission, preparationVisite } from './visite'
import type { Edl } from './types'

const visite = (): Edl =>
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

const params = {
  idSortie: 'A',
  idEntree: 'B',
  refSortie: 'EDL-2026-010',
  refEntree: 'EDL-2026-011',
  maintenant: '2026-11-20T11:00:00.000Z',
  photosSortie: new Map([['ph-1', 'A-1'], ['ph-piece', 'A-2'], ['ph-compteur', 'A-3']]),
  photosEntree: new Map([['ph-1', 'B-1'], ['ph-piece', 'B-2'], ['ph-compteur', 'B-3']]),
}

describe('Visite commune — deux documents distincts', () => {
  const { sortie, entree } = scinderVisite(visite(), params)

  it('A = sortie avec le sortant, B = entrée avec l’entrant ; le représentant figure dans les deux', () => {
    expect(sortie.typeActe).toBe('sortie')
    expect(entree.typeActe).toBe('entree')
    expect(sortie.locataires.map((l) => l.nom)).toEqual(['Durand'])
    expect(entree.locataires.map((l) => l.nom)).toEqual(['Martin'])
    expect(sortie.operateur.nom).toBe('Claire Gestion')
    expect(entree.operateur.nom).toBe('Claire Gestion')
    expect(sortie.commune).toBeUndefined()
    expect(entree.commune).toBeUndefined()
    expect(sortie.statut).toBe('brouillon')
    expect(entree.statut).toBe('brouillon')
  })

  it('les constatations communes sont copiées dans les deux, les observations propres dans un seul', () => {
    const [ms, me] = [sortie.pieces[0].elements[0], entree.pieces[0].elements[0]]
    expect(ms.etat).toBe('use')
    expect(me.etat).toBe('use')
    expect(ms.commentaire).toContain('Contestée par le sortant')
    expect(ms.commentaire).not.toContain('Réserve')
    expect(me.commentaire).toContain("Réserve de l'entrant")
    expect(me.commentaire).not.toContain('Contestée')
    expect(ms.noteSortie ?? ms.noteEntree ?? me.noteSortie ?? me.noteEntree).toBeUndefined()
    expect(sortie.observationsGenerales).toContain('Ménage de fin de bail')
    expect(entree.observationsGenerales).not.toContain('Ménage de fin de bail')
    expect(entree.observationsGenerales).toContain('Logement remis propre')
    expect(sortie.remarquesLocataire).toContain('sortant conteste')
    expect(entree.remarquesLocataire).toContain('remplacement du joint')
  })

  it('clés : restituées dans la sortie, remises dans l’entrée ; compteurs relevés une fois', () => {
    expect(sortie.cles!.map((c) => c.nombre)).toEqual([3, 1])
    expect(entree.cles!.map((c) => c.nombre)).toEqual([2, 1])
    expect(sortie.cles![0].nombreRemis).toBeUndefined()
    expect(sortie.compteurs![0].index).toBe('12345')
    expect(entree.compteurs![0].index).toBe('12345')
  })

  it('chaque document a sa propre copie des photos', () => {
    expect(sortie.pieces[0].elements[0].photoIds).toEqual(['A-1'])
    expect(entree.pieces[0].elements[0].photoIds).toEqual(['B-1'])
    expect(sortie.pieces[0].photoIds).toEqual(['A-2'])
    expect(entree.compteurs![0].photoIds).toEqual(['B-3'])
  })

  it('seule la sortie garde le comparatif, les dégradations et la date de restitution', () => {
    expect(sortie.edlEntreeId).toBe('entree-precedente')
    expect(sortie.degradations?.e1).toBeDefined()
    expect(entree.edlEntreeId).toBeUndefined()
    expect(entree.degradations).toBeUndefined()
    expect(entree.dateRestitutionCles).toBeUndefined()
    expect(entree.nouvelleAdresseLocataire).toBeUndefined()
    expect(sortie.issuDeVisite).toEqual({ reference: 'VC-2026-001', autreId: 'B', autreReference: 'EDL-2026-011' })
  })
})

describe('Visite commune — test anti-fuite', () => {
  const v = visite()
  const { sortie, entree } = scinderVisite(v, params)
  const json = (e: Edl) => JSON.stringify(e)

  it("l'entrée ne contient AUCUNE donnée du locataire sortant", () => {
    for (const valeur of ['Durand', 'Paul', '06 11 22 33 44', '0611223344', 'paul.durand@example.fr', '12 rue des Lilas', 'Marseille', 'conteste']) expect(json(entree)).not.toContain(valeur)
  })
  it("la sortie ne contient AUCUNE donnée du locataire entrant", () => {
    for (const valeur of ['Martin', 'Léa', '07 98 76 54 32', 'lea.martin@example.fr', 'joint']) expect(json(sortie)).not.toContain(valeur)
  })
  it('le contrôle intégré ne signale rien sur une visite propre', () => {
    const r = simulerScission(v)
    expect(r.dansSortie).toEqual([])
    expect(r.dansEntree).toEqual([])
  })
  it('le contrôle intégré détecte un nom ou un téléphone saisi dans un texte commun', () => {
    const fautive = visite()
    fautive.pieces[0].elements[1].commentaire = 'Vu avec M. Durand, joignable au 06.11.22.33.44'
    fautive.observationsGenerales = 'Clés remises à Léa Martin'
    const r = simulerScission(fautive)
    expect(r.dansEntree).toEqual(expect.arrayContaining([{ texte: 'nom de Paul Durand', certaine: false, ou: 'Séjour › Sol' }, { texte: 'téléphone de Paul Durand', certaine: true, ou: 'Séjour › Sol' }]))
    expect(r.dansSortie).toEqual(expect.arrayContaining([{ texte: 'nom de Léa Martin', certaine: false, ou: 'Observations générales' }, { texte: 'prénom de Léa Martin', certaine: false, ou: 'Observations générales' }]))
  })
  it('pas de faux positif sur les codes (état « bon », etc.) ni sur un mot contenant le nom', () => {
    expect(rechercherDonnees(entree, [{ id: 'x', nom: 'Bon' }])).toEqual([])
    // « Sol » (libellé) et « Port » (adresse du bailleur) sont des textes saisis : signalés, mais à confirmer seulement.
    expect(rechercherDonnees(entree, [{ id: 'x', nom: 'Sol' }])).toEqual([{ texte: 'nom de Sol', certaine: false, ou: 'Séjour › Sol' }])
    expect(rechercherDonnees(entree, [{ id: 'x', nom: 'Port' }])).toEqual([{ texte: 'nom de Port', certaine: false, ou: 'Bailleur' }])
    expect(rechercherDonnees(entree, [{ id: 'x', nom: 'Salin' }])).toEqual([])
  })
  it('les parties sont exigées avant de terminer', () => {
    const vide = visite()
    vide.commune!.entrants = [{ id: 'n', nom: '' }]
    expect(preparationVisite(vide).bloquants).toEqual(['Locataire entrant (nom)'])
    expect(preparationVisite(visite()).bloquants).toEqual([])
  })
})
