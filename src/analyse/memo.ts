import type { Element, Etat, Fonctionnement, Piece } from '../db/types'

/* ------------------------------------------------------------------
   Analyse d'un mémo vocal de pièce, 100 % sur la tablette.
   Le texte dicté est découpé en propositions ; dans chacune on repère :
     - l'élément concerné (mur, sol, prise, robinet…),
     - la localisation (mur est, côté fenêtre, partie basse…),
     - l'état (neuf, bon, usé, abîmé, hors service…),
     - les observations (trous, vis, traces, fissures, arraché…),
     - le fonctionnement et le nombre de trous de chevilles.
   Le contexte se poursuit d'une phrase à l'autre :
     « Sur le mur est, il y a des trous. Il reste aussi des vis. »
   Rien n'est appliqué sans validation : l'écran de contrôle montre
   chaque proposition, que l'on peut décocher.
   ------------------------------------------------------------------ */

export interface Proposition {
  elementId: string
  libelle: string
  etat?: Etat
  /** true si l'état n'a pas été dit mais déduit des observations. */
  etatDeduit?: boolean
  observations: string[]
  localisation?: string
  trousChevilles?: number
  fonctionnement?: Fonctionnement
  aNettoyer?: boolean
  /** Extraits du mémo à l'origine de la proposition (repris en commentaire). */
  extraits: string[]
}

export interface Analyse {
  propositions: Proposition[]
  /** État général (« la pièce est en bon état ») appliqué aux éléments non cités et non renseignés. */
  etatGeneral?: Etat
  /** Nombre d'éléments qui recevront l'état général. */
  nbEtatGeneral: number
  /** Passages non rattachés à un élément : versés au commentaire de la pièce. */
  commentairePiece: string[]
}

// --- Normalisation ----------------------------------------------------

/** Minuscules, sans accents, apostrophes et tirets en espaces. */
export function normaliser(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MOTS_VIDES = new Set(['de', 'd', 'du', 'des', 'la', 'le', 'les', 'l', 'et', 'ou', 'a', 'au', 'aux', 'en', 'un', 'une', 'avec', 'sur', 'points', 'point'])

/** Racine grossière : retire le pluriel. */
const racine = (m: string) => (m.length > 3 ? m.replace(/(s|x)$/, '') : m)

// Synonymes à l'oral pour les mots-clés des éléments (racines normalisées).
const SYNONYMES: Record<string, string[]> = {
  mur: ['mur', 'paroi', 'cloison', 'bardage'],
  sol: ['sol', 'parquet', 'plancher', 'moquette', 'lino', 'dallage', 'carrelage au sol', 'carrelage du sol', 'revetement de sol'],
  dallage: ['dallage', 'sol', 'dalle'],
  plafond: ['plafond', 'faux plafond'],
  plinthe: ['plinthe'],
  porte: ['porte'],
  fenetre: ['fenetre', 'baie', 'vitre', 'vitrage', 'carreau', 'porte fenetre', 'chassis'],
  volet: ['volet', 'store', 'persienne'],
  prise: ['prise'],
  interrupteur: ['interrupteur', 'bouton d eclairage'],
  eclairage: ['eclairage', 'lumiere', 'plafonnier', 'luminaire', 'spot', 'ampoule', 'applique', 'neon', 'douille'],
  radiateur: ['radiateur', 'chauffage', 'convecteur'],
  placard: ['placard', 'penderie', 'rangement'],
  serrure: ['serrure', 'verrou', 'cylindre', 'barillet'],
  sonnette: ['sonnette', 'interphone', 'visiophone'],
  tableau: ['tableau electrique', 'disjoncteur', 'tableau'],
  credence: ['credence'],
  plan: ['plan de travail'],
  meuble: ['meuble', 'element de cuisine', 'caisson'],
  haut: ['haut'],
  bas: ['bas'],
  evier: ['evier'],
  robinetterie: ['robinet', 'robinetterie', 'mitigeur', 'melangeur'],
  plaque: ['plaque', 'table de cuisson', 'induction', 'vitroceramique', 'gaziniere', 'feux'],
  hotte: ['hotte'],
  four: ['four', 'micro onde'],
  vmc: ['vmc', 'aeration', 'ventilation', 'bouche d aeration'],
  faience: ['faience', 'carrelage mural', 'carrelage des murs'],
  baignoire: ['baignoire', 'douche', 'receveur', 'bac a douche'],
  rideau: ['pare douche', 'paroi de douche', 'rideau de douche'],
  lavabo: ['lavabo', 'vasque'],
  miroir: ['miroir', 'glace'],
  seche: ['seche serviette'],
  chauffe: ['chauffe eau', 'ballon', 'cumulus'],
  cuvette: ['cuvette', 'abattant', 'lunette', 'wc', 'toilette', 'cuvette'],
  chasse: ['chasse d eau', 'chasse', 'reservoir'],
  lave: ['lave main'],
  garde: ['garde corps', 'rambarde', 'balustrade'],
  gouttiere: ['gouttiere', 'descente', 'cheneau'],
  portail: ['portail', 'portillon'],
  cloture: ['cloture', 'grillage'],
  rack: ['rack', 'rayonnage', 'etagere'],
  niveleur: ['niveleur'],
  extincteur: ['extincteur'],
  detecteur: ['detecteur'],
  literie: ['literie', 'lit', 'matelas', 'couette', 'couverture'],
  vaisselle: ['vaisselle', 'assiette', 'verre', 'couvert'],
  table: ['table'],
  siege: ['siege', 'chaise', 'tabouret', 'fauteuil', 'canape'],
  refrigerateur: ['refrigerateur', 'frigo', 'congelateur', 'freezer'],
}

// Mots trop génériques pour désigner un élément à eux seuls.
const MOTS_FAIBLES = new Set(['electrique', 'lumineux', 'exterieur', 'interieur', 'general', 'entree', 'cuisine', 'principale', 'vue', 'partie', 'visible', 'tgbt', 'eau', 'serviette'])

/** Expression régulière « mot entier, pluriel facultatif ». */
function regexMot(expr: string): RegExp {
  const motif = expr
    .split(' ')
    .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:s|x|es)?')
    .join(' ')
  return new RegExp(`(?:^|\\s)${motif}(?=\\s|$)`)
}

interface CleElement {
  element: Element
  cles: { cle: string; regex: RegExp[] }[]
}

function preparerElements(piece: Piece): CleElement[] {
  return piece.elements.map((element) => {
    const mots = normaliser(element.libelle)
      .split(/[^a-z0-9]+/)
      .filter((m) => m && !MOTS_VIDES.has(m))
      .map(racine)
    const cles = [...new Set(mots)]
      .filter((m) => !MOTS_FAIBLES.has(m) || mots.length === 1)
      .map((cle) => {
        const expressions = SYNONYMES[cle] ?? [cle]
        return { cle, regex: [...new Set([cle, ...expressions])].map(regexMot) }
      })
    return { element, cles }
  })
}

/** Expressions de lieu (« côté fenêtre », « derrière la porte ») : la fenêtre ou la porte n'y sont qu'un repère. */
const REPERES = /(cote|sous|pres|autour|derriere|devant|a cote|au dessus|au dessous|en dessous|au niveau|le long) (de |du |d )?(la |le |l )?(fenetre|porte|radiateur|placard|lavabo|evier|interrupteur|prise)s?(?=\s|$)/g

/** Éléments cités dans la proposition (les éléments « dominés » par un autre plus précis sont écartés). */
function elementsCites(texteComplet: string, elements: CleElement[]): Element[] {
  const texte = texteComplet.replace(REPERES, ' ')
  const touches = elements
    .map((e) => ({ e, hits: new Set(e.cles.filter((c) => c.regex.some((r) => r.test(texte))).map((c) => c.cle)) }))
    .filter((t) => t.hits.size > 0)
  return touches
    .filter(
      (t) =>
        !touches.some(
          (autre) =>
            autre !== t &&
            autre.hits.size > t.hits.size &&
            [...t.hits].every((h) => autre.hits.has(h)),
        ),
    )
    // Si un même mot désigne plusieurs éléments à égalité, on prend le plus précis (libellé le plus court).
    .filter((t, _, liste) => {
      const memes = liste.filter((x) => x.hits.size === t.hits.size && [...x.hits].every((h) => t.hits.has(h)))
      if (memes.length <= 1) return true
      const plusCourt = memes.reduce((a, b) => (a.e.element.libelle.length <= b.e.element.libelle.length ? a : b))
      return plusCourt === t
    })
    .map((t) => t.e.element)
}

// --- Localisation -----------------------------------------------------

const DIRECTIONS: Record<string, string> = { nord: 'nord', sud: 'sud', est: 'est', ouest: 'ouest' }

function localisation(t: string): string | undefined {
  // « mur est » : orientation seulement si ce n'est pas le verbe être (« le mur est abîmé »).
  const orient = t.match(/(?:mur|cote|paroi|facade)(?: de l| du| de la| a l| cote)? (nord|sud|ouest|est)(?=\s|$)/)
  if (orient) {
    const dir = orient[1]
    const apres = t.slice((orient.index ?? 0) + orient[0].length).trim()
    const avant = t.slice(0, orient.index ?? 0)
    const verbe = dir === 'est' && apres && !/^(il|on|y|avec|presente|comporte|:|,|$)/.test(apres) && !/(sur|au|du|cote|le long du|contre)( le| la)? $/.test(avant + ' ')
    if (!verbe) return `${/facade/.test(orient[0]) ? 'Façade' : 'Mur'} ${DIRECTIONS[dir]}`
  }
  if (/mur (de )?gauche|a gauche|cote gauche/.test(t)) return 'Mur gauche'
  if (/mur (de )?droit|a droite|cote droit/.test(t)) return 'Mur droit'
  if (/mur (du )?fond|mur (d )?en face|face a l entree/.test(t)) return 'Mur face'
  if (/mur (d )?entree|cote (de la )?porte|derriere la porte/.test(t)) return "Mur d'entrée"
  if (/cote (de la )?fenetre|sous la fenetre|autour de la fenetre/.test(t)) return 'Côté fenêtre'
  if (/partie haute|en haut/.test(t)) return 'Partie haute'
  if (/partie basse|en bas/.test(t)) return 'Partie basse'
  if (/\bangle\b|\bcoin\b/.test(t)) return 'Angle'
  if (/au centre|au milieu/.test(t)) return 'Au centre'
  return undefined
}

// --- État ---------------------------------------------------------------

const REGLES_ETAT: [RegExp, Etat][] = [
  [/hors service|ne fonctionne (pas|plus)|ne marche (pas|plus)|en panne|\bhs\b|inutilisable/, 'hs'],
  [/pas en bon etat|pas bon|mauvais etat|en mauvais|tres abime|tres use|abime|degrade|endommage|deteriore|delabre/, 'mauvais'],
  [/tres bon etat|parfait etat|excellent etat|impeccable|comme neu|etat parfait/, 'tres_bon'],
  [/(^|\s)neu(f|ve|fs|ves)(\s|$)|refait a neuf|recemment refait|jamais servi/, 'neuf'],
  [/etat d usage|(^|\s)use(e|es|s)?(\s|$)|usage|vetuste|fatigue|etat moyen|moyen etat|defraichi/, 'use'],
  [/bon etat|etat correct|(^|\s)correct(e|es|s)?(\s|$)|rien a signaler|(^|\s)ras(\s|$)|nickel|en etat|(^|\s)propre(s)?(\s|$)/, 'bon'],
  [/(^|\s)absent(e|es|s)?(\s|$)|inexistant/, 'absent'],
]

function etatDit(t: string): Etat | undefined {
  // « usage normal » = bon état dans la grille.
  if (/usage normal/.test(t)) return 'bon'
  return REGLES_ETAT.find(([r]) => r.test(t))?.[1]
}

// --- Observations -------------------------------------------------------

const REGLES_OBS: [RegExp, string][] = [
  [/(^|\s)trous?(\s|$)|perce|percage/, 'Trous'],
  [/(^|\s)vis(\s|$)|cheville|(^|\s)clous?(\s|$)|crochet|piton/, 'Vis / chevilles restantes'],
  [/rayur|(^|\s)raye(e|es|s)?(\s|$)|griffure/, 'Rayures'],
  [/(^|\s)tache|tachee|aureole/, 'Taches'],
  [/fissur|felure|fele|lezard/, 'Fissures'],
  [/eclat|ebrech|epaufr/, 'Éclats'],
  [/impact|(^|\s)choc|enfonc|bosse/, 'Impacts'],
  [/(^|\s)traces?(\s|$)|marque|salissure|frottement/, 'Traces'],
  [/usure|elime|patine/, 'Usure'],
  [/decoll|se decolle/, 'Décollement'],
  [/ecaill|cloque|boursoufl/, 'Peinture écaillée'],
  [/humid|infiltr|degat des eaux|remontee/, 'Humidité'],
  [/moisi|champignon|noirci/, 'Moisissures'],
  [/jauni|nicotine/, 'Jaunissement'],
  [/(^|\s)joints?(\s|$)/, 'Joint abîmé'],
  [/fuite|goutte|(^|\s)fuit(\s|$)/, 'Fuite'],
  [/(^|\s)cass|brise|fendu|fendue/, 'Cassé'],
  [/deform|tordu|voile|gondol|affaiss/, 'Déformé'],
  [/manqu|disparu/, 'Manquant'],
  [/ferme mal|ne ferme (pas|plus)|bloque|coince|frotte/, 'Ne ferme pas'],
  [/(^|\s)sales?(\s|$)|encrass|poussier|crasse|graisse|calcaire|tartre/, 'Sale'],
  [/arrach/, 'Arraché'],
]

/** Observations graves : l'état déduit est « mauvais » plutôt que « usé ». */
const OBS_GRAVES = new Set(['Cassé', 'Arraché', 'Fuite', 'Moisissures', 'Humidité', 'Fissures'])

const NEGATION = /(pas|aucun|aucune|sans|ni|plus) (de |d |d aucune? )?(\S+ ){0,2}$/

function observations(t: string): string[] {
  const res: string[] = []
  for (const [r, obs] of REGLES_OBS) {
    const m = r.exec(t)
    if (!m) continue
    const avant = t.slice(Math.max(0, m.index - 30), m.index + (m[1]?.length ?? 0))
    if (NEGATION.test(avant.trimEnd() + ' ')) continue
    res.push(obs)
  }
  return res
}

const NOMBRES: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, quelques: 3, plusieurs: 3 }

function nombreTrous(t: string): number | undefined {
  const m = t.match(/(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|quelques|plusieurs) (trous?|chevilles?|vis)(?=\s|$)/)
  if (!m) return undefined
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NOMBRES[m[1]]
  return n || undefined
}

function fonctionnement(t: string): Fonctionnement | undefined {
  if (/ne (fonctionne|marche)|en panne|hors service|(^|\s)hs(\s|$)|defaillant/.test(t)) return 'defaillant'
  if (/fonctionne|marche|teste(e|s)? ok|en etat de marche|ok/.test(t)) return 'ok'
  return undefined
}

// --- Découpage ----------------------------------------------------------

const MOTS_PIECE = /(^|\s)(piece|ensemble|general|generale|globalement|tout|reste|chambre|cuisine|salon|sejour|salle|entree|couloir|local|bureau|zone)(\s|$)/

function decouper(memo: string): { brut: string; texte: string }[] {
  return memo
    .split(/[.;!?\n]+|,\s*|\s+(?:puis|ensuite|par contre|en revanche|mais|sinon|par ailleurs)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .map((brut) => ({ brut, texte: normaliser(brut) }))
}

// --- Analyse --------------------------------------------------------------

export function analyserMemo(memo: string, piece: Piece): Analyse {
  const elements = preparerElements(piece)
  const props = new Map<string, Proposition>()
  const commentairePiece: string[] = []
  let contexte: Element[] = []
  let contexteLoc: string | undefined
  /** Début de phrase qui a posé le contexte (« Sur le mur est »), repris dans le commentaire. */
  let prefixe: string | undefined
  let etatGeneral: Etat | undefined

  for (const { brut, texte } of decouper(memo)) {
    const cites = elementsCites(texte, elements)
    const loc = localisation(texte)
    const etat = etatDit(texte)
    const obs = observations(texte)
    const nb = nombreTrous(texte)
    const fonct = fonctionnement(texte)
    const contenu = !!(etat || obs.length || nb || fonct)

    // « Les murs » cités avec une orientation : la localisation vise les murs.
    if (cites.length) {
      contexte = cites
      contexteLoc = loc
      prefixe = contenu ? undefined : brut
    } else if (loc) {
      contexteLoc = loc
      prefixe = contenu ? undefined : brut
      const murs = piece.elements.find((e) => /^mur/i.test(normaliser(e.libelle)))
      if (/^Mur|^Façade/.test(loc) && murs) contexte = [murs]
    }

    // Phrase générale sur la pièce, sans élément : état général.
    if (!cites.length && etat && !obs.length && (MOTS_PIECE.test(texte) || contexte.length === 0)) {
      etatGeneral = etat
      continue
    }

    const cibles = cites.length ? cites : contenu ? contexte : []
    if (!cibles.length) {
      // Rien de reconnu : la phrase est conservée dans le commentaire de la pièce (rien ne se perd).
      if (contenu || !loc) commentairePiece.push(brut)
      continue
    }
    if (!contenu) continue

    for (const el of cibles) {
      const p = props.get(el.id) ?? { elementId: el.id, libelle: el.libelle, observations: [], extraits: [] }
      if (etat) {
        p.etat = etat
        p.etatDeduit = false
      }
      for (const o of obs) if (!p.observations.includes(o)) p.observations.push(o)
      if (obs.includes('Sale')) p.aNettoyer = true
      if (nb && (obs.includes('Vis / chevilles restantes') || obs.includes('Trous'))) p.trousChevilles = (p.trousChevilles ?? 0) + nb
      else if (obs.includes('Vis / chevilles restantes') || (obs.includes('Trous') && /cheville|vis/.test(texte))) p.trousChevilles ??= undefined
      if (fonct && el.equipement) p.fonctionnement = fonct
      if (fonct === 'defaillant' && !p.etat) p.etat = 'hs'
      p.localisation ??= loc ?? contexteLoc
      const extrait = !cites.length && prefixe ? `${prefixe}, ${brut}` : brut
      if (!p.extraits.includes(extrait)) p.extraits.push(extrait)
      props.set(el.id, p)
    }
  }

  // État déduit des observations quand il n'a pas été dit.
  for (const p of props.values()) {
    if (!p.etat && p.observations.length) {
      p.etat = p.observations.some((o) => OBS_GRAVES.has(o)) ? 'mauvais' : 'use'
      p.etatDeduit = true
    }
    if (!p.etat && p.fonctionnement === 'ok') {
      p.etat = 'bon'
      p.etatDeduit = true
    }
  }

  const nbEtatGeneral = etatGeneral ? piece.elements.filter((e) => !e.etat && !props.has(e.id)).length : 0
  return { propositions: [...props.values()], etatGeneral, nbEtatGeneral, commentairePiece }
}

/** Applique les propositions retenues à la pièce (sans écraser les saisies manuelles plus précises). */
export function appliquerAnalyse(piece: Piece, a: Analyse, retenues: Set<string>, appliquerGeneral: boolean): void {
  for (const p of a.propositions) {
    if (!retenues.has(p.elementId)) continue
    const el = piece.elements.find((e) => e.id === p.elementId)
    if (!el) continue
    if (p.etat) el.etat = p.etat
    for (const o of p.observations) if (!el.observations.includes(o)) el.observations.push(o)
    if (p.localisation && !el.localisation) el.localisation = p.localisation
    if (p.trousChevilles) el.trousChevilles = p.trousChevilles
    if (p.fonctionnement && el.equipement) el.fonctionnement = p.fonctionnement
    if (p.aNettoyer) el.aNettoyer = true
    const extrait = p.extraits.join(' — ')
    if (extrait && !el.commentaire?.includes(extrait)) el.commentaire = el.commentaire ? `${el.commentaire} ${extrait}` : extrait
  }
  if (appliquerGeneral && a.etatGeneral) {
    const cites = new Set(a.propositions.map((p) => p.elementId))
    for (const el of piece.elements) if (!el.etat && !cites.has(el.id)) el.etat = a.etatGeneral
  }
  if (a.commentairePiece.length) {
    const txt = a.commentairePiece.join('. ')
    if (!piece.commentaire?.includes(txt)) piece.commentaire = piece.commentaire ? `${piece.commentaire} ${txt}` : txt
  }
}
