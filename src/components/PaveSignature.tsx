import { useEffect, useRef, useState } from 'react'
import { CHARTE } from '../theme/charte'
import { Eraser } from 'lucide-react'

/**
 * Pavé de signature au doigt (ou au stylet).
 * Trait lissé, plus fin quand on va vite, comme un vrai stylo.
 * Renvoie l'image PNG (fond transparent) à chaque trait, ou null si effacé.
 */
export default function PaveSignature(props: { onChange: (image: Blob | null) => void; desactive?: boolean }) {
  const canevas = useRef<HTMLCanvasElement>(null)
  const dernier = useRef<{ x: number; y: number; t: number; l: number } | null>(null)
  const [vide, setVide] = useState(true)

  // Taille réelle à l'écran × densité de pixels : trait net sur tablette.
  useEffect(() => {
    const c = canevas.current!
    const r = c.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(r.width * dpr)
    c.height = Math.round(r.height * dpr)
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = CHARTE.bleu
  }, [])

  const point = (e: React.PointerEvent) => {
    const r = canevas.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp }
  }

  function appui(e: React.PointerEvent) {
    if (props.desactive) return
    e.preventDefault()
    canevas.current!.setPointerCapture(e.pointerId)
    const p = point(e)
    dernier.current = { ...p, l: 2.6 }
    const ctx = canevas.current!.getContext('2d')!
    ctx.beginPath()
    ctx.fillStyle = CHARTE.bleu
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2)
    ctx.fill()
  }

  function glisse(e: React.PointerEvent) {
    const d = dernier.current
    if (!d) return
    const ctx = canevas.current!.getContext('2d')!
    // Les événements intermédiaires (coalescés) rendent la courbe fluide.
    const evts = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of evts) {
      const r = canevas.current!.getBoundingClientRect()
      const p = { x: ev.clientX - r.left, y: ev.clientY - r.top, t: ev.timeStamp }
      const dist = Math.hypot(p.x - d.x, p.y - d.y)
      if (dist < 0.8) continue
      const vitesse = dist / Math.max(1, p.t - d.t)
      const l = Math.max(1.2, Math.min(3.4, 3.6 - vitesse * 1.1)) * 0.35 + d.l * 0.65
      const milieu = { x: (d.x + p.x) / 2, y: (d.y + p.y) / 2 }
      ctx.lineWidth = l
      ctx.beginPath()
      ctx.moveTo(d.x, d.y)
      ctx.quadraticCurveTo(d.x, d.y, milieu.x, milieu.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      Object.assign(d, p, { l })
    }
  }

  function relache() {
    if (!dernier.current) return
    dernier.current = null
    setVide(false)
    canevas.current!.toBlob((b) => props.onChange(b), 'image/png')
  }

  function effacer() {
    const c = canevas.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setVide(true)
    props.onChange(null)
  }

  return (
    <div className={`pave-signature ${props.desactive ? 'pave-desactive' : ''}`}>
      <canvas ref={canevas} onPointerDown={appui} onPointerMove={glisse} onPointerUp={relache} onPointerCancel={relache} aria-label="Zone de signature" />
      {vide && <span className="pave-invite">Signez ici avec le doigt</span>}
      <span className="pave-ligne" />
      {!vide && !props.desactive && (
        <button type="button" className="bouton bouton-discret bouton-petit pave-effacer" onClick={effacer}>
          <Eraser size={18} /> Effacer
        </button>
      )}
    </div>
  )
}
