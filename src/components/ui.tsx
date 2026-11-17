import { useEffect, useRef, type ReactNode } from 'react'
import { Check, Lock, Minus, Plus } from 'lucide-react'
import { LectureSeule } from './Photos'
import { formatDate } from '../libelles'

/* Petits composants réutilisés dans toute l'application.
   Tous respectent une zone tactile d'au moins 56 px. */

export function Champ(props: {
  label: string
  valeur: string | undefined
  onChange: (v: string) => void
  type?: 'text' | 'tel' | 'email' | 'number' | 'datetime-local' | 'date' | 'time'
  placeholder?: string
  aide?: string
  large?: boolean
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email'
  autoComplete?: string
}) {
  return (
    <label className={`champ ${props.large ? 'champ-large' : ''}`}>
      <span className="champ-label">{props.label}</span>
      <input
        className="saisie"
        type={props.type ?? 'text'}
        value={props.valeur ?? ''}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete ?? 'off'}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.aide && <span className="champ-aide">{props.aide}</span>}
    </label>
  )
}

export function ZoneTexte(props: { label: string; valeur?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="champ champ-large">
      <span className="champ-label">{props.label}</span>
      <textarea
        className="saisie"
        rows={3}
        value={props.valeur ?? ''}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  )
}

/** Grandes tuiles à choix unique, avec icône. */
export function Tuiles<T extends string>(props: {
  options: { valeur: T; libelle: string; icone?: ReactNode; detail?: string }[]
  valeur: T | undefined
  onChange: (v: T) => void
  colonnes?: number
}) {
  return (
    <div className="tuiles" style={props.colonnes ? { gridTemplateColumns: `repeat(${props.colonnes}, 1fr)` } : undefined}>
      {props.options.map((o) => {
        const actif = o.valeur === props.valeur
        return (
          <button
            key={o.valeur}
            type="button"
            className={`tuile ${actif ? 'tuile-active' : ''}`}
            aria-pressed={actif}
            onClick={() => props.onChange(o.valeur)}
          >
            {o.icone && <span className="tuile-icone">{o.icone}</span>}
            <span className="tuile-libelle">{o.libelle}</span>
            {o.detail && <span className="tuile-detail">{o.detail}</span>}
            {actif && (
              <span className="tuile-coche">
                <Check size={16} strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Puces sélectionnables (choix multiple ou unique). */
export function Puces(props: { options: string[]; choisies: string[]; onBasculer: (v: string) => void }) {
  return (
    <div className="puces">
      {props.options.map((o) => {
        const actif = props.choisies.includes(o)
        return (
          <button key={o} type="button" className={`puce ${actif ? 'puce-active' : ''}`} aria-pressed={actif} onClick={() => props.onBasculer(o)}>
            {actif && <Check size={16} strokeWidth={3} />}
            {o}
          </button>
        )
      })}
    </div>
  )
}

export function Interrupteur(props: { libelle: string; valeur: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="interrupteur-ligne" role="switch" aria-checked={props.valeur} onClick={() => props.onChange(!props.valeur)}>
      <span>{props.libelle}</span>
      <span className={`interrupteur ${props.valeur ? 'interrupteur-on' : ''}`}>
        <span />
      </span>
    </button>
  )
}

/** Compteur − / + pour les quantités. */
export function Compteur(props: { valeur: number; onChange: (v: number) => void; min?: number; max?: number; libelle?: string }) {
  const min = props.min ?? 0
  const max = props.max ?? 20
  return (
    <div className="compteur" aria-label={props.libelle}>
      <button type="button" disabled={props.valeur <= min} onClick={() => props.onChange(props.valeur - 1)} aria-label="Moins">
        <Minus size={20} />
      </button>
      <span className={props.valeur > 0 ? 'compteur-actif' : ''}>{props.valeur}</span>
      <button type="button" disabled={props.valeur >= max} onClick={() => props.onChange(props.valeur + 1)} aria-label="Plus">
        <Plus size={20} />
      </button>
    </div>
  )
}

export function BarreProgression(props: { pourcent: number; fine?: boolean }) {
  const p = Math.max(0, Math.min(100, props.pourcent))
  return (
    <div className={`barre ${props.fine ? 'barre-fine' : ''}`} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className={`barre-remplie ${p === 100 ? 'barre-complete' : ''}`} style={{ width: `${p}%` }} />
    </div>
  )
}

export function Badge(props: { children: ReactNode; ton?: 'encre' | 'bronze' | 'vert' | 'gris' | 'orange' }) {
  return <span className={`badge badge-${props.ton ?? 'gris'}`}>{props.children}</span>
}

/** Fenêtre de confirmation (suppression, etc.). */
export function Confirmation(props: {
  ouvert: boolean
  titre: string
  message: ReactNode
  libelleOk: string
  danger?: boolean
  onOk: () => void
  onAnnuler: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (props.ouvert && !d.open) d.showModal()
    if (!props.ouvert && d.open) d.close()
  }, [props.ouvert])
  return (
    <dialog ref={ref} className="dialogue" onCancel={props.onAnnuler}>
      <h2>{props.titre}</h2>
      <div className="dialogue-message">{props.message}</div>
      <div className="dialogue-actions">
        <button className="bouton bouton-discret" onClick={props.onAnnuler}>
          Annuler
        </button>
        <button className={`bouton ${props.danger ? 'bouton-danger' : 'bouton-principal'}`} onClick={props.onOk}>
          {props.libelleOk}
        </button>
      </div>
    </dialog>
  )
}

export function Section(props: { titre: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="section">
      <div className="section-titre">
        <h2>{props.titre}</h2>
        {props.action}
      </div>
      {props.children}
    </section>
  )
}

/**
 * Zone verrouillée une fois l'état des lieux signé : tout est en lecture seule
 * (les photos restent consultables).
 */
export function Verrou(props: { signeLe?: string; actif: boolean; children: ReactNode }) {
  if (!props.actif) return <>{props.children}</>
  return (
    <LectureSeule.Provider value={true}>
      <div className="bandeau-signe">
        <Lock size={18} /> Signé{props.signeLe ? ` le ${formatDate(props.signeLe, true)}` : ''} — consultation seule, aucune modification possible.
      </div>
      <fieldset className="verrou" disabled>
        {props.children}
      </fieldset>
    </LectureSeule.Provider>
  )
}
