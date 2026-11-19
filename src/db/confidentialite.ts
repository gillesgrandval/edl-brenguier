/* ------------------------------------------------------------------
   Contrôle anti-fuite des PDF de deux états des lieux liés (visite commune).

   On fabrique réellement chaque PDF et on relève tout ce qui y est écrit
   (chaque texte de chaque page, tableaux compris) ainsi que ses métadonnées
   (titre, auteur, créateur…). On y recherche ensuite les données personnelles
   des locataires de l'AUTRE document : nom, prénom, téléphone, e-mail et,
   pour le sortant, sa nouvelle adresse.
   ------------------------------------------------------------------ */

import { db } from './base'
import { rechercherDansTextes, type Fuite } from './visite'
import type { Edl } from './types'
import type { ContenuPdf } from '../rapport/rapport'

/** Données à ne jamais trouver dans le document de l'autre locataire. */
function donneesInterdites(autre: Edl): { personnes: Edl['locataires']; autres: [string, string][] } {
  return {
    personnes: autre.locataires,
    autres: autre.typeActe === 'sortie' && autre.nouvelleAdresseLocataire?.trim() ? [['nouvelle adresse du locataire sortant', autre.nouvelleAdresseLocataire]] : [],
  }
}

/** Textes relevés dans un PDF, prêts pour la recherche (ligne par ligne, page entière, métadonnées). */
export function corpusPdf(c: Pick<ContenuPdf, 'textes' | 'metadonnees'>): { texte: string; ou: string }[] {
  const pages = new Map<number, string[]>()
  for (const x of c.textes) pages.set(x.page, [...(pages.get(x.page) ?? []), x.texte])
  return [
    ...c.textes.map((x) => ({ texte: x.texte, ou: `page ${x.page}` })),
    // Une donnée coupée en fin de ligne se retrouve dans le texte de la page entière
    // (chiffres retirés : des nombres voisins mis bout à bout ne doivent pas former un faux téléphone).
    ...[...pages].map(([n, l]) => ({ texte: l.join(' ').replace(/\d/g, ' '), ou: `page ${n}` })),
    ...c.metadonnees.map((m) => ({ texte: m, ou: 'métadonnées du fichier' })),
  ]
}

/** Recherche, dans le PDF d'un document, les données des locataires de l'autre. */
export function fuitesPdf(contenu: Pick<ContenuPdf, 'textes' | 'metadonnees'>, autre: Edl): Fuite[] {
  const { personnes, autres } = donneesInterdites(autre)
  return rechercherDansTextes(corpusPdf(contenu), personnes, autres)
}

export interface ResultatControlePdf {
  /** Document contrôlé → fuites trouvées dans son PDF. */
  [edlId: string]: Fuite[]
}

/** Fabrique les deux PDF et vérifie que chacun ne contient rien du locataire de l'autre. */
export async function controlerPdfsLies(a: Edl, b: Edl): Promise<ResultatControlePdf> {
  const { fabriquerRapport } = await import('../rapport/rapport')
  const pa = await fabriquerRapport(a)
  const pb = await fabriquerRapport(b)
  return { [a.id]: fuitesPdf(pa, b), [b.id]: fuitesPdf(pb, a) }
}

/** Document jumeau d'un état des lieux issu d'une visite commune (hors corbeille). */
export async function documentLie(edl: Edl): Promise<Edl | undefined> {
  if (!edl.issuDeVisite) return undefined
  const autre = await db.edls.get(edl.issuDeVisite.autreId)
  return autre && !autre.corbeille ? autre : undefined
}
