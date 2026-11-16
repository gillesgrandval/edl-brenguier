import { db, nouvelId } from './base'
import type { Edl, Piece } from './types'

/** Prochaine référence de l'année, ex. « EDL-2026-007 ». Compteur conservé dans la base. */
async function prochaineReference(): Promise<string> {
  const annee = new Date().getFullYear()
  const cle = `compteur-${annee}`
  return db.transaction('rw', db.meta, async () => {
    const n = (((await db.meta.get(cle))?.valeur as number | undefined) ?? 0) + 1
    await db.meta.put({ cle, valeur: n })
    return `EDL-${annee}-${String(n).padStart(3, '0')}`
  })
}

/** Date-heure locale arrondie à la minute, au format attendu par les champs de saisie. */
export function maintenantLocal(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function creerEdl(): Promise<string> {
  const maintenant = new Date().toISOString()
  // On reprend par défaut le dernier opérateur et la dernière entité utilisés.
  const dernier = await db.edls.orderBy('modifieLe').last()
  const edl: Edl = {
    id: nouvelId(),
    reference: await prochaineReference(),
    typeActe: 'entree',
    typeBien: 'appartement',
    meuble: false,
    statut: 'brouillon',
    dateVisite: maintenantLocal(),
    creeLe: maintenant,
    modifieLe: maintenant,
    bien: { adresse: '', codePostal: '', ville: '', annexes: [] },
    bailleur: dernier?.bailleur ?? { raisonSociale: '', adresse: '' },
    operateur: dernier?.operateur ?? { nom: '' },
    locataires: [{ id: nouvelId(), nom: '' }],
    chauffage: { mode: 'individuel' },
    eauChaude: { mode: 'individuel', idemChauffage: true },
    pieces: [],
  }
  await db.edls.add(edl)
  return edl.id
}

export async function enregistrerEdl(edl: Edl): Promise<void> {
  await db.edls.put({ ...edl, modifieLe: new Date().toISOString() })
}

/** Supprime un état des lieux et toutes ses photos. */
export async function supprimerEdl(id: string): Promise<void> {
  await db.transaction('rw', db.edls, db.photos, async () => {
    await db.photos.where('edlId').equals(id).delete()
    await db.edls.delete(id)
  })
}

// --- Progression ------------------------------------------------------

export function progressionPiece(p: Piece): { faits: number; total: number } {
  const total = p.elements.length
  const faits = p.elements.filter((e) => !!e.etat).length
  return { faits, total }
}

/** Liste des informations essentielles manquantes (affichées comme rappels, jamais bloquantes). */
export function infosManquantes(edl: Edl): string[] {
  const manque: string[] = []
  if (!edl.bien.adresse.trim()) manque.push('Adresse du bien')
  if (!edl.bien.ville.trim()) manque.push('Ville')
  if (!edl.bailleur.raisonSociale.trim()) manque.push('Bailleur')
  if (!edl.operateur.nom.trim()) manque.push("Nom de l'opérateur")
  if (!edl.locataires.some((l) => l.nom.trim())) manque.push('Locataire')
  if (edl.typeActe === 'sortie' && !edl.nouvelleAdresseLocataire?.trim()) manque.push('Nouvelle adresse du locataire')
  return manque
}

/** Pourcentage global : informations générales + éléments renseignés. */
export function progressionGlobale(edl: Edl): number {
  const INFOS = 6
  const infosFaites = INFOS - Math.min(INFOS, infosManquantes(edl).length)
  let faits = infosFaites
  let total = INFOS
  for (const p of edl.pieces) {
    const pr = progressionPiece(p)
    faits += pr.faits
    total += pr.total
  }
  return total ? Math.round((faits / total) * 100) : 0
}

export function nomsLocataires(edl: Edl): string {
  return (
    edl.locataires
      .map((l) => [l.prenom, l.nom].filter(Boolean).join(' ').trim())
      .filter(Boolean)
      .join(', ') || 'Locataire non renseigné'
  )
}

export function adresseCourte(edl: Edl): string {
  const { adresse, codePostal, ville } = edl.bien
  return [adresse, [codePostal, ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Adresse non renseignée'
}

/** Modifie directement un état des lieux enregistré (utilisé hors des écrans de saisie). */
export async function majEdl(id: string, recette: (e: Edl) => void): Promise<void> {
  await db.transaction('rw', db.edls, async () => {
    const e = await db.edls.get(id)
    if (!e) return
    recette(e)
    e.modifieLe = new Date().toISOString()
    await db.edls.put(e)
  })
}
