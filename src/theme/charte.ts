/* ------------------------------------------------------------------
   Charte graphique du Groupe Brenguier, côté code (dessins sur les
   photos, signature, rapport PDF). Les mêmes valeurs sont définies
   pour l'interface dans styles/theme.css (variables --charte-*).
   ------------------------------------------------------------------ */

export const CHARTE = {
  bleu: '#26458F',
  or: '#CA9440',
  blancCasse: '#F4F3F2',
  noir: '#010101',
} as const

/** Police de texte de la charte (embarquée dans l'application). */
export const POLICE_TEXTE = 'Nunito, system-ui, sans-serif'

/** « #26458F » → [38, 69, 143] (pour le PDF). */
export function rvb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Couleur de la charte avec transparence, pour les dessins sur canevas. */
export function transparence(hex: string, alpha: number): string {
  const [r, v, b] = rvb(hex)
  return `rgba(${r}, ${v}, ${b}, ${alpha})`
}
