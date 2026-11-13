import type { Categorie, Element, Piece, TypeBien } from '../db/types'
import { nouvelId } from '../db/base'

/* ------------------------------------------------------------------
   Modèles de pièces et d'éléments, par type de bien.
   Ils servent à préremplir chaque pièce : on ajoute ou retire
   ensuite librement des éléments sur le terrain.
   (Ils deviendront modifiables dans les Paramètres à l'étape 9.)
   ------------------------------------------------------------------ */

/** [libellé, catégorie, équipement à tester ?] */
type Def = [string, Categorie, boolean?]

export interface ModelePiece {
  cle: string
  nom: string
  biens: TypeBien[]
  /** Nombre proposé par défaut à la création, selon le type de bien. */
  parDefaut: Partial<Record<TypeBien, number>>
  elements: Def[]
}

// --- Briques communes -------------------------------------------------
const SOL_MURS_PLAFOND: Def[] = [
  ['Sol', 'revetement'],
  ['Plinthes', 'revetement'],
  ['Murs', 'revetement'],
  ['Plafond', 'revetement'],
]
const MENUISERIES: Def[] = [
  ['Porte', 'menuiserie'],
  ['Fenêtre(s)', 'menuiserie'],
  ['Volets / stores', 'menuiserie', true],
]
const ELECTRICITE: Def[] = [
  ['Prises électriques', 'electricite', true],
  ['Interrupteurs', 'electricite', true],
  ['Éclairage / points lumineux', 'electricite', true],
]
const CHAUFFAGE: Def[] = [['Radiateur / chauffage', 'chauffage', true]]

const PIECE_DE_VIE: Def[] = [...MENUISERIES, ...SOL_MURS_PLAFOND, ...ELECTRICITE, ...CHAUFFAGE]

// --- Modèles ----------------------------------------------------------
export const MODELES: ModelePiece[] = [
  // Habitation
  {
    cle: 'entree',
    nom: 'Entrée',
    biens: ['appartement', 'maison'],
    parDefaut: { appartement: 1, maison: 1 },
    elements: [
      ["Porte d'entrée", 'menuiserie'],
      ['Serrure / verrou', 'menuiserie', true],
      ['Sonnette / interphone', 'equipement', true],
      ...SOL_MURS_PLAFOND,
      ['Placard', 'menuiserie'],
      ...ELECTRICITE,
      ['Tableau électrique', 'electricite', true],
    ],
  },
  {
    cle: 'sejour',
    nom: 'Séjour',
    biens: ['appartement', 'maison'],
    parDefaut: { appartement: 1, maison: 1 },
    elements: PIECE_DE_VIE,
  },
  {
    cle: 'cuisine',
    nom: 'Cuisine',
    biens: ['appartement', 'maison', 'local'],
    parDefaut: { appartement: 1, maison: 1 },
    elements: [
      ...PIECE_DE_VIE,
      ['Crédence', 'revetement'],
      ['Plan de travail', 'equipement'],
      ['Meubles hauts', 'equipement'],
      ['Meubles bas', 'equipement'],
      ['Évier', 'plomberie'],
      ['Robinetterie', 'plomberie', true],
      ['Plaques de cuisson', 'equipement', true],
      ['Hotte', 'equipement', true],
      ['Four', 'equipement', true],
      ['VMC / aération', 'equipement', true],
    ],
  },
  {
    cle: 'chambre',
    nom: 'Chambre',
    biens: ['appartement', 'maison'],
    parDefaut: { appartement: 1, maison: 2 },
    elements: [...PIECE_DE_VIE, ['Placard', 'menuiserie']],
  },
  {
    cle: 'sdb',
    nom: 'Salle de bains',
    biens: ['appartement', 'maison'],
    parDefaut: { appartement: 1, maison: 1 },
    elements: [
      ['Porte', 'menuiserie'],
      ['Fenêtre(s)', 'menuiserie'],
      ...SOL_MURS_PLAFOND,
      ['Faïence', 'revetement'],
      ['Baignoire / douche', 'plomberie'],
      ['Pare-douche / rideau', 'equipement'],
      ['Lavabo / vasque', 'plomberie'],
      ['Robinetterie', 'plomberie', true],
      ['Meuble vasque', 'equipement'],
      ['Miroir', 'equipement'],
      ['Sèche-serviettes / radiateur', 'chauffage', true],
      ['VMC / aération', 'equipement', true],
      ...ELECTRICITE,
      ['Chauffe-eau', 'plomberie', true],
    ],
  },
  {
    cle: 'wc',
    nom: 'WC',
    biens: ['appartement', 'maison', 'local'],
    parDefaut: { appartement: 1, maison: 1 },
    elements: [
      ['Porte', 'menuiserie'],
      ...SOL_MURS_PLAFOND,
      ['Cuvette / abattant', 'plomberie'],
      ["Chasse d'eau", 'plomberie', true],
      ['Lave-mains', 'plomberie'],
      ['Robinetterie', 'plomberie', true],
      ['VMC / aération', 'equipement', true],
      ['Éclairage / points lumineux', 'electricite', true],
    ],
  },
  {
    cle: 'degagement',
    nom: 'Couloir / dégagement',
    biens: ['appartement', 'maison'],
    parDefaut: { appartement: 1, maison: 1 },
    elements: [...SOL_MURS_PLAFOND, ['Placard', 'menuiserie'], ...ELECTRICITE],
  },
  {
    cle: 'buanderie',
    nom: 'Buanderie / cellier',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [['Porte', 'menuiserie'], ...SOL_MURS_PLAFOND, ['Arrivée / évacuation lave-linge', 'plomberie', true], ...ELECTRICITE],
  },
  {
    cle: 'balcon',
    nom: 'Balcon / terrasse',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [
      ['Sol', 'exterieur'],
      ['Garde-corps', 'exterieur'],
      ['Murs / façade', 'exterieur'],
      ['Évacuation eaux pluviales', 'exterieur'],
      ['Éclairage extérieur', 'electricite', true],
    ],
  },
  {
    cle: 'cave',
    nom: 'Cave',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [['Porte', 'menuiserie'], ['Serrure / cadenas', 'menuiserie', true], ['Sol', 'revetement'], ['Murs', 'revetement'], ['Plafond', 'revetement'], ['Éclairage / points lumineux', 'electricite', true]],
  },
  {
    cle: 'garage',
    nom: 'Garage / box',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [
      ['Porte de garage', 'menuiserie'],
      ['Motorisation / télécommande', 'equipement', true],
      ['Sol', 'revetement'],
      ['Murs', 'revetement'],
      ['Plafond', 'revetement'],
      ['Prises électriques', 'electricite', true],
      ['Éclairage / points lumineux', 'electricite', true],
    ],
  },
  {
    cle: 'jardin',
    nom: 'Jardin',
    biens: ['maison'],
    parDefaut: { maison: 1 },
    elements: [
      ['Pelouse / espaces verts', 'exterieur'],
      ['Haies / arbres', 'exterieur'],
      ['Allées', 'exterieur'],
      ['Clôtures', 'exterieur'],
      ['Portail / portillon', 'exterieur', true],
      ["Point d'eau / arrosage", 'plomberie', true],
      ['Éclairage extérieur', 'electricite', true],
      ['Abri de jardin', 'exterieur'],
    ],
  },
  {
    cle: 'exterieurs',
    nom: 'Façades et extérieurs',
    biens: ['maison'],
    parDefaut: { maison: 1 },
    elements: [
      ['Façades', 'exterieur'],
      ['Toiture (partie visible)', 'exterieur'],
      ['Gouttières / descentes', 'exterieur'],
      ['Menuiseries extérieures', 'menuiserie'],
      ['Boîte aux lettres', 'exterieur'],
    ],
  },

  // Locaux d'activité / entrepôts
  {
    cle: 'stockage',
    nom: 'Zone de stockage',
    biens: ['local'],
    parDefaut: { local: 1 },
    elements: [
      ['Dallage / sol', 'revetement'],
      ['Marquage au sol', 'revetement'],
      ['Murs / bardage intérieur', 'revetement'],
      ['Charpente / toiture (vue intérieure)', 'revetement'],
      ['Portes sectionnelles', 'menuiserie', true],
      ['Portes piétonnes', 'menuiserie'],
      ['Racks / rayonnages', 'equipement'],
      ['Éclairage', 'electricite', true],
      ['Prises / armoires électriques', 'electricite', true],
      ['Chauffage / aérothermes', 'chauffage', true],
      ['Exutoires / désenfumage', 'securite', true],
    ],
  },
  {
    cle: 'quais',
    nom: 'Quais de chargement',
    biens: ['local'],
    parDefaut: { local: 1 },
    elements: [
      ['Portes sectionnelles de quai', 'menuiserie', true],
      ['Niveleurs', 'equipement', true],
      ["Sas d'étanchéité", 'equipement'],
      ['Butoirs', 'equipement'],
      ['Dallage du quai', 'revetement'],
      ['Éclairage de quai', 'electricite', true],
      ['Feux de signalisation', 'electricite', true],
    ],
  },
  {
    cle: 'bureaux',
    nom: 'Bureaux',
    biens: ['local'],
    parDefaut: { local: 1 },
    elements: [
      ...MENUISERIES,
      ...SOL_MURS_PLAFOND,
      ...ELECTRICITE,
      ['Prises RJ45', 'electricite'],
      ['Chauffage / climatisation', 'chauffage', true],
    ],
  },
  {
    cle: 'sociaux',
    nom: 'Locaux sociaux / sanitaires',
    biens: ['local'],
    parDefaut: { local: 1 },
    elements: [
      ['Porte', 'menuiserie'],
      ...SOL_MURS_PLAFOND,
      ['Lavabos', 'plomberie'],
      ['WC', 'plomberie', true],
      ['Douches', 'plomberie', true],
      ['Robinetterie', 'plomberie', true],
      ['Vestiaires', 'equipement'],
      ['Chauffe-eau', 'plomberie', true],
      ['VMC / aération', 'equipement', true],
      ['Éclairage / points lumineux', 'electricite', true],
    ],
  },
  {
    cle: 'technique',
    nom: 'Local technique',
    biens: ['local', 'maison'],
    parDefaut: { local: 1 },
    elements: [
      ['Porte', 'menuiserie'],
      ['Tableau électrique général (TGBT)', 'electricite', true],
      ['Chaudière / production de chaleur', 'chauffage', true],
      ['Sol', 'revetement'],
      ['Murs', 'revetement'],
      ['Éclairage / points lumineux', 'electricite', true],
    ],
  },
  {
    cle: 'incendie',
    nom: 'Sécurité incendie',
    biens: ['local'],
    parDefaut: { local: 1 },
    elements: [
      ['Extincteurs', 'securite', true],
      ['RIA (robinets incendie armés)', 'securite', true],
      ['Sprinklers', 'securite', true],
      ['Désenfumage', 'securite', true],
      ['Issues de secours', 'securite'],
      ['Blocs de secours (BAES)', 'securite', true],
      ['Alarme incendie', 'securite', true],
      ["Plans d'évacuation", 'securite'],
    ],
  },
  {
    cle: 'facades_local',
    nom: 'Façades et toiture',
    biens: ['local'],
    parDefaut: { local: 1 },
    elements: [
      ['Bardage / façades', 'exterieur'],
      ['Toiture (partie visible)', 'exterieur'],
      ['Gouttières / chéneaux', 'exterieur'],
      ['Menuiseries extérieures', 'menuiserie'],
      ['Enseigne', 'exterieur'],
    ],
  },
  {
    cle: 'cour',
    nom: 'Cour, voirie et parking',
    biens: ['local'],
    parDefaut: { local: 1 },
    elements: [
      ['Enrobé / voirie', 'exterieur'],
      ['Marquage', 'exterieur'],
      ['Clôtures', 'exterieur'],
      ['Portails', 'exterieur', true],
      ['Éclairage extérieur', 'electricite', true],
      ['Regards / réseaux', 'exterieur'],
      ['Espaces verts', 'exterieur'],
    ],
  },
]

export function modelesPour(bien: TypeBien): ModelePiece[] {
  return MODELES.filter((m) => m.biens.includes(bien))
}

export function modele(cle: string): ModelePiece | undefined {
  return MODELES.find((m) => m.cle === cle)
}

function creerElement([libelle, categorie, equipement]: Def): Element {
  return { id: nouvelId(), libelle, categorie, equipement: !!equipement, observations: [], photoIds: [] }
}

/**
 * Crée les pièces à partir des quantités choisies.
 * Quand une pièce est en plusieurs exemplaires, elles sont numérotées (« Chambre 1 », « Chambre 2 »).
 */
export function creerPieces(quantites: Record<string, number>, bien: TypeBien): Piece[] {
  const pieces: Piece[] = []
  for (const m of modelesPour(bien)) {
    const n = quantites[m.cle] ?? 0
    for (let i = 1; i <= n; i++) {
      pieces.push({
        id: nouvelId(),
        modele: m.cle,
        nom: n > 1 ? `${m.nom} ${i}` : m.nom,
        elements: m.elements.map(creerElement),
        photoIds: [],
      })
    }
  }
  return pieces
}

export function quantitesParDefaut(bien: TypeBien): Record<string, number> {
  return Object.fromEntries(modelesPour(bien).map((m) => [m.cle, m.parDefaut[bien] ?? 0]))
}
