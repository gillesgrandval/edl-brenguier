import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ImagePlus, Loader2, PenTool, Trash2, X } from 'lucide-react'
import { db } from '../db/base'
import { formatDate } from '../libelles'
import Annotateur from './Annotateur'

/** Lecture seule (état des lieux signé) : on consulte les photos sans pouvoir les modifier. */
export const LectureSeule = createContext(false)

/** Adresse d'affichage d'une photo enregistrée ; suit les modifications (annotations). */
function usePhotoUrl(id: string, version: 'miniature' | 'image') {
  const blob = useLiveQuery(async () => {
    const p = await db.photos.get(id)
    return p ? (version === 'image' ? p.image : p.miniature) : undefined
  }, [id, version])
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const lien = URL.createObjectURL(blob)
    setUrl(lien)
    return () => URL.revokeObjectURL(lien)
  }, [blob])
  return url
}

/**
 * Boutons « Photo » (appareil photo) et « Galerie ».
 * L'appareil photo s'ouvre directement grâce à capture="environment".
 */
export function BoutonsPhoto(props: { onFichiers: (f: File[]) => void; enCours: number; compact?: boolean }) {
  const camera = useRef<HTMLInputElement>(null)
  const galerie = useRef<HTMLInputElement>(null)
  const verrou = useContext(LectureSeule)
  const recevoir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = Array.from(e.target.files ?? [])
    e.target.value = '' // permet de reprendre la même photo
    if (f.length) props.onFichiers(f)
  }
  if (verrou) return null // état des lieux signé : plus de nouvelles photos
  return (
    <div className="boutons-photo">
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={recevoir} />
      <input ref={galerie} type="file" accept="image/*" multiple hidden onChange={recevoir} />
      <button type="button" className="bouton bouton-accent" onClick={() => camera.current?.click()} disabled={props.enCours > 0}>
        {props.enCours > 0 ? <Loader2 size={20} className="tourne" /> : <Camera size={22} />}
        {props.enCours > 0 ? `Traitement (${props.enCours})…` : 'Photo'}
      </button>
      <button type="button" className="bouton bouton-discret" onClick={() => galerie.current?.click()} disabled={props.enCours > 0} aria-label="Importer depuis la galerie">
        <ImagePlus size={20} /> {props.compact ? '' : 'Galerie'}
      </button>
    </div>
  )
}

function Miniature({ id, onClick }: { id: string; onClick: () => void }) {
  const url = usePhotoUrl(id, 'miniature')
  const infos = useLiveQuery(async () => {
    const p = await db.photos.get(id)
    return p ? { numero: p.numero, annotee: !!p.annotations?.length } : undefined
  }, [id])
  return (
    // div (et non button) : reste consultable dans une zone verrouillée (fieldset désactivé).
    <div role="button" tabIndex={0} className="miniature" onClick={onClick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}>
      {url ? <img src={url} alt={`Photo ${infos?.numero ?? ''}`} /> : <span className="miniature-vide" />}
      {infos && <span className="miniature-numero">{infos.numero}</span>}
      {infos?.annotee && (
        <span className="miniature-annotee">
          <PenTool size={13} />
        </span>
      )}
    </div>
  )
}

export function GaleriePhotos(props: { ids: string[]; onSupprimer: (id: string) => void; lectureSeule?: boolean }) {
  const [ouverte, setOuverte] = useState<string | null>(null)
  const verrou = useContext(LectureSeule)
  if (props.ids.length === 0) return null
  return (
    <>
      <div className="galerie">
        {props.ids.map((id) => (
          <Miniature key={id} id={id} onClick={() => setOuverte(id)} />
        ))}
      </div>
      {ouverte &&
        createPortal(
        <Visionneuse
          id={ouverte}
          lectureSeule={props.lectureSeule || verrou}
          onFermer={() => setOuverte(null)}
          onSupprimer={() => {
            props.onSupprimer(ouverte)
            setOuverte(null)
          }}
        />,
          document.body,
        )}
    </>
  )
}

function Visionneuse(props: { id: string; lectureSeule?: boolean; onFermer: () => void; onSupprimer: () => void }) {
  const url = usePhotoUrl(props.id, 'image')
  const photo = useLiveQuery(() => db.photos.get(props.id), [props.id])
  const [confirmer, setConfirmer] = useState(false)
  const [annoter, setAnnoter] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className="visionneuse" onCancel={props.onFermer}>
      <div className="visionneuse-barre">
        <span>
          <strong>Photo {photo?.numero}</strong> · {photo ? formatDate(photo.priseLe, true) : ''}
        </span>
        {confirmer ? (
          <span className="visionneuse-actions">
            <button className="bouton bouton-discret bouton-petit" style={{ color: '#fff' }} onClick={() => setConfirmer(false)}>
              Annuler
            </button>
            <button className="bouton bouton-danger bouton-petit" onClick={props.onSupprimer}>
              Supprimer la photo
            </button>
          </span>
        ) : (
          <span className="visionneuse-actions">
            {!props.lectureSeule && (
              <>
                <button className="bouton bouton-accent bouton-petit" onClick={() => setAnnoter(true)}>
                  <PenTool size={18} /> Annoter
                </button>
                <button className="bouton-icone bouton-icone-sombre" aria-label="Supprimer" onClick={() => setConfirmer(true)}>
                  <Trash2 />
                </button>
              </>
            )}
            <button className="bouton-icone bouton-icone-sombre" aria-label="Fermer" onClick={props.onFermer}>
              <X />
            </button>
          </span>
        )}
      </div>
      <div className="visionneuse-image" onClick={props.onFermer}>
        {url && <img src={url} alt={photo?.legende} />}
      </div>
      {annoter && <Annotateur photoId={props.id} onFermer={() => setAnnoter(false)} />}
    </dialog>
  )
}
