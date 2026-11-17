import { useEffect, useRef, useState } from 'react'
import { CHARTE } from '../theme/charte'
import { ArrowUpRight, Check, Circle, Pencil, Square, Trash2, Type, Undo2, X } from 'lucide-react'
import { db } from '../db/base'
import type { Forme } from '../db/types'
import { creerMiniature, versBlob } from '../photos/traitement'
import { dessinerForme } from '../photos/dessin'

/* ------------------------------------------------------------------
   Annotation d'une photo : flèche, cercle, rectangle, trait libre, texte.
   L'image d'origine est conservée : on peut reprendre ou effacer
   les annotations à tout moment, sans perte de qualité.
   ------------------------------------------------------------------ */

type Outil = 'fleche' | 'cercle' | 'rectangle' | 'main' | 'texte'

// Couleurs d'annotation : vives pour ressortir sur toutes les photos, plus le noir de la charte.
const COULEURS = ['#E53935', '#FFC400', '#FFFFFF', '#1E88E5', CHARTE.noir]

const OUTILS: { cle: Outil; libelle: string; icone: React.ReactNode }[] = [
  { cle: 'fleche', libelle: 'Flèche', icone: <ArrowUpRight /> },
  { cle: 'cercle', libelle: 'Cercle', icone: <Circle /> },
  { cle: 'rectangle', libelle: 'Cadre', icone: <Square /> },
  { cle: 'main', libelle: 'Main levée', icone: <Pencil /> },
  { cle: 'texte', libelle: 'Texte', icone: <Type /> },
]

export default function Annotateur({ photoId, onFermer }: { photoId: string; onFermer: () => void }) {
  const dialogue = useRef<HTMLDialogElement>(null)
  const canevas = useRef<HTMLCanvasElement>(null)
  const image = useRef<HTMLImageElement | null>(null)
  const base = useRef<Blob | null>(null)
  const [formes, setFormes] = useState<Forme[]>([])
  const [encours, setEncours] = useState<Forme | null>(null)
  const [outil, setOutil] = useState<Outil>('fleche')
  const [couleur, setCouleur] = useState(COULEURS[0])
  const [texte, setTexte] = useState<{ x: number; y: number } | null>(null)
  const [saisieTexte, setSaisieTexte] = useState('')
  const [enregistrement, setEnregistrement] = useState(false)
  const [pret, setPret] = useState(false)

  useEffect(() => {
    dialogue.current?.showModal()
    let url: string | undefined
    db.photos.get(photoId).then((p) => {
      if (!p) return
      base.current = p.base ?? p.image
      setFormes(p.annotations ?? [])
      url = URL.createObjectURL(base.current)
      const img = new Image()
      img.onload = () => {
        image.current = img
        const c = canevas.current!
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        setPret(true)
      }
      img.src = url
    })
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [photoId])

  // Redessine à chaque changement.
  useEffect(() => {
    const c = canevas.current
    const img = image.current
    if (!c || !img || !pret) return
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    for (const f of formes) dessinerForme(ctx, f)
    if (encours) dessinerForme(ctx, encours)
  }, [formes, encours, pret])

  const largeur = canevas.current?.width ?? 1600
  const epaisseur = Math.max(4, Math.round(largeur * 0.006))

  function point(e: React.PointerEvent): [number, number] {
    const c = canevas.current!
    const r = c.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height]
  }

  function debut(e: React.PointerEvent) {
    if (!pret) return
    const [x, y] = point(e)
    if (outil === 'texte') {
      setTexte({ x, y })
      setSaisieTexte('')
      return
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setEncours(outil === 'main' ? { type: 'main', couleur, epaisseur, points: [[x, y]] } : { type: outil, couleur, epaisseur, x1: x, y1: y, x2: x, y2: y })
  }

  function mouvement(e: React.PointerEvent) {
    if (!encours) return
    const [x, y] = point(e)
    if (encours.type === 'main') setEncours({ ...encours, points: [...encours.points, [x, y]] })
    else if (encours.type !== 'texte') setEncours({ ...encours, x2: x, y2: y })
  }

  function fin() {
    if (!encours) return
    // Ignore les simples touchers sans tracé.
    const valable = encours.type === 'main' ? encours.points.length > 2 : encours.type !== 'texte' && Math.hypot(encours.x2 - encours.x1, encours.y2 - encours.y1) > 12
    if (valable) setFormes((f) => [...f, encours])
    setEncours(null)
  }

  function validerTexte() {
    if (texte && saisieTexte.trim()) {
      setFormes((f) => [...f, { type: 'texte', couleur, taille: Math.max(28, Math.round(largeur * 0.035)), x: texte.x, y: texte.y, texte: saisieTexte.trim() }])
    }
    setTexte(null)
  }

  async function enregistrer() {
    setEnregistrement(true)
    try {
      const c = canevas.current!
      const ctx = c.getContext('2d')!
      ctx.drawImage(image.current!, 0, 0)
      for (const f of formes) dessinerForme(ctx, f)
      const imageFinale = formes.length ? await versBlob(c, 0.85) : base.current!
      const miniature = await creerMiniature(c)
      await db.photos.update(photoId, {
        image: imageFinale,
        miniature,
        base: formes.length ? base.current! : undefined,
        annotations: formes.length ? formes : undefined,
      })
      onFermer()
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <dialog ref={dialogue} className="annotateur" onCancel={onFermer}>
      <div className="annotateur-barre">
        <div className="annotateur-outils">
          {OUTILS.map((o) => (
            <button key={o.cle} className={outil === o.cle ? 'actif' : ''} onClick={() => setOutil(o.cle)} aria-label={o.libelle} title={o.libelle}>
              {o.icone}
              <span>{o.libelle}</span>
            </button>
          ))}
        </div>
        <div className="annotateur-couleurs">
          {COULEURS.map((c) => (
            <button key={c} className={couleur === c ? 'actif' : ''} style={{ background: c }} onClick={() => setCouleur(c)} aria-label={`Couleur ${c}`} />
          ))}
        </div>
        <div className="annotateur-actions">
          <button onClick={() => setFormes((f) => f.slice(0, -1))} disabled={!formes.length} aria-label="Annuler le dernier tracé" title="Annuler">
            <Undo2 />
          </button>
          <button onClick={() => setFormes([])} disabled={!formes.length} aria-label="Tout effacer" title="Tout effacer">
            <Trash2 />
          </button>
          <button onClick={onFermer} aria-label="Fermer sans enregistrer" title="Fermer">
            <X />
          </button>
          <button className="annotateur-ok" onClick={enregistrer} disabled={enregistrement}>
            <Check /> Enregistrer
          </button>
        </div>
      </div>
      <div className="annotateur-zone">
        <canvas ref={canevas} onPointerDown={debut} onPointerMove={mouvement} onPointerUp={fin} onPointerCancel={fin} />
      </div>
      {texte && (
        <div className="annotateur-texte">
          <input autoFocus className="saisie" placeholder="Texte à placer (ex. Trou Ø 8 mm)" value={saisieTexte} onChange={(e) => setSaisieTexte(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && validerTexte()} />
          <button className="bouton bouton-discret" onClick={() => setTexte(null)}>
            Annuler
          </button>
          <button className="bouton bouton-accent" onClick={validerTexte}>
            Placer
          </button>
        </div>
      )}
    </dialog>
  )
}
