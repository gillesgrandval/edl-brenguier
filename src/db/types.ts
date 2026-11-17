/* ------------------------------------------------------------------
   Modèle de données de l'application.
   Un état des lieux (Edl) contient ses pièces et leurs éléments.
   Les photos et signatures, plus lourdes, sont rangées à part
   et reliées par identifiant.
   ------------------------------------------------------------------ */

/** « À définir » : état des lieux préparé à l'avance, type à choisir avant la signature. */
export type TypeActe = 'entree' | 'sortie' | 'pre' | 'a_definir'
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
  /** Date et heure de la visite (« AAAA-MM-JJTHH:MM ») ou date seule (« AAAA-MM-JJ ») si l'heure n'est pas encore fixée. */
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
  /** Bien du patrimoine dont cet état des lieux est issu (identifiant permanent). */
  bienId?: string

  chauffage: Energie
  eauChaude: Energie & { idemChauffage?: boolean }

  pieces: Piece[]
  observationsGenerales?: string
  remarquesLocataire?: string

  // Rubriques transversales (complétées automatiquement à l'ouverture si absentes)
  compteurs?: ReleveCompteur[]
  cles?: Cle[]
  detecteur?: Detecteur
  /** Sortie : date de restitution des clés. */
  dateRestitutionCles?: string

  // Clôture (étape 6)
  /** Lieu de signature (par défaut, la ville du bien). */
  lieuSignature?: string
  /** Personnes appelées à signer, figées au moment de la signature. */
  signataires?: Signataire[]
  /** Renseignée à la signature : plus aucune modification n'est possible ensuite. */
  cloture?: Cloture
}

export interface Signataire {
  id: string
  role: 'bailleur' | 'locataire'
  /** Identifiant du locataire (Personne) concerné. */
  personneId?: string
  nom: string
  /** Ex. « Gestionnaire, pour SCI … ». */
  qualite?: string
  /** Image de la signature (table « signatures »). */
  signatureId?: string
  /** Absent ou refus de signer : la mention figure au rapport. */
  absent?: boolean
  motifAbsence?: string
}

export interface Cloture {
  /** Date et heure de signature (ISO). */
  signeLe: string
  /** Empreinte SHA-256 du contenu, des photos et des signatures. */
  empreinte: string
  versionApp: string
}

/** Signature manuscrite tracée au doigt (PNG). */
export interface SignatureImage {
  id: string
  edlId: string
  image: Blob
  traceeLe: string
}

export type TypeCompteur = 'electricite' | 'gaz' | 'eau_froide' | 'eau_chaude' | 'autre'

export interface ReleveCompteur {
  id: string
  type: TypeCompteur
  libelle: string
  /** N° PDL (électricité), PCE (gaz) ou n° de compteur. */
  numero?: string
  /** Index (ou heures pleines). */
  index?: string
  /** Index heures creuses (électricité). */
  indexHC?: string
  /** Date du relevé (renseignée automatiquement à la saisie de l'index, modifiable). */
  dateReleve?: string
  nonApplicable?: boolean
  commentaire?: string
  photoIds: string[]
}

export interface Cle {
  id: string
  libelle: string
  nombre: number
  commentaire?: string
  photoIds: string[]
}

export interface Detecteur {
  present?: boolean
  fonctionnement?: Fonctionnement
  commentaire?: string
  photoIds: string[]
}

/** Forme dessinée sur une photo (coordonnées en pixels de l'image). */
export type Forme =
  | { type: 'fleche' | 'cercle' | 'rectangle'; couleur: string; epaisseur: number; x1: number; y1: number; x2: number; y2: number }
  | { type: 'main'; couleur: string; epaisseur: number; points: [number, number][] }
  | { type: 'texte'; couleur: string; taille: number; x: number; y: number; texte: string }

export interface Photo {
  id: string
  edlId: string
  pieceId?: string
  elementId?: string
  /** Numéro unique dans l'état des lieux, repris dans le PDF. */
  numero: number
  /** Image affichée (avec annotations éventuelles). */
  image: Blob
  miniature: Blob
  /** Image d'origine sans annotations (conservée dès la première annotation). */
  base?: Blob
  annotations?: Forme[]
  legende?: string
  priseLe: string
}

export interface Meta {
  cle: string
  valeur: unknown
}

// =====================================================================
// Patrimoine immobilier
// =====================================================================

export type CategorieBien = 'appartement' | 'villa' | 'maison' | 'immeuble' | 'entrepot' | 'local_commercial' | 'mobil_home' | 'autre'

/** Équipement connu d'une pièce, ajouté au parcours de contrôle (état à vérifier sur place). */
export interface EquipementConnu {
  libelle: string
  categorie?: Categorie
  /** Remplace un élément du modèle portant ce libellé (ex. « Hotte » → « Hotte aspirante »). */
  remplace?: string
  /** Remarque préalable (ex. « emplacement à confirmer »). */
  note?: string
}

export interface PieceBien {
  /** Modèle de pièce (voir modeles/pieces.ts). */
  modele: string
  nom: string
  equipements?: EquipementConnu[]
}

/**
 * Fiche permanente d'un bien du patrimoine.
 * Un état des lieux en garde une COPIE : le modifier ne change jamais la fiche.
 */
export interface Bien {
  /** Identifiant technique permanent, indépendant du numéro de lot. */
  id: string
  /** Identifiant dans le fichier source (Excel), pour les mises à jour sans doublon. */
  identifiantExterne?: string
  reference?: string
  lot?: string
  societe?: string
  categorie: CategorieBien
  /** Ex. « T3 ». */
  typologie?: string
  adresse: string
  complement?: string
  codePostal: string
  ville: string
  residence?: string
  batiment?: string
  etage?: string
  porte?: string
  surface?: string
  nbPieces?: string
  chambres?: number
  sallesEau?: number
  wc?: number
  meuble?: boolean
  annexes: string[]
  equipements: string[]
  pieces: PieceBien[]
  /** Compteurs à relever lors de chaque état des lieux. */
  compteurs: TypeCompteur[]
  infos?: string
  creeLe: string
  modifieLe: string
}
