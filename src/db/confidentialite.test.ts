/* Test anti-fuite sur les PDF RÉELLEMENT fabriqués (texte de chaque page et métadonnées). */
import { describe, expect, it, vi } from 'vitest'
import { params, visite } from './__fixtures__/visite'
import { scinderVisite } from './visite'
import { fuitesPdf } from './confidentialite'
import { fabriquerRapport, lireMetadonnees, type ContenuPdf } from '../rapport/rapport'
import type { Edl } from './types'

// Base de données de l'appareil remplacée par une base vide (pas de photos ni d'images de signature).
vi.mock('./base', () => ({
  db: {
    photos: { where: () => ({ equals: () => ({ sortBy: async () => [] }) }) },
    edls: { get: async () => undefined },
    signatures: { get: async () => undefined },
    meta: { get: async () => undefined },
  },
  nouvelId: () => 'id',
  lireMeta: async () => undefined,
  ecrireMeta: async () => {},
}))

/** Simule la signature : signataires (noms imprimés au PDF), clôture et empreinte. */
function signe(e: Edl): Edl {
  return {
    ...e,
    statut: 'signe',
    lieuSignature: 'Hyères',
    signataires: [
      { id: 'bailleur', role: 'bailleur', nom: e.operateur.nom, qualite: 'Gestionnaire' },
      ...e.locataires.map((l) => ({ id: l.id, role: 'locataire' as const, personneId: l.id, nom: `${l.prenom} ${l.nom}`, qualite: 'Locataire', absent: true, motifAbsence: 'test' })),
    ],
    cloture: { signeLe: '2026-11-20T11:30:00.000Z', empreinte: 'a'.repeat(64), versionApp: 'test' },
  }
}

const texte = (c: ContenuPdf) => [...c.textes.map((x) => x.texte), ...c.metadonnees].join('\n')

describe('Test anti-fuite — PDF de la sortie et de l’entrée', async () => {
  const v = visite()
  const { sortie, entree } = scinderVisite(v, params)
  const [pdfSortie, pdfEntree] = [await fabriquerRapport(sortie), await fabriquerRapport(entree)]
  const [pdfSortieSigne, pdfEntreeSigne] = [await fabriquerRapport(signe(sortie)), await fabriquerRapport(signe(entree))]

  it('les PDF sont bien fabriqués, avec leurs propres parties', () => {
    expect(pdfSortie.textes.length).toBeGreaterThan(50)
    expect(texte(pdfSortie)).toContain('Durand')
    expect(texte(pdfSortie)).toContain('12 rue des Lilas')
    expect(texte(pdfEntree)).toContain('Martin')
    expect(texte(pdfSortieSigne)).toContain('Paul Durand')
    expect(texte(pdfEntreeSigne)).toContain('Léa Martin')
    expect(texte(pdfSortie)).toContain('Claire Gestion')
    expect(texte(pdfEntree)).toContain('Claire Gestion')
  })

  it('le PDF de sortie ne contient aucune coordonnée du nouveau locataire (avant et après signature)', () => {
    for (const pdf of [pdfSortie, pdfSortieSigne]) {
      for (const v of ['Martin', 'Léa', 'Lea', '07 98', '0798765432', 'lea.martin', 'joint']) expect(texte(pdf)).not.toContain(v)
      expect(fuitesPdf(pdf, entree)).toEqual([])
    }
  })

  it("le PDF d'entrée ne contient aucune coordonnée du locataire sortant (avant et après signature)", () => {
    for (const pdf of [pdfEntree, pdfEntreeSigne]) {
      for (const v of ['Durand', 'Paul', '06 11', '0611223344', 'paul.durand', 'Lilas', 'Marseille', 'conteste']) expect(texte(pdf)).not.toContain(v)
      expect(fuitesPdf(pdf, sortie)).toEqual([])
    }
  })

  it('les métadonnées du fichier ne nomment aucun locataire', () => {
    for (const pdf of [pdfSortie, pdfEntree, pdfSortieSigne, pdfEntreeSigne]) {
      expect(pdf.metadonnees.length).toBeGreaterThanOrEqual(3)
      expect(pdf.metadonnees.join(' ')).not.toMatch(/Durand|Martin|Paul|Léa/)
    }
    expect(pdfEntree.metadonnees).toContain("EDL-2026-011 - État des lieux d'entrée")
  })

  it('une fuite dans le PDF est détectée, avec sa page', async () => {
    const fautive = structuredClone(entree)
    fautive.observationsGenerales = 'Clés laissées par M. Durand (06 11 22 33 44), parti au 12 rue des Lilas, 13001 Marseille'
    const f = fuitesPdf(await fabriquerRapport(fautive), sortie)
    expect(f.map((x) => x.texte)).toEqual(expect.arrayContaining(['nom de Paul Durand', 'téléphone de Paul Durand', 'nouvelle adresse du locataire sortant']))
    expect(f.find((x) => x.certaine)?.ou).toMatch(/^page \d+/)
  })

  it('une fuite dans les métadonnées est détectée', () => {
    const f = fuitesPdf({ textes: [], metadonnees: ['EDL-2026-011 - Léa Martin'] }, entree)
    expect(f).toEqual(expect.arrayContaining([{ texte: 'nom de Léa Martin', certaine: false, ou: 'métadonnées du fichier' }]))
    expect(lireMetadonnees('<< /Title (EDL \\(test\\)) /Author (Groupe Brenguier) >>')).toEqual(['EDL (test)', 'Groupe Brenguier'])
  })
})
