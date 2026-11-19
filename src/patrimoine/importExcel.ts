/* ------------------------------------------------------------------
   Import du patrimoine depuis un tableau (Excel).
   1. On devine la correspondance colonnes → champs d'après les en-têtes
      (modifiable par l'utilisateur).
   2. Chaque ligne est vérifiée : erreurs bloquantes, avertissements.
   3. Chaque ligne est rapprochée d'un bien existant (identifiant, sinon
      ville + adresse + lot/référence) : mise à jour, jamais de doublon.
   Les états des lieux ne sont jamais touchés par un import.
   ------------------------------------------------------------------ */

import type { Bien, CategorieBien, EquipementConnu, PieceBien, TypeCompteur } from '../db/types'

export type CleChamp =
  | 'identifiantExterne'
  | 'reference'
  | 'lot'
  | 'societe'
  | 'categorie'
  | 'typologie'
  | 'adresse'
  | 'complement'
  | 'codePostal'
  | 'ville'
  | 'residence'
  | 'batiment'
  | 'etage'
  | 'porte'
  | 'surface'
  | 'nbPieces'
  | 'chambres'
  | 'sallesEau'
  | 'wc'
  | 'annexes'
  | 'equipements'
  | 'compteurs'
  | 'meuble'
  | 'infos'

export interface Champ {
  cle: CleChamp
  libelle: string
  /** Mots reconnus dans l'en-tête de colonne (sans accents, minuscules). */
  synonymes: string[]
  obligatoire?: boolean
}

export const CHAMPS: Champ[] = [
  { cle: 'identifiantExterne', libelle: 'Identifiant unique', synonymes: ['identifiant', 'id bien', 'id unique', 'code bien', 'code'] },
  { cle: 'reference', libelle: 'Référence interne', synonymes: ['reference', 'ref'] },
  { cle: 'lot', libelle: 'N° de lot', synonymes: ['lot', 'n lot', 'numero de lot', 'no lot'] },
  { cle: 'societe', libelle: 'Société propriétaire / gestionnaire', synonymes: ['societe', 'proprietaire', 'gestionnaire', 'sci', 'bailleur'] },
  { cle: 'categorie', libelle: 'Type de bien', synonymes: ['type de bien', 'type', 'nature', 'categorie'] },
  { cle: 'typologie', libelle: 'Typologie (T2, T3…)', synonymes: ['typologie', 'typo'] },
  { cle: 'adresse', libelle: 'Adresse', synonymes: ['adresse', 'rue', 'voie', 'adresse complete'], obligatoire: true },
  { cle: 'complement', libelle: "Complément d'adresse", synonymes: ['complement', 'complement adresse'] },
  { cle: 'codePostal', libelle: 'Code postal', synonymes: ['code postal', 'cp'] },
  { cle: 'ville', libelle: 'Ville', synonymes: ['ville', 'commune', 'localite'], obligatoire: true },
  { cle: 'residence', libelle: 'Résidence / immeuble / camping', synonymes: ['residence', 'immeuble', 'camping', 'ensemble', 'copropriete', 'programme'] },
  { cle: 'batiment', libelle: 'Bâtiment', synonymes: ['batiment', 'bat'] },
  { cle: 'etage', libelle: 'Étage / niveau', synonymes: ['etage', 'niveau'] },
  { cle: 'porte', libelle: 'N° de porte', synonymes: ['porte', 'n porte', 'numero de porte', 'appartement n'] },
  { cle: 'surface', libelle: 'Surface (m²)', synonymes: ['surface', 'superficie', 'm2', 'm²'] },
  { cle: 'nbPieces', libelle: 'Nombre de pièces', synonymes: ['nombre de pieces', 'nb pieces', 'pieces'] },
  { cle: 'chambres', libelle: 'Nombre de chambres', synonymes: ['chambres', 'nb chambres', 'nombre de chambres'] },
  { cle: 'sallesEau', libelle: "Salles d'eau / de bains", synonymes: ['salle d eau', 'salles d eau', 'salle de bain', 'salles de bains', 'sdb', 'sde'] },
  { cle: 'wc', libelle: 'WC', synonymes: ['wc', 'toilettes'] },
  { cle: 'annexes', libelle: 'Annexes', synonymes: ['annexes', 'annexe', 'dependances'] },
  { cle: 'equipements', libelle: 'Équipements', synonymes: ['equipements', 'equipement'] },
  { cle: 'compteurs', libelle: 'Compteurs à relever', synonymes: ['compteurs', 'compteur', 'energies'] },
  { cle: 'meuble', libelle: 'Meublé (oui/non)', synonymes: ['meuble', 'location meublee', 'meublee'] },
  { cle: 'infos', libelle: 'Informations complémentaires', synonymes: ['informations', 'infos', 'observations', 'commentaire', 'remarques', 'notes'] },
]

export const normaliser = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9²]+/g, ' ')
    .trim()

export type Correspondance = Partial<Record<CleChamp, number>>

/** Devine quelle colonne correspond à quel champ, d'après les en-têtes. */
export function devinerCorrespondance(entetes: unknown[]): Correspondance {
  const titres = entetes.map(normaliser)
  const prises = new Set<number>()
  const c: Correspondance = {}
  // 1er passage : en-tête identique à un synonyme ; 2e : en-tête qui le contient.
  for (const exact of [true, false])
    for (const champ of CHAMPS) {
      if (c[champ.cle] !== undefined) continue
      const i = titres.findIndex((t, k) => !prises.has(k) && t && champ.synonymes.some((s) => (exact ? t === s : ` ${t} `.includes(` ${s} `))))
      if (i >= 0) {
        c[champ.cle] = i
        prises.add(i)
      }
    }
  return c
}

const CATEGORIES: [CategorieBien, string[]][] = [
  ['appartement', ['appartement', 'appart', 'studio', 'duplex', 't1', 't2', 't3', 't4', 't5']],
  ['villa', ['villa']],
  ['maison', ['maison', 'pavillon']],
  ['immeuble', ['immeuble']],
  ['entrepot', ['entrepot', 'hangar', 'depot', 'stockage']],
  ['local_commercial', ['local commercial', 'local', 'commerce', 'bureau', 'bureaux', 'boutique']],
  ['mobil_home', ['mobil home', 'mobilhome', 'mobile home', 'mobil-home', 'chalet']],
  ['autre', ['autre']],
]

export function lireCategorie(v: unknown): CategorieBien | null {
  const t = normaliser(v)
  if (!t) return null
  for (const [cat, mots] of CATEGORIES) if (mots.some((m) => t === m || ` ${t} `.includes(` ${m} `))) return cat
  return null
}

const liste = (v: unknown) =>
  String(v ?? '')
    .split(/[,;/\n]+|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

function lireNombre(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  const n = Number(String(v).replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && String(v).match(/\d/) ? n : null
}

function lireCompteurs(v: unknown): TypeCompteur[] {
  const t = normaliser(v)
  const r: TypeCompteur[] = []
  if (/elec|edf|linky|pdl|prm/.test(t)) r.push('electricite')
  if (/gaz|pce/.test(t)) r.push('gaz')
  if (/eau chaude/.test(t)) r.push('eau_chaude')
  if (/eau(?! chaude)|eau froide/.test(t.replace(/eau chaude/g, ''))) r.push('eau_froide')
  return r
}

const texteCellule = (v: unknown) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v).replace('.', ',')
  if (v instanceof Date) return v.toLocaleDateString('fr-FR')
  return String(v).trim()
}

// --- Composition des pièces ---------------------------------------------

const ANNEXES_PIECES: [RegExp, string, string][] = [
  [/parking|stationnement|place/, 'parking', 'Place de parking'],
  [/garage|box/, 'garage', 'Garage / box'],
  [/cave/, 'cave', 'Cave'],
  [/jardin/, 'jardin', 'Jardin'],
  [/terrasse/, 'terrasse', 'Terrasse'],
  [/balcon|loggia/, 'balcon', 'Balcon'],
  [/veranda/, 'veranda', 'Véranda'],
  [/cellier/, 'cellier', 'Cellier'],
  [/buanderie/, 'buanderie', 'Buanderie'],
]

/**
 * Composition proposée à partir des chiffres du tableau (chambres, salles d'eau, WC, annexes).
 * Les équipements sont placés dans la pièce évidente (cuisine, salle d'eau) ;
 * sinon dans la pièce de vie, avec la mention « emplacement à confirmer ».
 * Rien n'est inventé : sans chiffres, aucune pièce n'est créée (à compléter sur place).
 */
export function compositionDepuisTableau(b: Pick<Bien, 'categorie' | 'chambres' | 'sallesEau' | 'wc' | 'annexes' | 'equipements' | 'nbPieces'>): PieceBien[] {
  const habitation = ['appartement', 'villa', 'maison', 'mobil_home'].includes(b.categorie)
  const pieces: PieceBien[] = []
  const nbPieces = lireNombre(b.nbPieces) ?? 0
  const chambres = b.chambres ?? 0
  if (habitation && (nbPieces > chambres || chambres > 0)) pieces.push({ modele: 'sejour', nom: 'Pièce de vie' })
  for (let i = 1; i <= chambres; i++) pieces.push({ modele: 'chambre', nom: chambres > 1 ? `Chambre ${i}` : 'Chambre' })
  for (let i = 1; i <= (b.sallesEau ?? 0); i++) pieces.push({ modele: 'sdb', nom: (b.sallesEau ?? 0) > 1 ? `Salle d'eau ${i}` : "Salle d'eau" })
  for (let i = 1; i <= (b.wc ?? 0); i++) pieces.push({ modele: 'wc', nom: (b.wc ?? 0) > 1 ? `WC ${i}` : 'WC' })
  for (const a of b.annexes) {
    const t = normaliser(a)
    const m = ANNEXES_PIECES.find(([r]) => r.test(t))
    if (m && !pieces.some((p) => p.modele === m[1])) pieces.push({ modele: m[1], nom: a.length > 2 ? a : m[2] })
  }
  // Placement des équipements connus.
  const cible = (re: RegExp) => pieces.find((p) => re.test(p.modele))
  for (const eq of b.equipements) {
    const t = normaliser(eq)
    let p: PieceBien | undefined
    let note: string | undefined
    if (/cuisine|hotte|four|plaque|evier|frigo|refrigerateur|lave vaisselle|micro onde/.test(t)) p = cible(/cuisine/) ?? cible(/sejour|piece_vie/)
    else if (/seche serviette|douche|baignoire|vasque|salle d eau|salle de bain/.test(t)) p = cible(/sdb|salle_eau/)
    else if (/lave linge|seche linge/.test(t)) p = cible(/buanderie/) ?? cible(/sdb|salle_eau/)
    if (!p) {
      p = cible(/sejour|piece_vie/) ?? pieces[0]
      note = 'Emplacement à confirmer lors de la visite'
    }
    if (!p) continue
    // Une climatisation connue remplace l'élément « Climatisation » du modèle (son nombre reste à constater).
    const remplace = /clim/.test(t) ? 'Climatisation' : undefined
    const e: EquipementConnu = { libelle: eq, ...(remplace ? { remplace, categorie: 'chauffage' as const } : {}), ...(note ? { note } : {}) }
    p.equipements = [...(p.equipements ?? []), e]
  }
  return pieces
}

// --- Analyse des lignes ---------------------------------------------------

export interface LigneAnalysee {
  /** N° de ligne dans le tableau (1 = en-têtes). */
  numero: number
  valeurs: Partial<Bien>
  erreurs: string[]
  avertissements: string[]
  action: 'creation' | 'mise_a_jour' | 'ignoree'
  existant?: Bien
}

/** Clé de rapprochement quand il n'y a pas d'identifiant : ville + adresse + lot (ou référence). */
export const cleRapprochement = (b: Partial<Bien>) => [b.ville, b.adresse, b.lot || b.reference].map(normaliser).join('|')

export function analyserLignes(lignes: unknown[][], correspondance: Correspondance, existants: Bien[]): LigneAnalysee[] {
  // Identifiant du fichier, ou identifiant technique (présent dans un export de l'application).
  const parId = new Map([...existants.map((b) => [normaliser(b.id), b] as const), ...existants.filter((b) => b.identifiantExterne).map((b) => [normaliser(b.identifiantExterne), b] as const)])
  const parCle = new Map(existants.map((b) => [cleRapprochement(b), b]))
  const vues = new Set<string>()
  const val = (l: unknown[], c: CleChamp) => (correspondance[c] === undefined ? undefined : l[correspondance[c]!])

  return lignes.map((l, k) => {
    const numero = k + 2
    const erreurs: string[] = []
    const avertissements: string[] = []
    if (l.every((v) => texteCellule(v) === '')) return { numero, valeurs: {}, erreurs: [], avertissements: [], action: 'ignoree' as const }

    const v: Partial<Bien> = {}
    for (const champ of ['identifiantExterne', 'reference', 'lot', 'societe', 'typologie', 'adresse', 'complement', 'codePostal', 'ville', 'residence', 'batiment', 'etage', 'porte', 'infos'] as const) {
      const t = texteCellule(val(l, champ))
      if (t) v[champ] = t
    }
    if (v.codePostal && /^\d{4}$/.test(v.codePostal)) v.codePostal = '0' + v.codePostal // Excel retire le 0 initial
    const cat = val(l, 'categorie')
    if (texteCellule(cat)) {
      const c = lireCategorie(cat)
      if (c) v.categorie = c
      else avertissements.push(`Type « ${texteCellule(cat)} » non reconnu : classé « Autre »`)
    }
    const surface = val(l, 'surface')
    if (texteCellule(surface)) {
      const n = lireNombre(surface)
      if (n === null) avertissements.push(`Surface « ${texteCellule(surface)} » illisible`)
      else v.surface = String(n).replace('.', ',')
    }
    const np = texteCellule(val(l, 'nbPieces'))
    if (np) v.nbPieces = np
    for (const champ of ['chambres', 'sallesEau', 'wc'] as const) {
      const brut = val(l, champ)
      if (!texteCellule(brut)) continue
      const n = lireNombre(brut)
      if (n === null || n < 0 || n > 30) avertissements.push(`${CHAMPS.find((c) => c.cle === champ)!.libelle} : « ${texteCellule(brut)} » illisible`)
      else v[champ] = Math.round(n)
    }
    if (texteCellule(val(l, 'annexes'))) v.annexes = liste(val(l, 'annexes'))
    if (texteCellule(val(l, 'equipements'))) v.equipements = liste(val(l, 'equipements'))
    if (texteCellule(val(l, 'compteurs'))) {
      const c = lireCompteurs(val(l, 'compteurs'))
      if (c.length) v.compteurs = c
      else avertissements.push('Compteurs non reconnus (indiquez : eau, électricité, gaz)')
    }
    const meuble = normaliser(val(l, 'meuble'))
    if (meuble) v.meuble = /^(oui|o|x|1|vrai|yes|meuble)/.test(meuble)

    // Rapprochement avec un bien existant.
    const existant = (v.identifiantExterne && parId.get(normaliser(v.identifiantExterne))) || parCle.get(cleRapprochement(v))
    if (!existant) {
      if (!v.adresse) erreurs.push('Adresse manquante')
      if (!v.ville) erreurs.push('Ville manquante')
      if (!v.codePostal) avertissements.push('Code postal manquant')
    }
    // Doublon à l'intérieur du fichier.
    const cle = v.identifiantExterne ? `id:${normaliser(v.identifiantExterne)}` : `cle:${cleRapprochement(v)}`
    if (vues.has(cle)) erreurs.push('Ligne en double dans le fichier (même bien qu’une ligne précédente)')
    vues.add(cle)

    return { numero, valeurs: v, erreurs, avertissements, action: erreurs.length ? ('ignoree' as const) : existant ? ('mise_a_jour' as const) : ('creation' as const), existant }
  })
}

/**
 * Fiche à enregistrer : un bien existant n'est mis à jour que sur les colonnes renseignées
 * (une cellule vide n'efface rien). La composition n'est proposée qu'à un bien qui n'en a pas.
 */
export function construireBien(l: LigneAnalysee, nouvelId: () => string, maintenant: string): Bien {
  const base: Bien = l.existant ?? {
    id: nouvelId(),
    categorie: 'autre',
    adresse: '',
    codePostal: '',
    ville: '',
    annexes: [],
    equipements: [],
    pieces: [],
    compteurs: ['electricite', 'eau_froide'],
    creeLe: maintenant,
    modifieLe: maintenant,
  }
  const b: Bien = { ...base, ...l.valeurs, modifieLe: maintenant }
  // Identifiant technique relu depuis un export : ce n'est pas un identifiant externe.
  if (l.existant && b.identifiantExterne === l.existant.id) b.identifiantExterne = l.existant.identifiantExterne
  if (!l.existant && !l.valeurs.categorie) b.categorie = l.valeurs.typologie && /^t\d/i.test(l.valeurs.typologie) ? 'appartement' : 'autre'
  if (!b.pieces.length) b.pieces = compositionDepuisTableau(b)
  return b
}
