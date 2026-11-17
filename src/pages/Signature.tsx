import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlarmSmoke,
  ArrowLeft,
  Camera,
  Check,
  CircleAlert,
  ClipboardList,
  Fingerprint,
  Gauge,
  KeyRound,
  Loader2,
  Lock,
  PenLine,
  ShieldCheck,
  ShieldAlert,
  UserX,
} from 'lucide-react'
import { db } from '../db/base'
import { useEdl } from '../hooks/useEdl'
import { compteurFait, etatRubriques, infosManquantes, normaliser, progressionPiece } from '../db/edl'
import { empreinteLisible, signatairesAttendus, signerEdl, verifierEmpreinte, type SignatureSaisie } from '../db/cloture'
import type { Edl, Signataire } from '../db/types'
import { LIBELLE_ACTE, formatDate } from '../libelles'
import { Champ, Confirmation, Interrupteur, Section } from '../components/ui'
import { BoutonDictee } from '../components/Dictee'
import PaveSignature from '../components/PaveSignature'
import BoutonsRapport from '../components/BoutonsRapport'
import Chargement from '../components/Chargement'

/**
 * Clôture d'un état des lieux :
 * 1. récapitulatif et points en attente,
 * 2. remarques du locataire,
 * 3. signatures de chaque partie,
 * 4. signature définitive : l'état des lieux est verrouillé et son empreinte calculée.
 */
export default function Signature() {
  const { id } = useParams()
  // Lecture directe de la base : l'écran bascule seul sur la vue « signé ».
  const enBase = useLiveQuery(async () => (id ? ((await db.edls.get(id)) ?? null) : null), [id])
  if (enBase === undefined) return <Chargement />
  if (enBase === null) return <Chargement introuvable />
  return enBase.statut === 'signe' ? <VueSignee edl={normaliser(enBase)} /> : <AvantSignature id={enBase.id} />
}

function EnTete(props: { edl: Edl; titre: string }) {
  const navigate = useNavigate()
  return (
    <div className="piece-entete">
      <button className="bouton-icone" onClick={() => navigate(`/edl/${props.edl.id}`)} aria-label="Retour au tableau de bord">
        <ArrowLeft />
      </button>
      <div className="piece-entete-titre">
        <div className="titre-modifiable">
          <PenLine size={24} />
          <h1>{props.titre}</h1>
        </div>
        <div className="piece-entete-progression">
          <span>
            {props.edl.reference} · {LIBELLE_ACTE[props.edl.typeActe]}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Récapitulatif (commun aux deux vues)
// ---------------------------------------------------------------------

function Recapitulatif({ edl }: { edl: Edl }) {
  const navigate = useNavigate()
  const nbPhotos = useLiveQuery(() => db.photos.where('edlId').equals(edl.id).count(), [edl.id])
  const pieces = edl.pieces
  const r = etatRubriques(edl)
  const nbCles = (edl.cles ?? []).reduce((n, c) => n + c.nombre, 0)
  const signe = edl.statut === 'signe'

  return (
    <Section titre="Récapitulatif">
      <div className="carte recap">
        <div className="recap-ligne">
          <ClipboardList size={20} />
          <strong>Pièces</strong>
          <div className="recap-detail">
            {pieces.map((p) => {
              const pr = progressionPiece(p)
              const fini = pr.total > 0 && pr.faits === pr.total
              return (
                <button key={p.id} className={`recap-puce ${fini ? 'recap-ok' : 'recap-attente'}`} onClick={() => navigate(`/edl/${edl.id}/piece/${p.id}`)}>
                  {fini ? <Check size={14} strokeWidth={3} /> : <CircleAlert size={14} />} {p.nom} {!fini && `(${pr.faits}/${pr.total})`}
                </button>
              )
            })}
          </div>
        </div>
        <div className="recap-ligne">
          <Gauge size={20} />
          <strong>Compteurs</strong>
          <div className="recap-detail">
            {(edl.compteurs ?? []).map((c) => (
              <button key={c.id} className={`recap-puce ${compteurFait(c) ? 'recap-ok' : 'recap-attente'}`} onClick={() => navigate(`/edl/${edl.id}/compteurs`)}>
                {c.libelle} :{' '}
                {c.nonApplicable ? 'sans objet' : c.index ? `${c.index}${c.indexHC ? ` / HC ${c.indexHC}` : ''}` : 'non relevé'}
                {!c.nonApplicable && c.index && !c.photoIds.length ? ' (sans photo)' : ''}
              </button>
            ))}
          </div>
        </div>
        <div className="recap-ligne">
          <KeyRound size={20} />
          <strong>Clés</strong>
          <div className="recap-detail">
            <button className={`recap-puce ${r.cles ? 'recap-ok' : 'recap-attente'}`} onClick={() => navigate(`/edl/${edl.id}/cles`)}>
              {nbCles ? `${nbCles} remise${nbCles > 1 ? 's' : ''} : ${(edl.cles ?? []).filter((c) => c.nombre > 0).map((c) => `${c.nombre} ${c.libelle}`).join(', ')}` : 'Aucune clé indiquée'}
            </button>
          </div>
        </div>
        {r.detecteur !== null && (
          <div className="recap-ligne">
            <AlarmSmoke size={20} />
            <strong>Détecteur</strong>
            <div className="recap-detail">
              <button className={`recap-puce ${r.detecteur ? 'recap-ok' : 'recap-attente'}`} onClick={() => navigate(`/edl/${edl.id}/detecteur`)}>
                {edl.detecteur?.present === false ? 'Absent' : edl.detecteur?.fonctionnement === 'ok' ? 'Présent, fonctionne' : edl.detecteur?.fonctionnement ? 'Présent, à vérifier' : 'Non renseigné'}
              </button>
            </div>
          </div>
        )}
        <div className="recap-ligne">
          <Camera size={20} />
          <strong>Photos</strong>
          <div className="recap-detail">
            <span className="recap-puce recap-neutre">{nbPhotos ?? '…'} photo{(nbPhotos ?? 0) > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
      {!signe && <PointsEnAttente edl={edl} />}
    </Section>
  )
}

function pointsEnAttente(edl: Edl): string[] {
  const p: string[] = [...infosManquantes(edl)]
  for (const piece of edl.pieces) {
    const pr = progressionPiece(piece)
    if (pr.faits < pr.total) p.push(`${piece.nom} : ${pr.total - pr.faits} élément${pr.total - pr.faits > 1 ? 's' : ''} sans état`)
  }
  for (const c of edl.compteurs ?? []) if (!compteurFait(c)) p.push(`Compteur ${c.libelle.toLowerCase()} : ${c.index ? 'photo de l’index manquante' : 'non relevé'}`)
  const r = etatRubriques(edl)
  if (!r.cles) p.push('Aucune clé remise indiquée')
  if (r.detecteur === false) p.push('Détecteur de fumée non renseigné')
  return p
}

function PointsEnAttente({ edl }: { edl: Edl }) {
  const p = pointsEnAttente(edl)
  if (!p.length)
    return (
      <p className="recap-complet">
        <Check size={18} strokeWidth={3} /> Tout est complet.
      </p>
    )
  return (
    <div className="carte recap-attente-liste">
      <strong>
        <CircleAlert size={18} /> {p.length} point{p.length > 1 ? 's' : ''} en attente
      </strong>
      <ul>
        {p.slice(0, 12).map((x) => (
          <li key={x}>{x}</li>
        ))}
        {p.length > 12 && <li>… et {p.length - 12} autre(s)</li>}
      </ul>
      <span className="texte-doux">Vous pouvez signer malgré tout : ces points apparaîtront comme non renseignés dans le rapport.</span>
    </div>
  )
}

// ---------------------------------------------------------------------
// Avant signature
// ---------------------------------------------------------------------

function AvantSignature({ id }: { id: string }) {
  const { edl, modifier, enregistrerMaintenant } = useEdl(id)
  const [saisies, setSaisies] = useState<Record<string, SignatureSaisie>>({})
  const [certifie, setCertifie] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string>()

  if (edl === undefined) return <Chargement />
  if (edl === null) return <Chargement introuvable />

  const attendus = signatairesAttendus(edl)
  const saisie = (s: Signataire): SignatureSaisie => saisies[s.id] ?? { signataire: s }
  const maj = (s: Signataire, m: Partial<SignatureSaisie>) => setSaisies((x) => ({ ...x, [s.id]: { ...saisie(s), ...m } }))
  const complet = (s: Signataire) => {
    const v = saisie(s)
    return s.role === 'locataire' && v.absent ? true : !!v.image
  }
  const manquantes = attendus.filter((s) => !complet(s))
  const pret = manquantes.length === 0 && certifie && attendus.some((s) => s.role === 'locataire')
  const preneur = edl.typeBien === 'local' ? 'preneur' : 'locataire'

  async function signer() {
    if (!edl) return
    setConfirmer(false)
    setEnCours(true)
    setErreur(undefined)
    try {
      await enregistrerMaintenant() // les dernières saisies d'abord
      await signerEdl(normaliser((await db.edls.get(edl.id))!), attendus.map(saisie), edl.lieuSignature ?? edl.bien.ville)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setErreur('La signature n’a pas pu être enregistrée : ' + (e as Error).message)
      setEnCours(false)
    }
  }

  return (
    <div className="saisie-piece">
      <EnTete edl={edl} titre="Récapitulatif et signatures" />
      <Recapitulatif edl={edl} />
      <BoutonsRapport edl={edl} />

      <Section titre={`Remarques du ${preneur}`}>
        <div className="carte rubrique-carte">
          <div className="bloc-titre">
            Réserves ou remarques que le {preneur} souhaite faire figurer
            <BoutonDictee onTexte={(t) => modifier((e) => void (e.remarquesLocataire = e.remarquesLocataire ? `${e.remarquesLocataire} ${t}` : t))} />
          </div>
          <textarea
            className="saisie"
            rows={3}
            value={edl.remarquesLocataire ?? ''}
            placeholder="Aucune remarque"
            onChange={(ev) => modifier((e) => void (e.remarquesLocataire = ev.target.value || undefined))}
          />
        </div>
      </Section>

      <Section titre="Signatures">
        <div className="carte rubrique-carte">
          <Champ label="Fait à" valeur={edl.lieuSignature ?? edl.bien.ville} onChange={(v) => modifier((e) => void (e.lieuSignature = v))} placeholder="Ville" />
          <p className="texte-doux" style={{ margin: '8px 0 0' }}>
            Le {formatDate(new Date().toISOString(), true)}, en autant d'exemplaires que de parties.
          </p>
        </div>

        {attendus.length === 1 && (
          <p className="dictee-erreur">Aucun {preneur} n'est renseigné : complétez les informations générales avant de signer.</p>
        )}

        {attendus.map((s) => {
          const v = saisie(s)
          return (
            <div key={s.id} className={`carte signataire ${complet(s) ? 'signataire-ok' : ''}`}>
              <div className="signataire-entete">
                <div>
                  <strong>{s.nom}</strong>
                  <span className="texte-doux">{s.qualite}</span>
                </div>
                {complet(s) && (
                  <span className="statut-rubrique statut-ok">
                    <Check size={15} strokeWidth={3} /> {v.absent ? 'Absent' : 'Signé'}
                  </span>
                )}
              </div>
              {!v.absent && <PaveSignature onChange={(image) => maj(s, { image: image ?? undefined })} />}
              {s.role === 'locataire' && (
                <>
                  <Interrupteur libelle={`${preneur === 'preneur' ? 'Preneur' : 'Locataire'} absent ou refusant de signer`} valeur={!!v.absent} onChange={(a) => maj(s, { absent: a, image: a ? undefined : v.image })} />
                  {v.absent && (
                    <Champ label="Précision (figurera au rapport)" valeur={v.motif} onChange={(m) => maj(s, { motif: m })} placeholder="Ex. : absent malgré convocation du 12/11, refus de signer…" />
                  )}
                </>
              )}
            </div>
          )
        })}

        <label className="certification">
          <input type="checkbox" checked={certifie} onChange={(e) => setCertifie(e.target.checked)} />
          <span>
            Les parties déclarent avoir pris connaissance du présent état des lieux, établi contradictoirement, et en reconnaissent l'exactitude.
          </span>
        </label>

        {erreur && <p className="dictee-erreur">{erreur}</p>}

        <button className="bouton bouton-accent bouton-signer" disabled={!pret || enCours} onClick={() => setConfirmer(true)}>
          {enCours ? <Loader2 size={22} className="tourne" /> : <Lock size={22} />} {enCours ? 'Signature en cours…' : 'Signer et verrouiller'}
        </button>
        {!pret && !enCours && (
          <p className="texte-doux" style={{ textAlign: 'center' }}>
            {manquantes.length ? `Signature${manquantes.length > 1 ? 's' : ''} attendue${manquantes.length > 1 ? 's' : ''} : ${manquantes.map((m) => m.nom).join(', ')}.` : 'Cochez la déclaration ci-dessus.'}
          </p>
        )}
      </Section>

      <Confirmation
        ouvert={confirmer}
        titre="Signer et verrouiller ?"
        message={
          <>
            Une fois signé, l'état des lieux <strong>ne pourra plus être modifié</strong> : saisies, photos et signatures sont figées et protégées par une empreinte numérique.
          </>
        }
        libelleOk="Signer définitivement"
        onAnnuler={() => setConfirmer(false)}
        onOk={signer}
      />
    </div>
  )
}

// ---------------------------------------------------------------------
// Après signature
// ---------------------------------------------------------------------

function ImageSignature({ id }: { id: string }) {
  const blob = useLiveQuery(async () => (await db.signatures.get(id))?.image, [id])
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <img className="signature-image" src={url} alt="Signature" /> : null
}

function VueSignee({ edl }: { edl: Edl }) {
  const [integre, setIntegre] = useState<boolean | null>(null)
  useEffect(() => {
    verifierEmpreinte(edl).then(setIntegre)
  }, [edl])
  const c = edl.cloture!

  return (
    <div className="saisie-piece">
      <EnTete edl={edl} titre="État des lieux signé" />

      <div className="carte signe-bandeau">
        <Lock size={28} />
        <div>
          <strong>Signé et verrouillé</strong>
          <span>
            Le {formatDate(c.signeLe, true)}
            {edl.lieuSignature ? `, à ${edl.lieuSignature}` : ''}. Plus aucune modification n'est possible.
          </span>
        </div>
      </div>

      <BoutonsRapport edl={edl} />

      <Section titre="Signatures">
        <div className="signatures-grille">
          {(edl.signataires ?? []).map((s) => (
            <div key={s.id} className="carte signataire">
              <strong>{s.nom}</strong>
              <span className="texte-doux">{s.qualite}</span>
              {s.signatureId ? (
                <ImageSignature id={s.signatureId} />
              ) : (
                <p className="signataire-absent">
                  <UserX size={18} /> {s.absent ? `Absent ou refus de signer${s.motifAbsence ? ` : ${s.motifAbsence}` : ''}` : 'Non signé'}
                </p>
              )}
            </div>
          ))}
        </div>
        {edl.remarquesLocataire && (
          <div className="carte rubrique-carte">
            <strong>Remarques du {edl.typeBien === 'local' ? 'preneur' : 'locataire'}</strong>
            <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{edl.remarquesLocataire}</p>
          </div>
        )}
      </Section>

      <Section titre="Preuve d'intégrité">
        <div className="carte rubrique-carte empreinte">
          <div className="empreinte-titre">
            <Fingerprint size={20} /> Empreinte SHA-256
          </div>
          <code>{empreinteLisible(c.empreinte)}</code>
          {integre === null ? (
            <span className="texte-doux">
              <Loader2 size={16} className="tourne" /> Vérification…
            </span>
          ) : integre ? (
            <span className="statut-rubrique statut-ok">
              <ShieldCheck size={16} /> Contenu intact depuis la signature
            </span>
          ) : (
            <span className="statut-rubrique statut-alerte">
              <ShieldAlert size={16} /> Le contenu ne correspond plus à l'empreinte
            </span>
          )}
          <p className="texte-doux" style={{ margin: 0 }}>
            Ce code résume toutes les saisies, photos et signatures. Il figurera sur le rapport PDF : la moindre retouche le rendrait différent.
          </p>
        </div>
      </Section>

      <Recapitulatif edl={edl} />


    </div>
  )
}
