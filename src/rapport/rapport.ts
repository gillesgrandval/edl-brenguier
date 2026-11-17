/* ------------------------------------------------------------------
   Rapport PDF de l'état des lieux, fabriqué sur la tablette (hors ligne).

   Contenu :
   1. Page de garde : bien, parties, énergies, légende des états
   2. Compteurs, clés, détecteur de fumée
   3. Pièce par pièce : tableau des éléments (état en couleur, n° de photos)
   4. Observations, remarques du locataire
   5. Signatures, mentions légales, empreinte SHA-256
   6. Annexe : toutes les photos numérotées

   Tant que l'état des lieux n'est pas signé, chaque page porte la mention « PROJET ».
   ------------------------------------------------------------------ */

import { jsPDF } from 'jspdf'
import { autoTable, type CellHookData, type RowInput } from 'jspdf-autotable'
import { db } from '../db/base'
import { normaliser } from '../db/edl'
import { empreinteLisible } from '../db/cloture'
import type { Edl, Element, Photo } from '../db/types'
import { ETATS, LIBELLE_BIEN, formatDate } from '../libelles'
// Charte Groupe Brenguier : logo et police de texte Nunito (licence libre OFL).
import logoSignature from './ressources/logo-signature-bleu.png?inline'
import logoIcone from './ressources/logo-icone-bleu.png?inline'
import nunitoRegular from './ressources/Nunito-Regular.ttf?inline'
import nunitoBold from './ressources/Nunito-Bold.ttf?inline'
import nunitoItalic from './ressources/Nunito-Italic.ttf?inline'

// --- Charte Groupe Brenguier -------------------------------------------
const BLEU: [number, number, number] = [38, 69, 143] // #26458F, couleur dominante
const OR: [number, number, number] = [202, 148, 64] // #CA9440, couleur dominante
const ENCRE: [number, number, number] = [28, 30, 38] // texte courant
const GRIS: [number, number, number] = [96, 104, 118]
const TRAIT: [number, number, number] = [226, 225, 222]
const FOND: [number, number, number] = [244, 243, 242] // #F4F3F2
const COULEUR_ETAT: Record<string, [number, number, number]> = {
  neuf: [46, 125, 91],
  tres_bon: [79, 157, 105],
  bon: [143, 176, 74],
  use: [224, 165, 38],
  mauvais: [217, 98, 43],
  hs: [179, 38, 30],
  absent: [138, 148, 160],
}

const L = 210 // largeur A4 (mm)
const H = 297
const M = 15 // marge
const LU = L - 2 * M // largeur utile
const HAUT = 24 // début du contenu (sous l'en-tête)
const BAS = H - 18 // fin du contenu (au-dessus du pied de page)

/**
 * Les polices standard du PDF ne connaissent que l'alphabet latin courant :
 * on remplace les quelques signes typographiques qu'elles ne savent pas afficher.
 */
export function t(s: string | undefined | null): string {
  return (s ?? '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[–—]/g, '-')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/€/g, 'EUR')
    .replace(/[   ]/g, ' ')
    .replace(/[^\x09\x0a\x0d\x20-\x7e -ÿ]/g, '')
}

const TITRE_ACTE: Record<Edl['typeActe'], string> = {
  entree: "État des lieux d'entrée",
  sortie: 'État des lieux de sortie',
  pre: 'Pré-état des lieux',
}

const FONCTIONNEMENT: Record<string, string> = { ok: 'OK', defaillant: 'Défaillant', non_teste: 'Non testé' }

/** Image réduite pour le PDF (poids raisonnable même avec 100 photos). */
async function versJpeg(image: Blob, max = 1200): Promise<{ data: string; l: number; h: number }> {
  const bmp = await createImageBitmap(image)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const r = { data: c.toDataURL('image/jpeg', 0.78), l: c.width, h: c.height }
  c.width = c.height = 0
  return r
}

/** Signature recadrée sur le tracé (le pavé de saisie est bien plus grand que la signature). */
async function versPng(image: Blob): Promise<{ data: string; l: number; h: number }> {
  const bmp = await createImageBitmap(image)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) return { data: c.toDataURL('image/png'), l: c.width, h: c.height }
  const m = 8
  x0 = Math.max(0, x0 - m)
  y0 = Math.max(0, y0 - m)
  const l = Math.min(c.width, x1 + m) - x0, h = Math.min(c.height, y1 + m) - y0
  const r = document.createElement('canvas')
  r.width = l
  r.height = h
  r.getContext('2d')!.drawImage(c, x0, y0, l, h, 0, 0, l, h)
  return { data: r.toDataURL('image/png'), l, h }
}

export interface Avancement {
  (etape: string, fait?: number, total?: number): void
}

export async function genererRapport(source: Edl, avancement: Avancement = () => {}): Promise<Blob> {
  const edl = normaliser(source)
  const signe = edl.statut === 'signe' && !!edl.cloture
  const photos = await db.photos.where('edlId').equals(edl.id).sortBy('numero')
  const numero = new Map(photos.map((p) => [p.id, p.numero]))
  const nums = (ids: string[] | undefined) =>
    (ids ?? [])
      .map((id) => numero.get(id))
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b)
      .join(', ')
  const preneur = edl.typeBien === 'local' ? 'preneur' : 'locataire'

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const brut = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1)
  for (const [fichier, donnees, style] of [
    ['Nunito-Regular.ttf', nunitoRegular, 'normal'],
    ['Nunito-Bold.ttf', nunitoBold, 'bold'],
    ['Nunito-Italic.ttf', nunitoItalic, 'italic'],
  ] as const) {
    doc.addFileToVFS(fichier, brut(donnees))
    doc.addFont(fichier, 'Nunito', style)
  }
  doc.setProperties({ title: t(`${edl.reference} - ${TITRE_ACTE[edl.typeActe]}`), author: 'Groupe Brenguier', creator: `EDL Brenguier ${__APP_VERSION__}` })
  let y = HAUT

  // --- Outils de mise en page ---------------------------------------
  const finTableau = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const place = (h: number) => {
    if (y + h > BAS) {
      doc.addPage()
      y = HAUT
    }
  }
  const police = (taille: number, style: 'normal' | 'bold' | 'italic' = 'normal', famille: 'Nunito' | 'times' = 'Nunito', couleur = ENCRE) => {
    doc.setFont(famille, style)
    doc.setFontSize(taille)
    doc.setTextColor(...couleur)
  }
  const section = (titre: string) => {
    place(22)
    y += 4
    police(14, 'bold', 'times', BLEU)
    doc.text(t(titre), M, y)
    doc.setDrawColor(...OR)
    doc.setLineWidth(0.6)
    doc.line(M, y + 2, M + 18, y + 2)
    y += 8
  }
  const paragraphe = (texte: string, taille = 10, style: 'normal' | 'italic' | 'bold' = 'normal', couleur = ENCRE) => {
    police(taille, style, 'Nunito', couleur)
    const lignes = doc.splitTextToSize(t(texte), LU) as string[]
    const h = taille * 0.42
    for (const l of lignes) {
      place(h)
      doc.text(l, M, y)
      y += h
    }
    y += 2
  }
  const styleTableau = {
    margin: { left: M, right: M, top: HAUT, bottom: H - BAS },
    styles: { font: 'Nunito', fontSize: 9, cellPadding: 1.8, textColor: ENCRE, lineColor: TRAIT, lineWidth: 0.2, overflow: 'linebreak' as const },
    headStyles: { fillColor: BLEU, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 8.5 },
    alternateRowStyles: { fillColor: [251, 250, 247] as [number, number, number] },
  }
  /** Tableau « libellé : valeur » sur deux colonnes. */
  const fiche = (lignes: [string, string | undefined][]) => {
    const corps = lignes.filter(([, v]) => v && v.trim()).map(([k, v]) => [t(k), t(v)])
    if (!corps.length) return
    autoTable(doc, {
      ...styleTableau,
      startY: y,
      theme: 'plain',
      body: corps,
      styles: { ...styleTableau.styles, fontSize: 9.5, cellPadding: { top: 1.2, bottom: 1.2, left: 0, right: 2 } },
      columnStyles: { 0: { cellWidth: 42, textColor: GRIS }, 1: { fontStyle: 'bold' } },
    })
    y = finTableau() + 3
  }

  // =================================================================
  // 1. Page de garde
  // =================================================================
  avancement('Mise en page')
  doc.addImage(logoSignature, 'PNG', M, y - 8, 56, 22)
  y += 22
  police(24, 'bold', 'times', BLEU)
  doc.text(t(TITRE_ACTE[edl.typeActe]), M, y)
  y += 8
  police(11, 'normal', 'Nunito', GRIS)
  doc.text(
    t(`${LIBELLE_BIEN[edl.typeBien]}${edl.typeBien !== 'local' ? (edl.meuble ? ' meublé' : ' non meublé') : ''}  ·  Réf. ${edl.reference}  ·  Visite du ${formatDate(edl.dateVisite, true)}`),
    M,
    y,
  )
  y += 4
  doc.setDrawColor(...OR)
  doc.setLineWidth(0.8)
  doc.line(M, y, M + 30, y)
  y += 8

  section('Le bien')
  const b = edl.bien
  fiche([
    ['Adresse', [b.adresse, b.complement].filter(Boolean).join(', ')],
    ['Commune', `${b.codePostal} ${b.ville}`],
    ['Étage', b.etage],
    ['Lot', b.lot],
    ['Surface', b.surface ? `${b.surface} m²` : undefined],
    ['Nombre de pièces', b.nbPieces],
    ['Annexes', b.annexes.join(', ')],
  ])

  section('Les parties')
  const bl = edl.bailleur
  fiche([
    ['Bailleur', bl.raisonSociale],
    ['Adresse du bailleur', bl.adresse],
    ['SIREN', bl.siren],
    ['Représenté par', [edl.operateur.nom, edl.operateur.qualite].filter(Boolean).join(', ')],
    ['Mandataire', edl.mandataire?.nom ? [edl.mandataire.nom, edl.mandataire.adresse].filter(Boolean).join(', ') : undefined],
    ...edl.locataires
      .filter((l) => l.nom.trim())
      .map((l, i, tous): [string, string] => [tous.length > 1 ? `${preneur === 'preneur' ? 'Preneur' : 'Locataire'} ${i + 1}` : preneur === 'preneur' ? 'Preneur' : 'Locataire', [l.civilite, l.prenom, l.nom].filter(Boolean).join(' ')]),
    ['Nouvelle adresse', edl.typeActe === 'sortie' ? edl.nouvelleAdresseLocataire : undefined],
  ])

  section('Chauffage et eau chaude')
  const energie = (e: Edl['chauffage']) => (e.mode === 'aucun' ? 'Aucun' : `${e.mode === 'collectif' ? 'Collectif' : 'Individuel'}${e.energie ? ` - ${e.energie}` : ''}`)
  fiche([
    ['Chauffage', energie(edl.chauffage)],
    ['Eau chaude', edl.eauChaude.idemChauffage ? `${energie(edl.chauffage)} (même système)` : energie(edl.eauChaude)],
  ])

  // Légende des états
  section('Légende des états')
  {
    let x = M
    police(8.5)
    for (const e of ETATS) {
      const largeur = doc.getTextWidth(t(e.libelle)) + 13
      if (x + largeur > L - M) {
        x = M
        y += 7
      }
      doc.setFillColor(...COULEUR_ETAT[e.cle])
      doc.roundedRect(x, y - 3.6, 8, 5, 1, 1, 'F')
      police(7.5, 'bold', 'Nunito', [255, 255, 255])
      doc.text(e.code, x + 4, y, { align: 'center' })
      police(8.5)
      doc.text(t(e.libelle), x + 9.5, y)
      x += largeur + 3
    }
    y += 8
    paragraphe('Les numéros indiqués dans la colonne « Photos » renvoient à l\'annexe photographique en fin de document.', 8.5, 'italic', GRIS)
  }

  // =================================================================
  // 2. Compteurs, clés, détecteur
  // =================================================================
  section('Relevé des compteurs')
  autoTable(doc, {
    ...styleTableau,
    startY: y,
    head: [['Compteur', 'N° (PDL / PCE / compteur)', 'Index', 'Index HC', 'Photos', 'Commentaire']],
    body: (edl.compteurs ?? []).map((c) => [
      t(c.libelle),
      c.nonApplicable ? '' : t(c.numero),
      c.nonApplicable ? 'Sans objet' : t(c.index) || 'Non relevé',
      c.nonApplicable ? '' : t(c.indexHC),
      nums(c.photoIds),
      t(c.commentaire),
    ]),
    columnStyles: { 2: { fontStyle: 'bold' }, 4: { cellWidth: 16 } },
  })
  y = finTableau() + 4

  section('Clés, badges et télécommandes')
  const cles = (edl.cles ?? []).filter((c) => c.nombre > 0 || c.commentaire)
  if (cles.length) {
    autoTable(doc, {
      ...styleTableau,
      startY: y,
      head: [['Désignation', 'Nombre', 'Commentaire', 'Photos']],
      body: cles.map((c) => [t(c.libelle), String(c.nombre), t(c.commentaire), nums(c.photoIds)]),
      columnStyles: { 1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, 3: { cellWidth: 16 } },
    })
    y = finTableau() + 3
  } else paragraphe('Aucune clé remise.', 9.5, 'italic', GRIS)
  if (edl.dateRestitutionCles) paragraphe(`Date de restitution des clés : ${formatDate(edl.dateRestitutionCles, true)}`, 9.5)

  if (edl.typeBien !== 'local') {
    section('Détecteur de fumée')
    const d = edl.detecteur
    fiche([
      ['Présence', d?.present === undefined ? 'Non renseigné' : d.present ? 'Présent' : 'Absent'],
      ['Fonctionnement', d?.fonctionnement ? FONCTIONNEMENT[d.fonctionnement] : undefined],
      ['Commentaire', d?.commentaire],
      ['Photos', nums(d?.photoIds)],
    ])
  }

  // =================================================================
  // 3. Pièces
  // =================================================================
  const observations = (e: Element) =>
    t(
      [
        e.observations.length ? e.observations.join(', ') : '',
        e.localisation ? `(${e.localisation})` : '',
        e.trousChevilles ? `${e.trousChevilles} trou${e.trousChevilles > 1 ? 's' : ''} de chevilles` : '',
        e.aNettoyer ? 'À nettoyer' : '',
        e.reserve ? 'Réserve' : '',
        e.commentaire ?? '',
      ]
        .filter(Boolean)
        .join(' - '),
    )

  for (const piece of edl.pieces) {
    // Une pièce commence sur une nouvelle page seulement s'il ne reste pas la place pour son titre et quelques lignes.
    y += 6
    place(50)
    police(16, 'bold', 'times', BLEU)
    doc.text(t(piece.nom), M, y + 2)
    if (piece.dimensions) {
      police(9.5, 'normal', 'Nunito', GRIS)
      doc.text(t(piece.dimensions), L - M, y + 2, { align: 'right' })
    }
    doc.setDrawColor(...OR)
    doc.setLineWidth(0.6)
    doc.line(M, y + 4.5, M + 18, y + 4.5)
    y += 10

    const etats = piece.elements.map((e) => e.etat)
    autoTable(doc, {
      ...styleTableau,
      startY: y,
      head: [['Élément', 'Nature', 'État', 'Fonct.', 'Observations', 'Photos']],
      body: piece.elements.map((e): RowInput => [
        t(`${e.libelle}${e.quantite && e.quantite > 1 ? ` (x${e.quantite})` : ''}`),
        t(e.nature),
        e.etat ? (ETATS.find((x) => x.cle === e.etat)?.code ?? '') : '-',
        e.equipement && e.fonctionnement ? t(FONCTIONNEMENT[e.fonctionnement]) : '',
        observations(e),
        nums(e.photoIds),
      ]),
      columnStyles: {
        0: { cellWidth: 38, fontStyle: 'bold' },
        1: { cellWidth: 26 },
        2: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 17 },
        5: { cellWidth: 16 },
      },
      didParseCell: (d: CellHookData) => {
        if (d.section === 'body' && d.column.index === 2) {
          const etat = etats[d.row.index]
          if (etat) {
            d.cell.styles.fillColor = COULEUR_ETAT[etat]
            d.cell.styles.textColor = [255, 255, 255]
          } else d.cell.styles.textColor = GRIS
        }
      },
    })
    y = finTableau() + 4
    if (piece.photoIds.length) paragraphe(`Photos d'ensemble : n° ${nums(piece.photoIds)}`, 9.5, 'normal', GRIS)
    if (piece.commentaire?.trim()) {
      police(9.5, 'bold')
      place(6)
      doc.text('Commentaire', M, y)
      y += 4.5
      paragraphe(piece.commentaire, 9.5)
    }
  }

  // =================================================================
  // 4. Observations et signatures
  // =================================================================
  y += 4
  place(60)
  section('Observations générales')
  paragraphe(edl.observationsGenerales?.trim() || 'Néant.', 10, edl.observationsGenerales?.trim() ? 'normal' : 'italic')
  section(`Remarques du ${preneur}`)
  paragraphe(edl.remarquesLocataire?.trim() || 'Néant.', 10, edl.remarquesLocataire?.trim() ? 'normal' : 'italic')

  // Le bloc des signatures (texte + cadres) ne se coupe pas entre deux pages.
  {
    const n = signe ? (edl.signataires ?? []).length : 1 + edl.locataires.filter((l) => l.nom.trim()).length
    const hauteur = 46 + Math.ceil(n / 2) * 51
    if (hauteur < BAS - HAUT) place(hauteur)
  }
  section('Signatures')
  const signeLe = edl.cloture?.signeLe
  paragraphe(
    signe
      ? `Fait à ${edl.lieuSignature || edl.bien.ville || '...'}, le ${formatDate(signeLe!, true)}, en autant d'exemplaires que de parties.`
      : `Fait à ${edl.lieuSignature || edl.bien.ville || '...............'}, le ...............`,
    10,
  )
  paragraphe(
    'Les parties déclarent avoir pris connaissance du présent état des lieux, établi contradictoirement, et en reconnaissent l\'exactitude.',
    9.5,
    'italic',
  )
  {
    const signataires = signe
      ? (edl.signataires ?? [])
      : [
          { id: 'b', role: 'bailleur' as const, nom: edl.operateur.nom || 'Le bailleur', qualite: bl.raisonSociale ? `pour ${bl.raisonSociale}` : 'Bailleur' },
          ...edl.locataires.filter((l) => l.nom.trim()).map((l) => ({ id: l.id, role: 'locataire' as const, nom: [l.prenom, l.nom].filter(Boolean).join(' '), qualite: preneur === 'preneur' ? 'Preneur' : 'Locataire' })),
        ]
    const lc = (LU - 6) / 2
    const hc = 46
    for (let i = 0; i < signataires.length; i++) {
      const s = signataires[i] as (typeof signataires)[number] & { signatureId?: string; absent?: boolean; motifAbsence?: string }
      if (i % 2 === 0) place(hc + 4)
      const x = M + (i % 2) * (lc + 6)
      doc.setDrawColor(...TRAIT)
      doc.setFillColor(...FOND)
      doc.setLineWidth(0.3)
      doc.roundedRect(x, y, lc, hc, 2, 2, 'FD')
      police(10, 'bold')
      doc.text(t(s.nom), x + 4, y + 6)
      police(8.5, 'normal', 'Nunito', GRIS)
      doc.text(t(s.qualite), x + 4, y + 10.5)
      if (s.signatureId) {
        const img = await db.signatures.get(s.signatureId)
        if (img) {
          const p = await versPng(img.image)
          const zl = lc - 8, zh = hc - 16
          const k = Math.min(zl / p.l, zh / p.h)
          doc.addImage(p.data, 'PNG', x + 4 + (zl - p.l * k) / 2, y + 13 + (zh - p.h * k) / 2, p.l * k, p.h * k)
        }
      } else if (s.absent) {
        police(9, 'italic', 'Nunito', OR)
        const lignes = doc.splitTextToSize(t(`Absent ou refus de signer${s.motifAbsence ? ` : ${s.motifAbsence}` : ''}`), lc - 8) as string[]
        doc.text(lignes, x + 4, y + 20)
      } else if (!signe) {
        police(8.5, 'italic', 'Nunito', GRIS)
        doc.text('Signature', x + 4, y + hc - 4)
      }
      if (i % 2 === 1 || i === signataires.length - 1) y += hc + 5
    }
  }

  section('Mentions')
  const mentions: string[] = []
  if (edl.typeBien === 'local') mentions.push("État des lieux établi contradictoirement entre les parties, conformément à l'article L. 145-40-1 du Code de commerce.")
  else {
    mentions.push(
      "État des lieux établi contradictoirement entre les parties, conformément à l'article 3-2 de la loi n° 89-462 du 6 juillet 1989 et au décret n° 2016-382 du 30 mars 2016.",
    )
    if (edl.typeActe === 'entree')
      mentions.push(
        "Le locataire peut demander au bailleur de compléter le présent état des lieux dans un délai de dix jours à compter de son établissement ; pour les éléments de chauffage, cette demande peut être faite durant le premier mois de la période de chauffe.",
      )
  }
  mentions.push('Les photographies annexées, numérotées et horodatées, font partie intégrante du présent état des lieux.')
  for (const m of mentions) paragraphe(m, 8.5, 'normal', GRIS)

  if (signe) {
    section("Preuve d'intégrité")
    paragraphe(
      "Empreinte numérique SHA-256 calculée à la signature sur l'ensemble des saisies, photographies et signatures. Toute modification ultérieure, même minime, produirait une empreinte différente.",
      8.5,
      'normal',
      GRIS,
    )
    place(12)
    doc.setFillColor(...FOND)
    doc.roundedRect(M, y - 1, LU, 10, 1.5, 1.5, 'F')
    doc.setFont('courier', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...ENCRE)
    doc.text(empreinteLisible(edl.cloture!.empreinte), L / 2, y + 5.2, { align: 'center' })
    y += 14
    paragraphe(`Application EDL Brenguier, version ${edl.cloture!.versionApp}.`, 8, 'normal', GRIS)
  }

  // =================================================================
  // 5. Annexe photos (2 colonnes × 3 rangées par page)
  // =================================================================
  if (photos.length) {
    const COL = 2, RANG = 3
    const lp = (LU - 6) / COL
    const hp = (BAS - HAUT - 14 - (RANG - 1) * 6) / RANG
    let i = 0
    for (const p of photos) {
      avancement('Photos', i, photos.length)
      if (i % (COL * RANG) === 0) {
        doc.addPage()
        y = HAUT
        police(16, 'bold', 'times', BLEU)
        doc.text(i === 0 ? 'Annexe - Photographies' : 'Photographies (suite)', M, y + 2)
        y += 10
      }
      const k = i % (COL * RANG)
      const x = M + (k % COL) * (lp + 6)
      const yy = y + Math.floor(k / COL) * (hp + 6)
      await dessinerPhoto(doc, p, x, yy, lp, hp)
      i++
    }
  }

  // =================================================================
  // En-têtes, pieds de page et mention « PROJET »
  // =================================================================
  avancement('Finalisation')
  const nb = doc.getNumberOfPages()
  for (let n = 1; n <= nb; n++) {
    doc.setPage(n)
    if (!signe) {
      const g = new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.08 })
      doc.saveGraphicsState()
      ;(doc as unknown as { setGState: (g: unknown) => void }).setGState(g)
      police(90, 'bold', 'Nunito', OR)
      doc.text('PROJET', L / 2, H / 2 + 20, { align: 'center', angle: 35 })
      doc.restoreGraphicsState()
    }
    if (n > 1) {
      doc.addImage(logoIcone, 'PNG', M, 6.5, 7, 7)
      police(8, 'bold', 'Nunito', BLEU)
      doc.text('GROUPE BRENGUIER', M + 9, 11.5)
      police(8, 'normal', 'Nunito', GRIS)
      doc.text(t(`${TITRE_ACTE[edl.typeActe]} · ${edl.reference} · ${[edl.bien.adresse, edl.bien.ville].filter(Boolean).join(', ')}`), L - M, 12, { align: 'right' })
      doc.setDrawColor(...TRAIT)
      doc.setLineWidth(0.3)
      doc.line(M, 14.5, L - M, 14.5)
    }
    doc.setDrawColor(...TRAIT)
    doc.line(M, H - 12, L - M, H - 12)
    police(7.5, 'normal', 'Nunito', GRIS)
    doc.text(
      t(signe ? `Signé le ${formatDate(edl.cloture!.signeLe, true)} · Empreinte ${edl.cloture!.empreinte.slice(0, 16)}…` : 'Projet non signé - document non contractuel'),
      M,
      H - 7.5,
    )
    doc.text(`Page ${n} / ${nb}`, L - M, H - 7.5, { align: 'right' })
  }

  return doc.output('blob')
}

/** Une photo de l'annexe : image centrée dans son cadre + légende. */
async function dessinerPhoto(doc: jsPDF, p: Photo, x: number, y: number, l: number, h: number) {
  const hImage = h - 9
  doc.setFillColor(...FOND)
  doc.rect(x, y, l, hImage, 'F')
  try {
    const img = await versJpeg(p.image)
    const k = Math.min(l / img.l, hImage / img.h)
    doc.addImage(img.data, 'JPEG', x + (l - img.l * k) / 2, y + (hImage - img.h * k) / 2, img.l * k, img.h * k)
  } catch {
    doc.setFontSize(8)
    doc.text('Image illisible', x + l / 2, y + hImage / 2, { align: 'center' })
  }
  // Légende : « Photo 12 — Séjour · Murs » (la référence et le n° figurent déjà dans l'en-tête).
  const morceaux = (p.legende ?? '').split(/\s+·\s+/).slice(1, -1)
  doc.setFont('Nunito', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...ENCRE)
  doc.text(`Photo ${p.numero}`, x, y + hImage + 4.5)
  const w = doc.getTextWidth(`Photo ${p.numero}`)
  doc.setFont('Nunito', 'normal')
  doc.setTextColor(...GRIS)
  const legende = t(`${morceaux.length ? morceaux.join(' · ') + ' · ' : ''}${formatDate(p.priseLe, true)}${p.annotations?.length ? ' · annotée' : ''}`)
  doc.text(doc.splitTextToSize(legende, l - w - 3)[0] as string, x + w + 2.5, y + hImage + 4.5)
}

/** Nom de fichier lisible : EDL-2026-012_Entree_12-rue-des-Lilas.pdf */
export function nomFichier(edl: Edl): string {
  const acte = { entree: 'Entree', sortie: 'Sortie', pre: 'Pre-EDL' }[edl.typeActe]
  const adresse = (edl.bien.adresse || 'bien')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${edl.reference}_${acte}_${adresse}${edl.statut === 'signe' ? '' : '_PROJET'}.pdf`
}
