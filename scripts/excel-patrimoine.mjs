// Fabrique le classeur Excel « Patrimoine » à partir d'un fichier de patrimoine (JSON) :
//   node scripts/excel-patrimoine.mjs "EDL patrimoine/patrimoine-opera.json" "EDL patrimoine/Patrimoine.xlsx"
//
// Feuille 1 « Patrimoine » : exactement les colonnes de l'import Excel de l'application
// (réimport sans doublon grâce à la colonne « Identifiant unique »), plus deux colonnes d'aide.
// Feuille 2 « Pièces » : composition détaillée (lecture seule).
// Feuille 3 « Mode d'emploi ».

import fs from 'node:fs'
import writeXlsxFile from 'write-excel-file/node'
import { CHAMPS } from '../src/patrimoine/importExcel.ts'
import { BIENS_INTEGRES } from '../src/patrimoine/biensIntegres.ts'

const [source, cible] = process.argv.slice(2)
const contenu = JSON.parse(fs.readFileSync(source, 'utf8'))
const biens = [...BIENS_INTEGRES.filter((b) => !contenu.biens.some((x) => x.id === b.id)), ...contenu.biens].sort(
  (a, b) => a.ville.localeCompare(b.ville, 'fr') || (a.residence ?? a.adresse).localeCompare(b.residence ?? b.adresse, 'fr', { numeric: true }) || (a.reference ?? '').localeCompare(b.reference ?? '', 'fr', { numeric: true }),
)

// Mêmes libellés que l'application (src/db/patrimoine.ts).
const LIBELLE_CATEGORIE = { appartement: 'Appartement', villa: 'Villa', maison: 'Maison', immeuble: 'Immeuble', entrepot: 'Entrepôt', local_commercial: 'Local commercial', mobil_home: 'Mobil-home', autre: 'Autre' }
const COMPTEURS = { electricite: 'électricité', eau_froide: 'eau', eau_chaude: 'eau chaude', gaz: 'gaz', autre: 'autre' }
const valeur = (b, cle) => {
  switch (cle) {
    case 'identifiantExterne':
      return b.identifiantExterne || b.id
    case 'categorie':
      return LIBELLE_CATEGORIE[b.categorie]
    case 'annexes':
      return b.annexes.join(', ')
    case 'equipements':
      return b.equipements.join(', ')
    case 'compteurs':
      return b.compteurs.map((c) => COMPTEURS[c]).join(', ')
    case 'meuble':
      return b.meuble === undefined ? '' : b.meuble ? 'oui' : 'non'
    default:
      return b[cle]
  }
}

const BLEU = '#26458F'
const entete = (v) => ({ value: v, fontWeight: 'bold', color: '#FFFFFF', backgroundColor: BLEU, wrap: true, alignVertical: 'center', height: 32 })
const aide = (v) => ({ value: v, fontWeight: 'bold', color: '#FFFFFF', backgroundColor: '#CA9440', wrap: true, alignVertical: 'center' })
const cel = (v, opts = {}) => (v === undefined || v === null || v === '' ? null : { value: typeof v === 'number' ? v : String(v), alignVertical: 'top', ...opts })
const NOMBRES = new Set(['chambres', 'sallesEau', 'wc'])

// Points à vérifier (aide, non importée).
const aVerifier = (b) => {
  const memes = biens.filter((x) => x !== b && x.adresse === b.adresse && x.ville === b.ville)
  const r = []
  if (!b.lot && memes.length) r.push(`${memes.length + 1} logements à cette adresse : indiquer le lot ou la porte`)
  if (b.categorie !== 'appartement' && b.identifiantExterne?.startsWith('opera-')) r.push('catégorie (maison / villa) déduite : à confirmer')
  return r.filter(Boolean).join(' ; ')
}
const origine = (b) => (b.infos ?? '').split('\n')[0].replace(/^Fiche établie d'après /, '').replace(/\. Composition.*$/, '') || 'Fiche intégrée à l’application'

const feuille1 = [
  [...CHAMPS.map((c) => entete(c.libelle)), aide('Origine de la fiche (non importé)'), aide('À vérifier (non importé)')],
  ...biens.map((b) => [
    ...CHAMPS.map((c) => {
      const v = valeur(b, c.cle)
      if (NOMBRES.has(c.cle) && v !== undefined) return cel(Number(v), { type: Number })
      return cel(v, c.cle === 'infos' || c.cle === 'equipements' ? { wrap: true } : {})
    }),
    cel(origine(b), { wrap: true, color: '#606876' }),
    cel(aVerifier(b), { wrap: true, color: '#B3261E' }),
  ]),
]
const largeur = { identifiantExterne: 30, reference: 30, adresse: 32, societe: 24, residence: 32, equipements: 42, infos: 70, annexes: 20, ville: 18, typologie: 10, codePostal: 10, lot: 8, etage: 16, surface: 10, nbPieces: 10, chambres: 10, sallesEau: 10, wc: 6, meuble: 9, compteurs: 18, categorie: 14, batiment: 10, porte: 10, complement: 20 }
const colonnes1 = [...CHAMPS.map((c) => ({ width: largeur[c.cle] ?? 14 })), { width: 40 }, { width: 44 }]

const GENRES = { prises: 'Prises', interrupteurs: 'Interrupteurs', points_lumineux: 'Points lumineux', climatisation: 'Climatisations' }
const feuille2 = [
  ['Identifiant unique', 'Ville', 'Adresse', 'Référence', 'Pièce', 'Prises', 'Interrupteurs', 'Points lumineux', 'Climatisations', 'Équipements connus'].map(entete),
  ...biens.flatMap((b) =>
    b.pieces.map((p) => [
      cel(b.identifiantExterne || b.id),
      cel(b.ville),
      cel(b.adresse),
      cel(b.reference),
      cel(p.nom, { fontWeight: 'bold' }),
      ...Object.keys(GENRES).map((g) => (p.quantites?.[g] !== undefined ? cel(p.quantites[g], { type: Number }) : null)),
      cel((p.equipements ?? []).map((e) => e.libelle).join(', '), { wrap: true }),
    ]),
  ),
]
const colonnes2 = [{ width: 30 }, { width: 18 }, { width: 32 }, { width: 30 }, { width: 34 }, { width: 9 }, { width: 13 }, { width: 15 }, { width: 14 }, { width: 60 }]

const texte = (v, opts = {}) => [{ value: v, wrap: true, ...opts }]
const feuille3 = [
  texte('Patrimoine du Groupe Brenguier — mode d’emploi', { fontWeight: 'bold', fontSize: 14, color: BLEU }),
  texte(`${biens.length} biens, au ${new Date().toLocaleDateString('fr-FR')}. Fiches établies d’après les états des lieux d’entrée Opéra Groupe (composition et nombres à vérifier lors de la prochaine visite).`),
  texte(''),
  texte('Ajouter un bien', { fontWeight: 'bold' }),
  texte('Ajoutez une ligne en bas de la feuille « Patrimoine ». Laissez « Identifiant unique » vide : il sera créé automatiquement. Obligatoire : Adresse et Ville ; conseillé : Code postal, Type de bien, Typologie, Étage, Surface, Nombre de chambres, Salles d’eau, WC, Annexes, Compteurs à relever.'),
  texte('Modifier un bien', { fontWeight: 'bold' }),
  texte('Corrigez directement la cellule (par exemple : ajouter le N° de lot ou le N° de porte). Ne modifiez jamais la colonne « Identifiant unique » : c’est elle qui relie la ligne à la fiche déjà enregistrée.'),
  texte('Mettre à jour l’application', { fontWeight: 'bold' }),
  texte('Envoyez-moi le fichier modifié (ou importez-le sur la tablette : Patrimoine → Importer depuis Excel). Les biens existants sont mis à jour sur les seules colonnes renseignées (une cellule vide n’efface rien), les nouveaux sont créés, sans doublon. La composition détaillée des pièces (feuille « Pièces ») n’est pas modifiée par l’import.'),
  texte('Valeurs attendues', { fontWeight: 'bold' }),
  texte('Type de bien : Appartement, Maison, Villa, Immeuble, Entrepôt, Local commercial, Mobil-home, Autre. Meublé : oui / non. Compteurs à relever : eau, électricité, gaz, eau chaude (séparés par des virgules). Annexes : Cave, Parking, Box / garage, Terrasse, Jardin…'),
  texte('Confidentialité', { fontWeight: 'bold' }),
  texte('Ce fichier contient des digicodes et des numéros de compteurs : ne le diffusez pas en dehors du Groupe. Il ne contient aucune donnée de locataire.'),
]

await writeXlsxFile([
  { data: feuille1, sheet: 'Patrimoine', columns: colonnes1, stickyRowsCount: 1 },
  { data: feuille2, sheet: 'Pièces', columns: colonnes2, stickyRowsCount: 1 },
  { data: feuille3, sheet: 'Mode d’emploi', columns: [{ width: 110 }] },
]).toFile(cible)
console.log(`${cible} : ${biens.length} biens, ${feuille2.length - 1} pièces.`)
