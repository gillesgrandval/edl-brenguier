import type { Categorie, Element, GenreElement, Piece, PieceBien, TypeBien } from '../db/types'
import { nouvelId } from '../db/base'
import { genreDe, genreParLibelle, uniteVierge } from './comptes'

/* ------------------------------------------------------------------
   Modèles de pièces et d'éléments, par type de bien.
   Ils servent à préremplir chaque pièce : on ajoute ou retire
   ensuite librement des éléments sur le terrain.
   (Ils deviendront modifiables dans les Paramètres à l'étape 9.)
   ------------------------------------------------------------------ */

/** [libellé, catégorie, équipement à tester ?, élément compté ?] */
type Def = [string, Categorie, boolean?, GenreElement?]

export interface ModelePiece {
  cle: string
  nom: string
  biens: TypeBien[]
  /** Nombre proposé par défaut à la création, selon le type de bien. */
  parDefaut: Partial<Record<TypeBien, number>>
  elements: Def[]
  /** Modèle spécial (inventaire du mobilier) : non proposé dans la liste des pièces. */
  special?: boolean
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
// Prises, interrupteurs et points lumineux : trois éléments distincts, chacun avec son nombre.
const PRISES: Def = ['Prises électriques', 'electricite', true, 'prises']
const INTERRUPTEURS: Def = ['Interrupteurs', 'electricite', true, 'interrupteurs']
const POINTS_LUMINEUX: Def = ['Points lumineux', 'electricite', true, 'points_lumineux']
const ELECTRICITE: Def[] = [PRISES, INTERRUPTEURS, POINTS_LUMINEUX]
const CHAUFFAGE: Def[] = [['Radiateur / chauffage', 'chauffage', true]]
/** Nombre d'unités à constater sur place (0, 1, 2…) : jamais présumé d'après la fiche du logement. */
const CLIMATISATION: Def = ['Climatisation', 'chauffage', true, 'climatisation']

const PIECE_DE_VIE: Def[] = [...MENUISERIES, ...SOL_MURS_PLAFOND, ...ELECTRICITE, ...CHAUFFAGE, CLIMATISATION]

/** Rubriques de base d'une pièce personnalisée : murs, sols, plafonds, menuiseries, électricité, chauffage. */
export const RUBRIQUES_BASE: Def[] = [...PIECE_DE_VIE]

/** Éléments comptés proposés en un geste dans « Ajouter un élément ». */
export const ELEMENTS_COMPTES: Def[] = [PRISES, INTERRUPTEURS, POINTS_LUMINEUX, CLIMATISATION]
const COIN_CUISINE: Def[] = [
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
]

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
    elements: [...PIECE_DE_VIE, ...COIN_CUISINE],
  },
  {
    cle: 'piece_vie_cuisine',
    nom: 'Pièce de vie avec cuisine',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [...PIECE_DE_VIE, ...COIN_CUISINE],
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
      INTERRUPTEURS,
      POINTS_LUMINEUX,
    ],
  },
  {
    cle: 'salle_eau_wc',
    nom: "Salle d'eau avec WC",
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [
      ['Porte', 'menuiserie'],
      ['Fenêtre(s)', 'menuiserie'],
      ...SOL_MURS_PLAFOND,
      ['Faïence', 'revetement'],
      ['Douche / receveur', 'plomberie'],
      ['Paroi / pare-douche', 'equipement'],
      ['Lavabo / vasque', 'plomberie'],
      ['Robinetterie', 'plomberie', true],
      ['Meuble vasque', 'equipement'],
      ['Miroir', 'equipement'],
      ['Cuvette / abattant', 'plomberie'],
      ["Chasse d'eau", 'plomberie', true],
      ['Sèche-serviettes / radiateur', 'chauffage', true],
      ['VMC / aération', 'equipement', true],
      ...ELECTRICITE,
    ],
  },
  {
    cle: 'couloir',
    nom: 'Couloir',
    biens: ['appartement', 'maison', 'local'],
    parDefaut: { appartement: 1, maison: 1 },
    elements: [...SOL_MURS_PLAFOND, ['Placard', 'menuiserie'], ...ELECTRICITE],
  },
  {
    cle: 'degagement',
    nom: 'Dégagement',
    biens: ['appartement', 'maison', 'local'],
    parDefaut: {},
    elements: [...SOL_MURS_PLAFOND, ['Placard', 'menuiserie'], ...ELECTRICITE],
  },
  {
    cle: 'dressing',
    nom: 'Dressing',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [['Porte', 'menuiserie'], ...SOL_MURS_PLAFOND, ['Penderie / étagères', 'equipement'], ...ELECTRICITE],
  },
  {
    cle: 'buanderie',
    nom: 'Buanderie',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [['Porte', 'menuiserie'], ['Fenêtre(s)', 'menuiserie'], ...SOL_MURS_PLAFOND, ['Arrivée / évacuation lave-linge', 'plomberie', true], ...ELECTRICITE],
  },
  {
    cle: 'cellier',
    nom: 'Cellier',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [['Porte', 'menuiserie'], ...SOL_MURS_PLAFOND, ['Étagères', 'equipement'], ...ELECTRICITE],
  },
  {
    cle: 'veranda',
    nom: 'Véranda',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [['Baies / châssis vitrés', 'menuiserie'], ['Volets / stores', 'menuiserie', true], ['Sol', 'revetement'], ['Murs', 'revetement'], ['Toiture / plafond', 'revetement'], ...ELECTRICITE, ...CHAUFFAGE, CLIMATISATION],
  },
  {
    cle: 'terrasse',
    nom: 'Terrasse',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [
      ['Sol', 'exterieur'],
      ['Garde-corps', 'exterieur'],
      ['Murs / façade', 'exterieur'],
      ['Évacuation eaux pluviales', 'exterieur'],
      ['Prises extérieures', 'electricite', true, 'prises'],
      ['Éclairage extérieur', 'electricite', true, 'points_lumineux'],
    ],
  },
  {
    cle: 'balcon',
    nom: 'Balcon',
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
    elements: [['Porte', 'menuiserie'], ['Serrure / cadenas', 'menuiserie', true], ['Sol', 'revetement'], ['Murs', 'revetement'], ['Plafond', 'revetement'], INTERRUPTEURS, POINTS_LUMINEUX],
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
      ...ELECTRICITE,
    ],
  },
  {
    cle: 'parking',
    nom: 'Place de parking',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    elements: [
      ['Sol', 'exterieur'],
      ['Marquage / numéro de place', 'exterieur'],
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
      ['Chauffage', 'chauffage', true],
      CLIMATISATION,
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
      INTERRUPTEURS,
      POINTS_LUMINEUX,
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
      INTERRUPTEURS,
      POINTS_LUMINEUX,
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
  // Inventaire du mobilier (logement meublé) — liste minimale du décret n° 2015-981 du 31 juillet 2015
  {
    cle: 'mobilier',
    nom: 'Inventaire du mobilier',
    biens: ['appartement', 'maison'],
    parDefaut: {},
    special: true,
    elements: [
      ['Literie (couette ou couverture)', 'equipement'],
      ['Occultation des fenêtres des chambres', 'equipement', true],
      ['Plaques de cuisson', 'equipement', true],
      ['Four ou four à micro-ondes', 'equipement', true],
      ['Réfrigérateur avec compartiment congélation', 'equipement', true],
      ['Vaisselle (prise des repas)', 'equipement'],
      ['Ustensiles de cuisine', 'equipement'],
      ['Table', 'equipement'],
      ['Sièges', 'equipement'],
      ['Étagères de rangement', 'equipement'],
      ['Luminaires', 'electricite', true],
      ["Matériel d'entretien ménager", 'equipement'],
    ],
  },
]

export function modelesPour(bien: TypeBien): ModelePiece[] {
  return MODELES.filter((m) => m.biens.includes(bien) && !m.special)
}

export function modele(cle: string): ModelePiece | undefined {
  return MODELES.find((m) => m.cle === cle)
}

export function creerElement([libelle, categorie, equipement, genre]: Def): Element {
  const el: Element = { id: nouvelId(), libelle, categorie, equipement: !!equipement, observations: [], photoIds: [] }
  const g = genre ?? genreParLibelle(libelle)
  if (g) el.genre = g
  return el
}

/** Pièce personnalisée (nom libre) : reçoit toutes les rubriques de base. */
export function creerPieceLibre(nom: string): Piece {
  return { id: nouvelId(), modele: 'libre', nom, elements: RUBRIQUES_BASE.map(creerElement), photoIds: [] }
}

/** Copie vide d'un élément (même nature, sans aucune constatation), pour dupliquer une pièce. */
export function copieVierge(el: Element): Element {
  const c: Element = { id: nouvelId(), libelle: el.libelle, categorie: el.categorie, equipement: el.equipement, nature: el.nature, observations: [], photoIds: [] }
  const g = genreDe(el)
  if (g) c.genre = g
  return c
}

/**
 * Reporte un nombre connu à l'avance (fiche du bien) : il est marqué « à vérifier ».
 * Climatisation : autant d'unités vierges que d'unités connues.
 */
export function prerenseignerNombre(el: Element, n: number, source: 'fiche' | 'entree'): void {
  el.quantite = n
  el.quantiteSource = source
  if (genreDe(el) === 'climatisation') el.unites = n > 0 ? Array.from({ length: n }, uniteVierge) : undefined
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

/** Crée la pièce « Inventaire du mobilier » (logement meublé). */
export function creerInventaire(): Piece {
  const m = modele('mobilier')!
  return { id: nouvelId(), modele: m.cle, nom: m.nom, elements: m.elements.map(creerElement), photoIds: [] }
}

/**
 * Crée les pièces d'un état des lieux à partir de la composition d'un bien du patrimoine.
 * Les équipements connus sont ajoutés (ou remplacent l'élément équivalent du modèle),
 * SANS état : ils restent à vérifier lors de la visite.
 */
export function creerPiecesDepuisBien(compo: PieceBien[]): Piece[] {
  const parModele = new Map<string, number>()
  for (const p of compo) parModele.set(p.modele, (parModele.get(p.modele) ?? 0) + 1)
  return compo.map((p) => {
    // Pièce personnalisée : rubriques de base.
    const m = p.modele === 'libre' ? { cle: 'libre', nom: p.nom, elements: RUBRIQUES_BASE } : (modele(p.modele) ?? modele('sejour')!)
    const elements = m.elements.map(creerElement)
    for (const eq of p.equipements ?? []) {
      const nouveau: Element = {
        ...creerElement([eq.libelle, eq.categorie ?? 'equipement', true]),
        commentaire: eq.note,
      }
      let i = eq.remplace ? elements.findIndex((e) => e.libelle.toLowerCase() === eq.remplace!.toLowerCase()) : -1
      // Élément compté connu (ex. « Climatisation réversible ») : remplace l'élément du même genre, sans doublon.
      if (i < 0 && nouveau.genre) i = elements.findIndex((e) => genreDe(e) === nouveau.genre)
      if (i >= 0) {
        const g = nouveau.genre ?? elements[i].genre
        elements[i] = { ...nouveau, categorie: eq.categorie ?? elements[i].categorie, ...(g ? { genre: g } : {}) }
      }
      else if (!elements.some((e) => e.libelle.toLowerCase() === eq.libelle.toLowerCase())) elements.push(nouveau)
    }
    // Nombres connus (prises, interrupteurs, points lumineux, climatisations) : à vérifier sur place.
    for (const [genre, n] of Object.entries(p.quantites ?? {}) as [GenreElement, number][]) {
      if (n === undefined) continue
      let el = elements.find((e) => genreDe(e) === genre)
      if (!el) {
        const def = ELEMENTS_COMPTES.find((d) => d[3] === genre)!
        el = creerElement(def)
        elements.push(el)
      }
      prerenseignerNombre(el, n, 'fiche')
    }
    return { id: nouvelId(), modele: m.cle, nom: p.nom || m.nom, elements, photoIds: [] }
  })
}
