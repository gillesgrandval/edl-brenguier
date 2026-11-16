import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Crop, Loader2, ScanLine, X } from 'lucide-react'
import { db } from '../db/base'
import type { ReleveCompteur } from '../db/types'
import { lireIndex, type Cadre, type Lecture } from '../ocr/lireIndex'

/**
 * Lecture de l'index d'un compteur sur sa photo.
 * 1. Lecture automatique sur toute la photo.
 * 2. Si besoin, on trace au doigt un cadre autour des chiffres et on relit.
 * 3. On valide (ou corrige) le chiffre proposé.
 */
export default function LecteurIndex(props: { photoId: string; compteur: ReleveCompteur; onFermer: () => void; onValider: (champ: 'index' | 'indexHC', valeur: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const zone = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string>()
  const image = useRef<Blob | null>(null)
  const [cadre, setCadre] = useState<Cadre | null>(null)
  const debut = useRef<{ x: number; y: number } | null>(null)
  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [valeur, setValeur] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string>()
  const elec = props.compteur.type === 'electricite'

  const lire = useCallback(async (c: Cadre | null) => {
    if (!image.current) return
    setEnCours(true)
    setErreur(undefined)
    try {
      const l = await lireIndex(image.current, c)
      setLecture(l)
      // Une lecture incertaine n'est jamais pré-remplie : elle est seulement suggérée.
      setValeur(l.sure ? l.index : '')
      if (!l.index) setErreur(c ? 'Aucun chiffre lu dans le cadre. Resserrez le cadre sur les chiffres de l’index.' : 'Index non trouvé automatiquement : tracez un cadre autour des chiffres de l’index.')
      else if (!l.sure) setErreur(c ? 'Lecture incertaine : vérifiez le chiffre suggéré ou resserrez le cadre.' : 'Lecture incertaine : vérifiez la zone encadrée en pointillés. Si ce n’est pas l’index, tracez un cadre autour des bons chiffres.')
    } catch (e) {
      setErreur('Le moteur de lecture n’a pas pu démarrer : ' + (e as Error).message)
    } finally {
      setEnCours(false)
    }
  }, [])

  useEffect(() => {
    ref.current?.showModal()
    let lien: string | undefined
    db.photos.get(props.photoId).then((p) => {
      if (!p) return
      image.current = p.base ?? p.image
      lien = URL.createObjectURL(image.current)
      setUrl(lien)
      void lire(null)
    })
    return () => {
      if (lien) URL.revokeObjectURL(lien)
    }
  }, [props.photoId, lire])

  // --- Tracé du cadre au doigt ---
  function pos(e: React.PointerEvent) {
    const img = zone.current!.querySelector('img')!
    const r = img.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  function appui(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    debut.current = pos(e)
    setCadre(null)
  }
  function glisse(e: React.PointerEvent) {
    if (!debut.current) return
    const p = pos(e)
    const d = debut.current
    setCadre({ x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), l: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) })
  }
  function relache() {
    debut.current = null
    if (cadre && cadre.l > 0.03 && cadre.h > 0.02) void lire(cadre)
    else setCadre(null)
  }

  // Position du cadre à l'écran (l'image est centrée dans sa zone).
  const [boite, setBoite] = useState<{ left: number; top: number; width: number; height: number }>()
  useEffect(() => {
    const maj = () => {
      const img = zone.current?.querySelector('img')
      const z = zone.current
      if (!img || !z) return
      const ri = img.getBoundingClientRect()
      const rz = z.getBoundingClientRect()
      // Taille réellement affichée (object-fit: contain).
      const ratio = img.naturalWidth / img.naturalHeight || 1
      let w = ri.width, h = ri.width / ratio
      if (h > ri.height) {
        h = ri.height
        w = h * ratio
      }
      setBoite({ left: ri.left - rz.left + (ri.width - w) / 2, top: ri.top - rz.top + (ri.height - h) / 2, width: w, height: h })
    }
    maj()
    window.addEventListener('resize', maj)
    return () => window.removeEventListener('resize', maj)
  }, [url])

  return (
    <dialog ref={ref} className="dialogue dialogue-large memo" onCancel={props.onFermer}>
      <div className="memo-entete">
        <h2>
          <ScanLine size={22} /> Lire l'index — {props.compteur.libelle}
        </h2>
        <button className="bouton-icone" onClick={props.onFermer} aria-label="Fermer">
          <X />
        </button>
      </div>
      <p className="texte-doux" style={{ margin: '6px 0' }}>
        <Crop size={16} style={{ verticalAlign: '-3px' }} /> Pour une lecture fiable, <strong>tracez au doigt un cadre serré autour des chiffres de l'index</strong>.
      </p>

      <div ref={zone} className="lecteur-image" onPointerDown={appui} onPointerMove={glisse} onPointerUp={relache} onPointerCancel={relache}>
        {url && <img src={url} alt="Photo du compteur" draggable={false} onLoad={() => window.dispatchEvent(new Event('resize'))} />}
        {!cadre && lecture?.zone && boite && (
          <div
            className="lecteur-cadre lecteur-zone-lue"
            style={{ left: boite.left + lecture.zone.x * boite.width, top: boite.top + lecture.zone.y * boite.height, width: lecture.zone.l * boite.width, height: lecture.zone.h * boite.height }}
          >
            <span>Zone lue</span>
          </div>
        )}
        {cadre && boite && (
          <div
            className="lecteur-cadre"
            style={{ left: boite.left + cadre.x * boite.width, top: boite.top + cadre.y * boite.height, width: cadre.l * boite.width, height: cadre.h * boite.height }}
          />
        )}
      </div>

      {enCours ? (
        <p className="texte-doux">
          <Loader2 size={18} className="tourne" style={{ verticalAlign: '-4px' }} /> Lecture en cours… (la première fois, quelques secondes de préparation)
        </p>
      ) : (
        <>
          {erreur && <p className="dictee-erreur">{erreur}</p>}
          <div className="lecteur-resultat">
            <label className="champ">
              <span className="champ-label">
                Index {lecture?.sure ? `lu (fiabilité ${lecture.confiance} %)` : 'à saisir'} — vérifiez et corrigez si besoin
              </span>
              <input className="saisie" inputMode="numeric" value={valeur} onChange={(e) => setValeur(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="—" />
            </label>
            {lecture?.apercu && <img src={lecture.apercu} alt="Image analysée" style={{ height: 64, maxWidth: 260, objectFit: 'contain', border: '1px solid var(--trait)', borderRadius: 8 }} />}
          </div>
          {lecture && !lecture.sure && lecture.index && (
            <div className="puces" style={{ marginTop: 10 }}>
              <span className="texte-doux" style={{ alignSelf: 'center' }}>
                Lecture suggérée :
              </span>
              <button className="puce" onClick={() => setValeur(lecture.index)}>
                {lecture.index} ?
              </button>
            </div>
          )}
          {lecture && lecture.autres.length > 0 && (
            <div className="puces" style={{ marginTop: 10 }}>
              <span className="texte-doux" style={{ alignSelf: 'center' }}>
                Autres nombres vus :
              </span>
              {lecture.autres.map((a) => (
                <button key={a} className="puce" onClick={() => setValeur(a)}>
                  {a}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="dialogue-actions">
        <button className="bouton bouton-discret" onClick={props.onFermer}>
          Annuler
        </button>
        {elec && (
          <button className="bouton bouton-discret" disabled={!valeur || enCours} onClick={() => props.onValider('indexHC', valeur)}>
            Index HC
          </button>
        )}
        <button className="bouton bouton-accent" disabled={!valeur || enCours} onClick={() => props.onValider('index', valeur)}>
          <Check size={20} /> {elec ? 'Index HP / base' : "Utiliser comme index"}
        </button>
      </div>
    </dialog>
  )
}
