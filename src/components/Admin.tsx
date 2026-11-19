import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, KeyRound, Trash2, Undo2 } from 'lucide-react'
import { db } from '../db/base'
import { CODE_VALIDE, annulerEdl, codeDefini, definirCode, edlsLies, mettreALaCorbeille, retablirEdl } from '../db/admin'
import type { Annulation, Edl } from '../db/types'
import { LIBELLE_ACTE, LIBELLE_STATUT, formatDate } from '../libelles'
import { adresseCourte } from '../db/edl'

/** Fenêtre modale simple, ouverte dès son affichage. */
export function Fenetre(props: { titre: ReactNode; children: ReactNode; onFermer: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className="dialogue" onCancel={props.onFermer}>
      <h2>{props.titre}</h2>
      {props.children}
    </dialog>
  )
}

/** Champ de code (chiffres masqués). */
export function ChampCode(props: { label: string; valeur: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="champ">
      <span className="champ-label">{props.label}</span>
      <input
        className="saisie saisie-code"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        autoFocus={props.autoFocus}
        value={props.valeur}
        onChange={(e) => props.onChange(e.target.value.replace(/\D/g, ''))}
      />
    </label>
  )
}

/**
 * Bloc « code administrateur » d'une fenêtre : demande le code, ou propose
 * de le définir s'il n'existe pas encore (une seule fois par appareil).
 */
function SaisieCode({ code, setCode }: { code: string; setCode: (v: string) => void }) {
  const defini = useLiveQuery(codeDefini, [])
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState('')
  if (defini === undefined) return null
  if (defini) return <ChampCode label="Code administrateur" valeur={code} onChange={setCode} autoFocus />
  return (
    <div className="carte-unite">
      <p style={{ marginTop: 0 }}>
        <KeyRound size={16} /> <strong>Aucun code administrateur n'est encore défini sur cet appareil.</strong> Choisissez-en un (4 à 8 chiffres) : il sera demandé pour les suppressions définitives et les annulations.
      </p>
      <div className="grille">
        <ChampCode label="Nouveau code" valeur={nouveau} onChange={setNouveau} autoFocus />
        <ChampCode label="Confirmer le code" valeur={confirmation} onChange={setConfirmation} />
      </div>
      {erreur && <p className="texte-erreur">{erreur}</p>}
      <button
        type="button"
        className="bouton bouton-principal bouton-petit"
        style={{ marginTop: 10 }}
        disabled={!CODE_VALIDE.test(nouveau) || nouveau !== confirmation}
        onClick={async () => {
          try {
            await definirCode(nouveau)
            setCode(nouveau)
          } catch (e) {
            setErreur((e as Error).message)
          }
        }}
      >
        Enregistrer ce code
      </button>
    </div>
  )
}

/** Résumé d'un état des lieux, affiché avant toute suppression ou annulation. */
export function ResumeEdl({ edl }: { edl: Edl }) {
  return (
    <dl className="resume-edl">
      <dt>Bien</dt>
      <dd>
        {edl.bien.lot ? `Lot ${edl.bien.lot} — ` : ''}
        {adresseCourte(edl)}
      </dd>
      <dt>Date</dt>
      <dd>{formatDate(edl.dateVisite, true)}</dd>
      <dt>Type</dt>
      <dd>{LIBELLE_ACTE[edl.typeActe]}</dd>
      <dt>Statut</dt>
      <dd>
        {LIBELLE_STATUT[edl.statut]}
        {edl.cloture ? ` le ${formatDate(edl.cloture.signeLe, true)}` : ''}
      </dd>
      <dt>Référence</dt>
      <dd>{edl.reference}</dd>
    </dl>
  )
}

/**
 * Suppression contrôlée d'un état des lieux :
 * - non signé → corbeille (restaurable), avec confirmation ;
 * - signé → jamais supprimé : annulation (archivage) avec motif et code ;
 * - signé et annulé → levée de l'annulation, avec le code.
 */
export function DialogueSuppression({ edl, onFermer, onFait }: { edl: Edl; onFermer: () => void; onFait?: () => void }) {
  const annulation = useLiveQuery(async () => (await db.annulations.get(edl.id)) ?? null, [edl.id])
  const lies = useLiveQuery(() => edlsLies(edl.id), [edl.id])
  const [motif, setMotif] = useState('')
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)
  if (annulation === undefined) return null
  const signe = edl.statut === 'signe'

  async function agir(f: () => Promise<void>) {
    setErreur('')
    setEnCours(true)
    try {
      await f()
      onFait?.()
      onFermer()
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnCours(false)
    }
  }

  const avertissementLies = !!lies?.length && (
    <p className="texte-alerte">
      {lies.length > 1 ? `${lies.length} états des lieux de sortie s'appuient` : `L'état des lieux de sortie ${lies[0].reference} s'appuie`} sur celui-ci (comparatif entrée / sortie).
    </p>
  )

  if (!signe)
    return (
      <Fenetre titre="Supprimer cet état des lieux ?" onFermer={onFermer}>
        <ResumeEdl edl={edl} />
        <p>
          Il sera placé dans la <strong>corbeille</strong>, d'où il peut être restauré. Sa suppression définitive se fait depuis la corbeille, avec le code administrateur.
        </p>
        {avertissementLies}
        <p className="texte-doux">La fiche du bien et les autres états des lieux ne sont pas touchés.</p>
        <label className="champ">
          <span className="champ-label">Motif (facultatif)</span>
          <input className="saisie" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="ex. état des lieux de test, créé en double…" />
        </label>
        {erreur && <p className="texte-erreur">{erreur}</p>}
        <div className="dialogue-actions">
          <button className="bouton bouton-discret" onClick={onFermer}>
            Annuler
          </button>
          <button className="bouton bouton-danger" disabled={enCours} onClick={() => agir(() => mettreALaCorbeille(edl.id, motif))}>
            <Trash2 size={20} /> Mettre à la corbeille
          </button>
        </div>
      </Fenetre>
    )

  if (annulation)
    return (
      <Fenetre titre="Lever l'annulation ?" onFermer={onFermer}>
        <ResumeEdl edl={edl} />
        <p>
          Annulé le {formatDate(annulation.le, true)} — motif : <em>{annulation.motif}</em>
        </p>
        <p>L'état des lieux redeviendra valide. Cette action est inscrite au journal.</p>
        <SaisieCode code={code} setCode={setCode} />
        {erreur && <p className="texte-erreur">{erreur}</p>}
        <div className="dialogue-actions">
          <button className="bouton bouton-discret" onClick={onFermer}>
            Fermer
          </button>
          <button className="bouton bouton-principal" disabled={enCours || !code} onClick={() => agir(() => retablirEdl(edl.id, code))}>
            <Undo2 size={20} /> Lever l'annulation
          </button>
        </div>
      </Fenetre>
    )

  return (
    <Fenetre titre="Annuler cet état des lieux signé ?" onFermer={onFermer}>
      <ResumeEdl edl={edl} />
      <p>
        Un état des lieux <strong>signé ne peut pas être supprimé</strong>. Il peut être <strong>annulé</strong> : il reste conservé et consultable, avec son PDF et son empreinte intacts, mais il est signalé « Annulé » et retiré des listes de travail.
      </p>
      {avertissementLies}
      <label className="champ">
        <span className="champ-label">Motif de l'annulation (obligatoire)</span>
        <input className="saisie" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="ex. établi sur le mauvais lot, refait le …" />
      </label>
      <div style={{ marginTop: 12 }}>
        <SaisieCode code={code} setCode={setCode} />
      </div>
      {erreur && <p className="texte-erreur">{erreur}</p>}
      <div className="dialogue-actions">
        <button className="bouton bouton-discret" onClick={onFermer}>
          Fermer
        </button>
        <button className="bouton bouton-danger" disabled={enCours || !motif.trim() || !code} onClick={() => agir(() => annulerEdl(edl.id, motif, code))}>
          <Archive size={20} /> Annuler l'état des lieux
        </button>
      </div>
    </Fenetre>
  )
}

/** Bandeau d'un état des lieux annulé. */
export function BandeauAnnule({ annulation }: { annulation: Annulation }) {
  return (
    <div className="bandeau-annule">
      <Archive size={18} /> <strong>Annulé</strong> le {formatDate(annulation.le, true)} — {annulation.motif}
    </div>
  )
}

/** Demande le code avant une action (suppression définitive…). */
export function DemandeCode(props: { titre: string; message: ReactNode; libelleOk: string; onValider: (code: string) => Promise<void>; onFermer: () => void }) {
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState('')
  return (
    <Fenetre titre={props.titre} onFermer={props.onFermer}>
      <div className="dialogue-message">{props.message}</div>
      <SaisieCode code={code} setCode={setCode} />
      {erreur && <p className="texte-erreur">{erreur}</p>}
      <div className="dialogue-actions">
        <button className="bouton bouton-discret" onClick={props.onFermer}>
          Annuler
        </button>
        <button
          className="bouton bouton-danger"
          disabled={!code}
          onClick={async () => {
            setErreur('')
            try {
              await props.onValider(code)
              props.onFermer()
            } catch (e) {
              setErreur((e as Error).message)
            }
          }}
        >
          {props.libelleOk}
        </button>
      </div>
    </Fenetre>
  )
}
