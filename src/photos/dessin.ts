import type { Forme } from '../db/types'

/** Dessine une forme sur le canevas. */
export function dessinerForme(ctx: CanvasRenderingContext2D, f: Forme) {
  ctx.save()
  ctx.strokeStyle = f.couleur
  ctx.fillStyle = f.couleur
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Liseré sombre sous le trait : reste lisible sur tous les fonds.
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 'epaisseur' in f ? f.epaisseur * 0.8 : 6
  if (f.type === 'texte') {
    ctx.font = `700 ${f.taille}px Carlito, Calibri, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.lineWidth = f.taille / 7
    ctx.strokeStyle = f.couleur === '#FFFFFF' || f.couleur === '#FFC400' ? '#1C2B3A' : '#FFFFFF'
    ctx.shadowBlur = 0
    ctx.strokeText(f.texte, f.x, f.y)
    ctx.fillText(f.texte, f.x, f.y)
  } else if (f.type === 'main') {
    ctx.lineWidth = f.epaisseur
    ctx.beginPath()
    f.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
  } else {
    ctx.lineWidth = f.epaisseur
    const { x1, y1, x2, y2 } = f
    ctx.beginPath()
    if (f.type === 'rectangle') {
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
    } else if (f.type === 'cercle') {
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2)
    } else {
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const pointe = f.epaisseur * 4.5
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2 - Math.cos(angle) * pointe * 0.6, y2 - Math.sin(angle) * pointe * 0.6)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - pointe * Math.cos(angle - 0.45), y2 - pointe * Math.sin(angle - 0.45))
      ctx.lineTo(x2 - pointe * Math.cos(angle + 0.45), y2 - pointe * Math.sin(angle + 0.45))
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      return
    }
    ctx.stroke()
  }
  ctx.restore()
}
