import { describe, expect, it } from 'vitest'
import { CODE_VALIDE, descriptionEdl } from './admin'
import { balFaite, cleBal, etatRubriques, normaliser } from './edl'
import type { Edl } from './types'

const base = (statut: Edl['statut']): Edl =>
  ({
    id: 'x',
    reference: 'EDL-2026-009',
    typeActe: 'entree',
    typeBien: 'appartement',
    meuble: false,
    statut,
    dateVisite: '2026-11-20',
    creeLe: '',
    modifieLe: '',
    bien: { adresse: '1029 route des Vieux Salins', codePostal: '83400', ville: 'Hyères', lot: '5', annexes: [] },
    bailleur: { raisonSociale: '', adresse: '' },
    operateur: { nom: '' },
    locataires: [],
    chauffage: { mode: 'individuel' },
    eauChaude: { mode: 'individuel' },
    pieces: [],
    compteurs: [],
    cles: [{ id: 'c', libelle: 'Boîte aux lettres', nombre: 2, photoIds: [] }],
    detecteur: { photoIds: [] },
  }) as Edl

describe('Scénario 4 — boîte aux lettres', () => {
  it('ajoutée aux brouillons, jamais aux états des lieux signés (empreinte intacte)', () => {
    expect(normaliser(base('brouillon')).boiteAuxLettres).toEqual({ photoIds: [] })
    expect(normaliser(base('signe')).boiteAuxLettres).toBeUndefined()
    expect(etatRubriques(normaliser(base('signe'))).boiteAuxLettres).toBeNull()
  })
  it('non renseignée / absente / présente avec état et serrure', () => {
    expect(balFaite({ photoIds: [] })).toBe(false)
    expect(balFaite({ presence: 'non', photoIds: [] })).toBe(true)
    expect(balFaite({ presence: 'oui', etat: 'bon', photoIds: [] })).toBe(false)
    expect(balFaite({ presence: 'oui', etat: 'bon', serrure: 'non_verifie', photoIds: [] })).toBe(true)
  })
  it('le nombre de clés est celui de la ligne « Boîte aux lettres » des clés (pas de double compte)', () => {
    expect(cleBal(base('brouillon'))?.nombre).toBe(2)
    expect(cleBal({ cles: [{ id: 'a', libelle: 'Boite aux lettres n° 12', nombre: 1, photoIds: [] }] })?.nombre).toBe(1)
  })
})

describe('Suppression contrôlée', () => {
  it('le code administrateur compte 4 à 8 chiffres', () => {
    expect(CODE_VALIDE.test('1234')).toBe(true)
    expect(CODE_VALIDE.test('123')).toBe(false)
    expect(CODE_VALIDE.test('12a4')).toBe(false)
    expect(CODE_VALIDE.test('123456789')).toBe(false)
  })
  it('la confirmation et le journal décrivent bien, date, type et statut', () => {
    const d = descriptionEdl(base('brouillon'))
    expect(d).toContain('EDL-2026-009')
    expect(d).toContain('Lot 5')
    expect(d).toContain('Hyères')
    expect(d).toContain('20/11/2026')
    expect(d).toMatch(/Entrée/)
    expect(d).toMatch(/Brouillon/i)
  })
})
