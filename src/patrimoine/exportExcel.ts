/* ------------------------------------------------------------------
   Exports Excel : liste des états des lieux, et patrimoine.
   L'export du patrimoine reprend exactement les colonnes de l'import :
   on peut le modifier dans Excel puis le réimporter (sans doublon,
   grâce à la colonne « Identifiant unique »).
   ------------------------------------------------------------------ */

import { db } from '../db/base'
import { LIBELLE_CATEGORIE } from '../db/patrimoine'
import type { Bien, TypeCompteur } from '../db/types'
import { LIBELLE_ACTE, LIBELLE_BIEN, LIBELLE_STATUT, formatDate } from '../libelles'
import { CHAMPS, type CleChamp } from './importExcel'

type Cellule = { value: string | number; fontWeight?: 'bold' } | null
const titre = (v: string): Cellule => ({ value: v, fontWeight: 'bold' })
const cel = (v: unknown): Cellule => (v === undefined || v === null || v === '' ? null : { value: typeof v === 'number' ? v : String(v) })

async function ecrire(lignes: Cellule[][], largeurs: number[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  return writeXlsxFile(lignes as never, { columns: largeurs.map((width) => ({ width })), stickyRowsCount: 1 } as never).toBlob()
}

export async function exporterEtatsDesLieux(): Promise<Blob> {
  // Les brouillons de la corbeille ne sont pas exportés.
  const annulations = new Map((await db.annulations.toArray()).map((a) => [a.edlId, a]))
  const edls = (await db.edls.toArray()).filter((e) => !e.corbeille).sort((a, b) => b.dateVisite.localeCompare(a.dateVisite))
  const photos = new Map<string, number>()
  await db.photos.each((p) => photos.set(p.edlId, (photos.get(p.edlId) ?? 0) + 1))
  const entetes = ['Référence', 'Type', 'Statut', 'Date de visite', 'Adresse', 'Code postal', 'Ville', 'Lot', 'Bien', 'Bailleur', 'Locataires', 'Pièces', 'Photos', 'Signé le', 'Empreinte SHA-256']
  const lignes: Cellule[][] = [
    entetes.map(titre),
    ...edls.map((e) => [
      cel(e.reference),
      cel(LIBELLE_ACTE[e.typeActe]),
      cel(annulations.has(e.id) ? `${LIBELLE_STATUT[e.statut]} — annulé (${annulations.get(e.id)!.motif})` : LIBELLE_STATUT[e.statut]),
      cel(formatDate(e.dateVisite, e.dateVisite.length > 10)),
      cel(e.bien.adresse),
      cel(e.bien.codePostal),
      cel(e.bien.ville),
      cel(e.bien.lot),
      cel(LIBELLE_BIEN[e.typeBien]),
      cel(e.bailleur.raisonSociale),
      cel(e.locataires.map((l) => [l.prenom, l.nom].filter(Boolean).join(' ')).filter(Boolean).join(', ')),
      cel(e.pieces.length),
      cel(photos.get(e.id) ?? 0),
      cel(e.cloture ? formatDate(e.cloture.signeLe, true) : ''),
      cel(e.cloture?.empreinte),
    ]),
  ]
  return ecrire(lignes, [16, 16, 11, 18, 34, 11, 18, 8, 16, 26, 30, 8, 8, 18, 68])
}

const COMPTEURS: Record<TypeCompteur, string> = { electricite: 'électricité', eau_froide: 'eau', eau_chaude: 'eau chaude', gaz: 'gaz', autre: 'autre' }

function valeur(b: Bien, cle: CleChamp): unknown {
  switch (cle) {
    // Sans identifiant externe, on exporte l'identifiant technique : la réimportation retrouve le bien.
    case 'identifiantExterne':
      return b.identifiantExterne || b.id
    case 'categorie':
      return LIBELLE_CATEGORIE[b.categorie]
    case 'annexes':
      return b.annexes.join(', ')
    case 'equipements':
      return b.equipements.join(', ')
    case 'compteurs':
      return b.compteurs.map((c) => COMPTEURS[c]).join(', ')
    case 'meuble':
      return b.meuble === undefined ? '' : b.meuble ? 'oui' : 'non'
    default:
      return b[cle]
  }
}

export async function exporterPatrimoine(): Promise<Blob> {
  const biens = (await db.biens.toArray()).sort((a, b) => a.ville.localeCompare(b.ville, 'fr') || (a.lot ?? '').localeCompare(b.lot ?? '', 'fr', { numeric: true }))
  const lignes: Cellule[][] = [CHAMPS.map((c) => titre(c.libelle)), ...biens.map((b) => CHAMPS.map((c) => cel(valeur(b, c.cle))))]
  return ecrire(lignes, CHAMPS.map((c) => (c.cle === 'adresse' || c.cle === 'equipements' || c.cle === 'infos' ? 34 : 18)))
}
