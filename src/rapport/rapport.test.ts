import { describe, expect, it } from 'vitest'
import { nomFichier, t } from './rapport'
import type { Edl } from '../db/types'

describe('Rapport PDF', () => {
  it('remplace les signes que les polices du PDF ne savent pas afficher', () => {
    expect(t('L\u2019\u0153il\u2026 \u2013 12\u202f\u20ac \u2192 ok')).toBe("L'oeil... - 12 \u20ac  ok")
    expect(t('Éclairage à côté, 25 m²')).toBe('Éclairage à côté, 25 m²')
  })
  it('nom de fichier lisible et sans accents', () => {
    const edl = { reference: 'EDL-2026-012', typeActe: 'entree', statut: 'signe', bien: { adresse: '12, rue des Écoles' } } as Edl
    expect(nomFichier(edl)).toBe('EDL-2026-012_Entree_12-rue-des-Ecoles.pdf')
    expect(nomFichier({ ...edl, statut: 'en_cours' })).toBe('EDL-2026-012_Entree_12-rue-des-Ecoles_PROJET.pdf')
  })
})
