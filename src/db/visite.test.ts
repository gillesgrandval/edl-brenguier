import { describe, expect, it } from 'vitest'
import { rechercherDonnees, scinderVisite, simulerScission, preparationVisite } from './visite'
import type { Edl } from './types'
import { params, visite } from './__fixtures__/visite'

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
