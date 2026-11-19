import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, ChevronRight, Copy, Fingerprint, Loader2, Lock, LogIn, LogOut, ShieldCheck, ShieldAlert } from 'lucide-react'
import { db } from '../db/base'
import { normaliser } from '../db/edl'
import { empreinteLisible, signatairesAttendus, signerEdl, type SignatureSaisie } from '../db/cloture'
import { controlerPdfsLies } from '../db/confidentialite'
import type { Edl, Signataire } from '../db/types'
import { formatDate } from '../libelles'
import { Champ, Confirmation, Interrupteur, Section } from '../components/ui'
import PaveSignature from '../components/PaveSignature'
import ControleConfidentialite from '../components/ControleConfidentialite'
import Chargement from '../components/Chargement'

type Saisies = Record<string, SignatureSaisie>

/**
 * Signature des deux états des lieux d'une visite commune, en une fois :
 *  - A (sortie) : locataire(s) sortant(s) + représentant du bailleur ;
 *  - B (entrée) : locataire(s) entrant(s) + représentant du bailleur.
 * Le représentant signe chaque document. Il peut reprendre sa signature de la
 * sortie pour l'entrée, mais seulement par une validation explicite (jamais automatiquement).
 * Chaque document est scellé séparément, avec sa propre empreinte.
 */
export default function SignerVisite() {
  const { id } = useParams()
  const navigate = useNavigate()
  const docs = useLiveQuery(async () => {
    const e = id ? await db.edls.get(id) : undefined
    if (!e?.issuDeVisite) return null
    const autre = await db.edls.get(e.issuDeVisite.autreId)
    if (!autre) return null
    const [sortie, entree] = e.typeActe === 'sortie' ? [e, autre] : [autre, e]
    return { sortie: normaliser(sortie), entree: normaliser(entree) }
  }, [id])
  const [saisies, setSaisies] = useState<Saisies>({})
  const [lieu, setLieu] = useState<string>()
  const [reprendre, setReprendre] = useState(false)
  const [certifie, setCertifie] = useState(false)
  const [controleOk, setControleOk] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string>()
  const [fin, setFin] = useState<{ sortie: Edl; entree: Edl; fuites: number } | null>(null)

  if (fin) return <Resultat {...fin} />
  if (docs === undefined) return <Chargement />
  if (docs === null) return <Chargement introuvable />
  const { sortie: A, entree: B } = docs
  const dejaSigne = [A, B].filter((d) => d.statut === 'signe')
  if (dejaSigne.length || A.corbeille || B.corbeille)
    return (
      <div className="saisie-piece">
        <Entete onRetour={() => navigate(-1)} />
        <p>
          {dejaSigne.length
            ? `${dejaSigne.map((d) => d.reference).join(' et ')} ${dejaSigne.length > 1 ? 'sont déjà signés' : 'est déjà signé'} : la signature groupée n'est plus possible.`
            : "Un des deux documents est dans la corbeille : la signature groupée n'est pas possible."}
        </p>
        {[A, B]
          .filter((d) => d.statut !== 'signe' && !d.corbeille)
          .map((d) => (
            <button key={d.id} className="bouton bouton-principal" onClick={() => navigate(`/edl/${d.id}/signature`)}>
              Signer {d.reference} seul <ChevronRight size={20} />
            </button>
          ))}
      </div>
    )

  const lieuSignature = lieu ?? A.lieuSignature ?? A.bien.ville
  const cle = (d: Edl, s: Signataire) => `${d.id}:${s.id}`
  const saisie = (d: Edl, s: Signataire): SignatureSaisie => saisies[cle(d, s)] ?? { signataire: s }
  const maj = (d: Edl, s: Signataire, m: Partial<SignatureSaisie>) => setSaisies((x) => ({ ...x, [cle(d, s)]: { ...saisie(d, s), ...m } }))
  const attendusA = signatairesAttendus(A)
  const attendusB = signatairesAttendus(B)
  const repA = attendusA[0]
  const repB = attendusB[0]
  const imageRepA = saisie(A, repA).image
  // Signature du représentant pour l'entrée : tracée à nouveau, ou reprise de la sortie sur validation explicite.
  const saisiesFinales = (d: Edl, attendus: Signataire[]): SignatureSaisie[] =>
    attendus.map((s) => (d === B && s.role === 'bailleur' && reprendre && imageRepA ? { signataire: s, image: imageRepA, reprise: A.reference } : saisie(d, s)))
  const complet = (v: SignatureSaisie) => (v.signataire.role === 'locataire' && v.absent) || !!v.image
  const manquantes = [...saisiesFinales(A, attendusA).map((v) => ({ v, d: A })), ...saisiesFinales(B, attendusB).map((v) => ({ v, d: B }))].filter((x) => !complet(x.v))
  const sansLocataire = [A, B].filter((d) => !d.locataires.some((l) => l.nom.trim()))
  const pret = !manquantes.length && !sansLocataire.length && certifie && controleOk && !enCours

  async function signer() {
    setConfirmer(false)
    setEnCours(true)
    setErreur(undefined)
    try {
      const a = normaliser((await db.edls.get(A.id))!)
      const b = normaliser((await db.edls.get(B.id))!)
      const signeA = await signerEdl(a, saisiesFinales(A, attendusA), lieuSignature)
      const signeB = await signerEdl(b, saisiesFinales(B, attendusB), lieuSignature)
      // Second contrôle, sur les PDF définitifs (signés).
      const r = await controlerPdfsLies(signeA, signeB)
      setFin({ sortie: signeA, entree: signeB, fuites: r[signeA.id].length + r[signeB.id].length })
      window.scrollTo({ top: 0 })
    } catch (e) {
      setErreur('La signature n’a pas pu être enregistrée : ' + (e as Error).message)
      setEnCours(false)
    }
  }

  const pave = (d: Edl, s: Signataire) => {
    const v = saisie(d, s)
    const ok = complet(v)
    return (
      <div key={cle(d, s)} className={`carte signataire ${ok ? 'signataire-ok' : ''}`}>
        <div className="signataire-entete">
          <div>
            <strong>{s.nom}</strong>
            <span className="texte-doux">{s.qualite}</span>
          </div>
          {ok && (
            <span className="statut-rubrique statut-ok">
              <Check size={15} strokeWidth={3} /> {v.absent ? 'Absent' : 'Signé'}
            </span>
          )}
        </div>
        {!v.absent && <PaveSignature onChange={(image) => maj(d, s, { image: image ?? undefined })} />}
        {s.role === 'locataire' && (
          <>
            <Interrupteur libelle="Absent ou refusant de signer" valeur={!!v.absent} onChange={(x) => maj(d, s, { absent: x, image: x ? undefined : v.image })} />
            {v.absent && <Champ label="Précision (figurera au rapport)" valeur={v.motif} onChange={(m) => maj(d, s, { motif: m })} />}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="saisie-piece">
      <Entete onRetour={() => navigate(-1)} />
      <p className="texte-doux">
        Visite commune {A.issuDeVisite?.reference} · {A.bien.adresse}, {A.bien.ville}. Chaque document est signé et scellé séparément ; aucune signature n'est recopiée d'un document à l'autre sans votre accord.
      </p>

      <div className="actions-rapides" style={{ marginBottom: 12 }}>
        <button className="bouton bouton-discret" onClick={() => navigate(`/edl/${A.id}/signature`)}>
          <LogOut size={18} /> Relire la sortie {A.reference}
        </button>
        <button className="bouton bouton-discret" onClick={() => navigate(`/edl/${B.id}/signature`)}>
          <LogIn size={18} /> Relire l'entrée {B.reference}
        </button>
      </div>

      <Section titre="Confidentialité">
        <ControleConfidentialite a={A} b={B} onPret={setControleOk} />
      </Section>

      <Section titre="Lieu et date">
        <div className="carte rubrique-carte">
          <Champ label="Fait à" valeur={lieuSignature} onChange={setLieu} placeholder="Ville" />
          <p className="texte-doux" style={{ margin: '8px 0 0' }}>
            Le {formatDate(new Date().toISOString(), true)}, pour les deux documents.
          </p>
        </div>
      </Section>

      <Section titre={`A — Sortie ${A.reference}`}>
        {sansLocataire.includes(A) && <p className="dictee-erreur">Aucun locataire sortant n'est renseigné.</p>}
        {attendusA.filter((s) => s.role === 'locataire').map((s) => pave(A, s))}
        {pave(A, repA)}
      </Section>

      <Section titre={`B — Entrée ${B.reference}`}>
        {sansLocataire.includes(B) && <p className="dictee-erreur">Aucun locataire entrant n'est renseigné.</p>}
        {attendusB.filter((s) => s.role === 'locataire').map((s) => pave(B, s))}
        {!reprendre && pave(B, repB)}
        <div className={`carte signataire ${reprendre && imageRepA ? 'signataire-ok' : ''}`}>
          {reprendre && (
            <div className="signataire-entete">
              <div>
                <strong>{repB.nom}</strong>
                <span className="texte-doux">{repB.qualite}</span>
              </div>
              {imageRepA && (
                <span className="statut-rubrique statut-ok">
                  <Copy size={15} /> Signature reprise
                </span>
              )}
            </div>
          )}
          <Interrupteur
            libelle={`${repB.nom} reprend sa signature de la sortie pour l'entrée`}
            valeur={reprendre}
            onChange={(x) => {
              setReprendre(x)
              if (x) maj(B, repB, { image: undefined })
            }}
          />
          <p className="texte-doux" style={{ margin: '6px 0 0' }}>
            {!reprendre
              ? "Par défaut, le représentant signe à nouveau. Activez la reprise seulement s'il le demande."
              : imageRepA
                ? `Validation explicite : la signature tracée pour la sortie est apposée aussi sur l'entrée. Le rapport le mentionne (« signature reprise de l'état des lieux ${A.reference} »).`
                : "Le représentant doit d'abord signer la sortie (ci-dessus)."}
          </p>
        </div>
      </Section>

      <Section titre="Validation">
        <label className="certification">
          <input type="checkbox" checked={certifie} onChange={(e) => setCertifie(e.target.checked)} />
          <span>
            Pour chacun des deux documents, les parties qui le signent déclarent avoir pris connaissance du présent état des lieux, établi contradictoirement, et en reconnaissent l'exactitude.
          </span>
        </label>
        {erreur && <p className="dictee-erreur">{erreur}</p>}
        <button className="bouton bouton-accent bouton-signer" disabled={!pret} onClick={() => setConfirmer(true)}>
          {enCours ? <Loader2 size={22} className="tourne" /> : <Lock size={22} />} {enCours ? 'Signature en cours…' : 'Signer et verrouiller les deux documents'}
        </button>
        {!pret && !enCours && (
          <p className="texte-doux" style={{ textAlign: 'center' }}>
            {!controleOk
              ? 'Attendez la fin du contrôle anti-fuite (ou corrigez ce qu’il signale).'
              : manquantes.length
                ? `Signature${manquantes.length > 1 ? 's' : ''} attendue${manquantes.length > 1 ? 's' : ''} : ${manquantes.map((m) => `${m.v.signataire.nom} (${m.d.typeActe === 'sortie' ? 'sortie' : 'entrée'})`).join(', ')}.`
                : sansLocataire.length
                  ? 'Complétez les locataires.'
                  : 'Cochez la déclaration ci-dessus.'}
          </p>
        )}
      </Section>

      <Confirmation
        ouvert={confirmer}
        titre="Signer et verrouiller les deux documents ?"
        message={
          <>
            La sortie {A.reference} puis l'entrée {B.reference} seront signées. Ensuite, <strong>plus aucune modification n'est possible</strong> : chacun reçoit sa propre empreinte numérique.
          </>
        }
        libelleOk="Signer définitivement"
        onAnnuler={() => setConfirmer(false)}
        onOk={signer}
      />
    </div>
  )
}

function Entete({ onRetour }: { onRetour: () => void }) {
  return (
    <div className="tdb-entete">
      <button className="bouton-icone" onClick={onRetour} aria-label="Retour">
        <ArrowLeft />
      </button>
      <div className="tdb-titre">
        <h1>Signer la sortie et l'entrée</h1>
      </div>
    </div>
  )
}

function Resultat({ sortie, entree, fuites }: { sortie: Edl; entree: Edl; fuites: number }) {
  const navigate = useNavigate()
  return (
    <div className="saisie-piece">
      <div className="tdb-entete">
        <div className="tdb-titre">
          <h1>
            <Lock size={24} style={{ verticalAlign: '-3px' }} /> Deux états des lieux signés
          </h1>
        </div>
      </div>
      {fuites === 0 ? (
        <p>
          <span className="statut-rubrique statut-ok">
            <ShieldCheck size={16} /> Contrôle anti-fuite des PDF signés réussi
          </span>
        </p>
      ) : (
        <p className="fuite">
          <ShieldAlert size={16} /> Le contrôle des PDF signés signale {fuites} élément(s) : ouvrez chaque document et vérifiez son PDF avant de le remettre.
        </p>
      )}
      {[sortie, entree].map((e) => (
        <button key={e.id} className="carte tuile-ligne" style={{ marginBottom: 12 }} onClick={() => navigate(`/edl/${e.id}/signature`)}>
          <span className="tuile-ligne-icone">{e.typeActe === 'sortie' ? <LogOut size={22} /> : <LogIn size={22} />}</span>
          <span className="tuile-ligne-texte">
            <strong>
              {e.typeActe === 'sortie' ? 'A — Sortie' : 'B — Entrée'} {e.reference}
            </strong>
            <span className="texte-doux">
              <Fingerprint size={14} /> {empreinteLisible(e.cloture!.empreinte).slice(0, 19)}… · ouvrir pour remettre le PDF au locataire
            </span>
          </span>
          <ChevronRight />
        </button>
      ))}
      <button className="bouton bouton-discret" onClick={() => navigate('/')}>
        Retour à l'accueil
      </button>
    </div>
  )
}
