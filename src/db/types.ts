/* ------------------------------------------------------------------
   Modèle de données de l'application.
   Un état des lieux (Edl) contient ses pièces et leurs éléments.
   Les photos et signatures, plus lourdes, sont rangées à part
   et reliées par identifiant.
   ------------------------------------------------------------------ */

export type TypeActe = 'entree' | 'sortie' | 'pre'
export type TypeBien = 'appartement' | 'maison' | 'local'
export type Statut = 'brouillon' | 'en_cours' | 'signe'

/** Échelle d'état, du meilleur au pire (codes repris dans le PDF). */
export type Etat = 'neuf' | 'tres_bon' | 'bon' | 'use' | 'mauvais' | 'hs' | 'absent'

export type Fonctionnement = 'ok' | 'defaillant' | 'non_teste'

export type ModeEnergie = 'individuel' | 'collectif' | 'aucun'

export interface Personne {
  id: string
  civilite?: string
  nom: string
  prenom?: string
  telephone?: string
  email?: string
}

/** Entité du groupe pouvant être bailleur (paramétrée une fois, réutilisée). */
export interface Entite {
  id: string
  raisonSociale: string
  adresse: string
  siren?: string
  representant?: string
}

export interface Element {
  id: string
  libelle: string
  categorie: Categorie
  /** true pour un équipement dont on teste le fonctionnement. */
  equipement: boolean
  nature?: string
  quantite?: number
  etat?: Etat
  fonctionnement?: Fonctionnement
  trousChevilles?: number
  aNettoyer?: boolean
  reserve?: boolean
  observations: string[]
  localisation?: string
  commentaire?: string
  photoIds: string[]
}

export type Categorie =
  | 'revetement'
  | 'menuiserie'
  | 'electricite'
  | 'chauffage'
  | 'plomberie'
  | 'equipement'
  | 'exterieur'
  | 'securite'

export interface Piece {
  id: string
  /** Clé du modèle d'origine (ex. « chambre »). */
  modele: string
  nom: string
  dimensions?: string
  elements: Element[]
  commentaire?: string
  photoIds: string[]
}

export interface Energie {
  mode: ModeEnergie
  energie?: string
}

export interface Edl {
  id: string
  /** Référence lisible, ex. « EDL-2026-012 ». */
  reference: string
  typeActe: TypeActe
  typeBien: TypeBien
  meuble: boolean
  statut: Statut
  /** Date et heure de la visite (ISO). */
  dateVisite: string
  creeLe: string
  modifieLe: string

  bien: {
    adresse: string
    complement?: string
    codePostal: string
    ville: string
    etage?: string
    lot?: string
    surface?: string
    nbPieces?: string
    annexes: string[]
    digicode?: string
  }

  bailleur: {
    entiteId?: string
    raisonSociale: string
    adresse: string
    siren?: string
    representant?: string
  }
  mandataire?: { nom: string; adresse?: string }
  /** Personne qui réalise l'état des lieux pour le bailleur. */
  operateur: { nom: string; qualite?: string }
  locataires: Personne[]
  /** Sortie uniquement. */
  nouvelleAdresseLocataire?: string
  /** Sortie : état des lieux d'entrée de référence (étape 8). */
  edlEntreeId?: string

  chauffage: Energie
  eauChaude: Energie & { idemChauffage?: boolean }

  pieces: Piece[]
  observationsGenerales?: string
}

export interface Photo {
  id: string
  edlId: string
  pieceId?: string
  elementId?: string
  /** Numéro unique dans l'état des lieux, repris dans le PDF. */
  numero: number
  image: Blob
  miniature: Blob
  legende?: string
  priseLe: string
}

export interface Meta {
  cle: string
  valeur: unknown
}
