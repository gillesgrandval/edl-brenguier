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
  /**
   * Éléments ordinaires : nombre d’exemplaires (absent = 1).
   * Éléments comptés (prises, interrupteurs, points lumineux, climatisation) :
   * absent = non renseigné ; 0 = aucun ; n = nombre constaté (voir quantiteSource).
   */
  quantite?: number
  /** Élément compté : nombre repris de la fiche du bien ou de l’entrée, À VÉRIFIER (absent = constaté sur place). */
  quantiteSource?: SourceQuantite
  /** Nature particulière, qui ajoute une saisie dédiée (nombre, unités de climatisation). */
  genre?: GenreElement
  /** Climatisation : une fiche par unité. */
  unites?: UniteClim[]
  etat?: Etat
  fonctionnement?: Fonctionnement
  trousChevilles?: number
  aNettoyer?: boolean
  reserve?: boolean
  observations: string[]
  localisation?: string
  commentaire?: string
  /**
   * État constaté au précédent état des lieux (ex. ancien PDF Opéra Groupe), repris pour
   * cette visite : sert de point de comparaison (évolution, dégradations, chiffrage).
   */
  reference?: { etat?: Etat; observations?: string; quantite?: number; trous?: number }
  /** Pré-rempli d'après l'état précédent : à confirmer (« toujours le cas ») ou à modifier sur place. */
  aConfirmer?: boolean
  /** Visite commune : observation reprise UNIQUEMENT dans l'état des lieux de sortie. */
  noteSortie?: string
  /** Visite commune : observation (réserve de l'entrant) reprise UNIQUEMENT dans l'état des lieux d'entrée. */
  noteEntree?: string
  photoIds: string[]
}

/** Éléments dont on saisit le nombre dans chaque pièce. */
export type GenreElement = 'prises' | 'interrupteurs' | 'points_lumineux' | 'climatisation'

export type SourceQuantite = 'fiche' | 'entree'

/** Unité de climatisation d’une pièce. */
export interface UniteClim {
  id: string
  /** true = réversible (chaud / froid), false = froid seul, absent = non précisé. */
  reversible?: boolean
  marque?: string
  etat?: Etat
  fonctionnement?: Fonctionnement
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
  /** Sortie : chiffrage des dégradations, par identifiant d'élément (même identifiant qu'à l'entrée). */
  degradations?: Record<string, Degradation>
  /** Sortie signée : grille de vétusté en vigueur à la signature (figée, couverte par l'empreinte). */
  grilleVetuste?: { grille: Record<string, { libelle: string; franchise: number; abattement: number; residuel: number }>; validee: boolean }

  chauffage: Energie
  eauChaude: Energie & { idemChauffage?: boolean }

  pieces: Piece[]
  observationsGenerales?: string
  remarquesLocataire?: string

  // Rubriques transversales (complétées automatiquement à l'ouverture si absentes)
  compteurs?: ReleveCompteur[]
  cles?: Cle[]
  detecteur?: Detecteur
  /** Boîte aux lettres (le nombre de clés est celui de la ligne « Boîte aux lettres » des clés). */
  boiteAuxLettres?: BoiteAuxLettres
  /** Sortie : date de restitution des clés. */
  dateRestitutionCles?: string

  // Clôture (étape 6)
  /** Lieu de signature (par défaut, la ville du bien). */
  lieuSignature?: string
  /** Personnes appelées à signer, figées au moment de la signature. */
  signataires?: Signataire[]
  /** Renseignée à la signature : plus aucune modification n'est possible ensuite. */
  cloture?: Cloture
  /** Brouillon mis à la corbeille (restaurable). Jamais pour un état des lieux signé. */
  corbeille?: { le: string; motif?: string }
  /**
   * Visite commune (sortie + entrée le même jour) : fiche de travail, jamais signée.
   * `locataires` y désigne les locataires SORTANTS. « Terminer la visite » la remplace
   * par deux états des lieux distincts (sortie et entrée).
   */
  commune?: VisiteCommune
  /** Éléments pré-remplis d'après un précédent état des lieux hors application (ancien PDF) : sa source et sa date. */
  referenceHistorique?: SourceReference
  /** État des lieux issu d'une visite commune : référence de la visite et document jumeau. */
  issuDeVisite?: { reference: string; autreId: string; autreReference: string }
}

export interface SourceReference {
  /** Ex. « Opéra Groupe ». */
  source: string
  /** Date du précédent état des lieux (AAAA-MM-JJ). */
  date: string
  mission?: string
}

/** Élément tel que relevé dans le précédent état des lieux. */
export interface ElementReference {
  libelle: string
  type?: string
  nature?: string
  categorie: Categorie
  equipement: boolean
  quantite?: number
  trous?: number
  etat?: Etat
  observations?: string
}

/** État détaillé du bien au précédent état des lieux, pièce par pièce. */
export interface EtatReference extends SourceReference {
  pieces: { nom: string; modele: string; elements: ElementReference[] }[]
}

/** Données propres à une visite commune (rangées à part pour ne jamais être mélangées). */
export interface VisiteCommune {
  /** Locataires entrants (leurs coordonnées n'iront que dans l'état des lieux d'entrée). */
  entrants: Personne[]
  /** Remarques du locataire entrant (le champ `remarquesLocataire` est celui du sortant). */
  remarquesEntrant?: string
  /** Observations générales propres à chaque document (en plus des observations communes). */
  observationsSortie?: string
  observationsEntree?: string
}

/** Oui / non / non vérifié (absent = non renseigné). */
export type OuiNonNv = 'oui' | 'non' | 'non_verifie'

export interface BoiteAuxLettres {
  /** Absent = non renseigné. */
  presence?: 'oui' | 'non'
  numero?: string
  emplacement?: string
  etat?: Etat
  serrure?: OuiNonNv
  observations?: string
  photoIds: string[]
}

/**
 * Annulation (archivage) d'un état des lieux signé.
 * Rangée À PART : le document signé et son empreinte ne sont jamais modifiés.
 */
export interface Annulation {
  edlId: string
  le: string
  motif: string
}

export type ActionJournal =
  | 'corbeille'
  | 'restauration'
  | 'suppression_definitive'
  | 'annulation'
  | 'retablissement'
  | 'code_defini'
  | 'code_modifie'
  | 'code_reinitialise'
  | 'visite_terminee'

/** Trace des suppressions, annulations et changements de code (jamais effacée). */
export interface EntreeJournal {
  id: string
  le: string
  action: ActionJournal
  edlId?: string
  /** Ce qui a été touché, lisible (référence, bien, date, type, statut). */
  description: string
  motif?: string
}

/** Chiffrage d'une dégradation constatée à la sortie. */
export interface Degradation {
  /** Imputable au locataire (par défaut : oui si l'état s'est dégradé). */
  imputable: boolean
  /** Date de pose ou de dernière rénovation (AAAA-MM-JJ) ; à défaut, date de l'entrée. */
  depuis?: string
  /** Coût de remise en état TTC (euros). */
  cout?: number
  commentaire?: string
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
  /**
   * Signature reprise, avec la validation explicite du signataire, de l'état des lieux lié
   * (visite commune) : référence de ce document. Mentionné au rapport.
   */
  repriseDe?: string
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
  /** Nombre remis (entrée) ou restitué (sortie). Visite commune : restituées par le sortant. */
  nombre: number
  /** Visite commune : nombre remis au locataire entrant (absent = même nombre que restitué). */
  nombreRemis?: number
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
  /** Nombres connus (prises, interrupteurs, points lumineux, climatisations), à vérifier à chaque visite. */
  quantites?: Partial<Record<GenreElement, number>>
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
  /** Boîte aux lettres : repris dans chaque état des lieux. */
  bal?: { numero?: string; emplacement?: string }
  /** État détaillé relevé au dernier état des lieux connu (ancien PDF), pour pré-remplir la prochaine visite. */
  etatReference?: EtatReference
  creeLe: string
  modifieLe: string
}
