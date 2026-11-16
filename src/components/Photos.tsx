import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { db } from '../db/base'
import { formatDate } from '../libelles'

/** Adresse d'affichage d'une photo enregistrée (libérée automatiquement). */
function usePhotoUrl(id: string, version: 'miniature' | 'image') {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let lien: string | undefined
    let actif = true
    db.photos.get(id).then((p) => {
      if (!p || !actif) return
      lien = URL.createObjectURL(version === 'image' ? p.image : p.miniature)
      setUrl(lien)
    })
    return () => {
      actif = false
      if (lien) URL.revokeObjectURL(lien)
    }
  }, [id, version])
  return url
}

/**
 * Boutons « Photo » (appareil photo) et « Galerie ».
 * L'appareil photo s'ouvre directement grâce à capture="environment".
 */
export function BoutonsPhoto(props: { onFichiers: (f: File[]) => void; enCours: number; compact?: boolean }) {
  const camera = useRef<HTMLInputElement>(null)
  const galerie = useRef<HTMLInputElement>(null)
  const recevoir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = Array.from(e.target.files ?? [])
    e.target.value = '' // permet de reprendre la même photo
    if (f.length) props.onFichiers(f)
  }
  return (
    <div className="boutons-photo">
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={recevoir} />
      <input ref={galerie} type="file" accept="image/*" multiple hidden onChange={recevoir} />
      <button type="button" className="bouton bouton-accent" onClick={() => camera.current?.click()} disabled={props.enCours > 0}>
        {props.enCours > 0 ? <Loader2 size={20} className="tourne" /> : <Camera size={22} />}
        {props.enCours > 0 ? `Traitement (${props.enCours})…` : 'Photo'}
      </button>
      <button type="button" className="bouton bouton-discret" onClick={() => galerie.current?.click()} disabled={props.enCours > 0}>
        <ImagePlus size={20} /> {props.compact ? '' : 'Galerie'}
      </button>
    </div>
  )
}

function Miniature({ id, onClick }: { id: string; onClick: () => void }) {
  const url = usePhotoUrl(id, 'miniature')
  const numero = useLiveQuery(async () => (await db.photos.get(id))?.numero, [id])
  return (
    <button type="button" className="miniature" onClick={onClick}>
      {url ? <img src={url} alt={`Photo ${numero ?? ''}`} /> : <span className="miniature-vide" />}
      {numero && <span className="miniature-numero">{numero}</span>}
    </button>
  )
}

export function GaleriePhotos(props: { ids: string[]; onSupprimer: (id: string) => void }) {
  const [ouverte, setOuverte] = useState<string | null>(null)
  if (props.ids.length === 0) return null
  return (
    <>
      <div className="galerie">
        {props.ids.map((id) => (
          <Miniature key={id} id={id} onClick={() => setOuverte(id)} />
        ))}
      </div>
      {ouverte && (
        <Visionneuse
          id={ouverte}
          onFermer={() => setOuverte(null)}
          onSupprimer={() => {
            props.onSupprimer(ouverte)
            setOuverte(null)
          }}
        />
      )}
    </>
  )
}

function Visionneuse(props: { id: string; onFermer: () => void; onSupprimer: () => void }) {
  const url = usePhotoUrl(props.id, 'image')
  const photo = useLiveQuery(() => db.photos.get(props.id), [props.id])
  const [confirmer, setConfirmer] = useState(false)
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
            <button className="bouton-icone bouton-icone-sombre" aria-label="Supprimer" onClick={() => setConfirmer(true)}>
              <Trash2 />
            </button>
            <button className="bouton-icone bouton-icone-sombre" aria-label="Fermer" onClick={props.onFermer}>
              <X />
            </button>
          </span>
        )}
      </div>
      <div className="visionneuse-image" onClick={props.onFermer}>
        {url && <img src={url} alt={photo?.legende} />}
      </div>
    </dialog>
  )
}
