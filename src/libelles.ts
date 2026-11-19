import type { Etat, Statut, TypeActe, TypeBien } from './db/types'

export const LIBELLE_ACTE: Record<TypeActe, string> = {
  entree: 'Entrée',
  sortie: 'Sortie',
  pre: 'Pré-état des lieux',
  a_definir: 'Type à définir',
}

/** Libellé du type d'un état des lieux (visite commune comprise). */
export function libelleActe(edl: { typeActe: TypeActe; commune?: unknown }): string {
  return edl.commune ? 'Sortie + entrée' : LIBELLE_ACTE[edl.typeActe]
}

export const LIBELLE_BIEN: Record<TypeBien, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  local: 'Local / Entrepôt',
}

export const LIBELLE_STATUT: Record<Statut, string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  signe: 'Signé',
}

/** Échelle d'état : libellé, code court (comme sur les EDL du marché) et couleur. */
export const ETATS: { cle: Etat; libelle: string; code: string; couleur: string }[] = [
  { cle: 'neuf', libelle: 'Neuf', code: 'NF', couleur: 'var(--etat-neuf)' },
  { cle: 'tres_bon', libelle: 'Très bon', code: 'TB', couleur: 'var(--etat-tres-bon)' },
  { cle: 'bon', libelle: 'Bon / usage normal', code: 'BE', couleur: 'var(--etat-bon)' },
  { cle: 'use', libelle: 'Usé', code: 'EU', couleur: 'var(--etat-use)' },
  { cle: 'mauvais', libelle: 'Mauvais / dégradé', code: 'ME', couleur: 'var(--etat-mauvais)' },
  { cle: 'hs', libelle: 'Hors service', code: 'HS', couleur: 'var(--etat-hs)' },
  { cle: 'absent', libelle: 'Absent / non vérifié', code: 'NV', couleur: 'var(--etat-absent)' },
]

export const ENERGIES = ['Électricité', 'Gaz', 'Fioul', 'Pompe à chaleur', 'Bois / granulés', 'Réseau urbain', 'Solaire']

export const ANNEXES = ['Cave', 'Parking', 'Box / garage', 'Jardin', 'Terrasse', 'Grenier', 'Local vélos']

/** true si la date de visite est fixée sans heure (« AAAA-MM-JJ »). */
export const sansHeure = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso)

export function formatDate(iso: string, avecHeure = false): string {
  // Date seule : lue comme une date locale (et non à minuit UTC), sans heure.
  if (sansHeure(iso)) {
    const [a, m, j] = iso.split('-').map(Number)
    return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + (avecHeure ? ' (heure à fixer)' : '')
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
