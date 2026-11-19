import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowRightLeft, Camera, Check, ChevronRight, CircleAlert, FileText, LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { db } from '../db/base'
import { normaliser, progressionGlobale } from '../db/edl'
import { preparationVisite, simulerScission, terminerVisite } from '../db/visite'
import type { Edl, Personne } from '../db/types'
import { formatDate } from '../libelles'
import { Interrupteur, Section } from '../components/ui'
import Chargement from '../components/Chargement'

const nom = (p: Personne) => [p.prenom, p.nom].filter(Boolean).join(' ').trim()
const noms = (l: Personne[]) => l.map(nom).filter(Boolean).join(', ') || 'à renseigner'

/**
 * Fin d'une visite commune : la fiche de travail devient deux états des lieux
 * distincts (sortie et entrée), contrôlés puis signés séparément.
 */
export default function TerminerVisite() {
  const { id } = useParams()
  const navigate = useNavigate()
  const visite = useLiveQuery(async () => {
    const e = id ? await db.edls.get(id) : undefined
    return e ? normaliser(e) : null
  }, [id])
  const nbPhotos = useLiveQuery(() => (id ? db.photos.where('edlId').equals(id).count() : 0), [id])
  const [nomsVerifies, setNomsVerifies] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string>()
  const [resultat, setResultat] = useState<{ idSortie: string; idEntree: string }>()

  if (resultat) return <Resultat {...resultat} />
  if (visite === undefined || nbPhotos === undefined) return <Chargement />
  if (visite === null || !visite.commune) return <Chargement introuvable />

  const { bloquants, rappels } = preparationVisite(visite)
  const simulation = simulerScission(visite)
  const fuites = [...simulation.dansSortie.map((f) => ({ ...f, lieu: f.ou, ou: 'sortie' })), ...simulation.dansEntree.map((f) => ({ ...f, lieu: f.ou, ou: 'entrée' }))]
  const certaines = fuites.filter((f) => f.certaine)
  const aVerifier = fuites.filter((f) => !f.certaine)
  const pct = progressionGlobale(visite)
  const pret = !bloquants.length && !certaines.length && (!aVerifier.length || nomsVerifies) && !enCours
  const cles = (e: Edl) => (e.cles ?? []).reduce((n, c) => n + c.nombre, 0)
  const notes = (champ: 'noteSortie' | 'noteEntree') => visite.pieces.flatMap((p) => p.elements).filter((el) => el[champ]?.trim()).length

  async function terminer() {
    setEnCours(true)
    setErreur(undefined)
    try {
      setResultat(await terminerVisite(visite!.id, nomsVerifies))
      window.scrollTo({ top: 0 })
    } catch (e) {
      setErreur((e as Error).message)
      setEnCours(false)
    }
  }

  return (
    <div className="saisie-piece">
      <div className="tdb-entete">
        <button className="bouton-icone" onClick={() => navigate(`/edl/${visite.id}`)} aria-label="Retour à la visite">
          <ArrowLeft />
        </button>
        <div className="tdb-titre">
          <span className="reference">{visite.reference}</span>
          <h1>
            <ArrowRightLeft size={24} style={{ verticalAlign: '-3px' }} /> Terminer la visite
          </h1>
          <p className="texte-doux">
            Visite du {formatDate(visite.dateVisite, true)} · saisie complète à {pct} %
          </p>
        </div>
      </div>

      {bloquants.length > 0 && (
        <div className="fuite">
          <CircleAlert size={18} /> <strong>À compléter avant de terminer :</strong> {bloquants.join(', ')}.{' '}
          <button className="bouton bouton-discret bouton-petit" onClick={() => navigate(`/edl/${visite.id}/infos?etape=2`)}>
            Compléter les parties <ChevronRight size={16} />
          </button>
        </div>
      )}
      {rappels.length > 0 && (
        <p className="attention">
          <CircleAlert size={16} /> Rappel : {rappels.join(', ')} (modifiable ensuite dans l'état des lieux de sortie).
        </p>
      )}

      <Section titre="Les deux documents qui seront créés">
        <div className="documents-visite">
          <div className="carte document-visite">
            <h3>
              <LogOut size={20} /> A — État des lieux de sortie
            </h3>
            <ul>
              <li>
                Locataire sortant : <strong>{noms(visite.locataires)}</strong>
              </li>
              <li>Représentant du bailleur : {visite.operateur.nom || 'à renseigner'}</li>
              <li>{visite.edlEntreeId ? 'Comparatif avec l’état des lieux d’entrée précédent' : 'Sans comparatif (aucune entrée dans l’application)'}</li>
              <li>Clés restituées : {cles(simulation.sortie)}</li>
              {notes('noteSortie') > 0 && <li>{notes('noteSortie')} observation(s) propre(s) à la sortie</li>}
            </ul>
          </div>
          <div className="carte document-visite">
            <h3>
              <LogIn size={20} /> B — État des lieux d'entrée
            </h3>
            <ul>
              <li>
                Locataire entrant : <strong>{noms(visite.commune.entrants)}</strong>
              </li>
              <li>Représentant du bailleur : {visite.operateur.nom || 'à renseigner'}</li>
              <li>Aucune donnée du locataire sortant</li>
              <li>Clés remises : {cles(simulation.entree)}</li>
              {notes('noteEntree') > 0 && <li>{notes('noteEntree')} réserve(s) de l'entrant</li>}
            </ul>
          </div>
        </div>
        <p className="texte-doux">
          <Camera size={16} style={{ verticalAlign: '-3px' }} /> Les constatations, les relevés de compteurs et les {nbPhotos} photo{nbPhotos > 1 ? 's' : ''} sont copiés dans chaque document. Une photo qui ne concerne qu'un locataire peut ensuite être retirée de l'autre document, avant sa signature.
        </p>
      </Section>

      <Section titre="Contrôle de confidentialité">
        {fuites.length === 0 ? (
          <p>
            <ShieldCheck size={18} style={{ verticalAlign: '-4px', color: 'var(--succes-texte)' }} /> Aucune coordonnée d'un locataire n'a été trouvée dans le document de l'autre (noms, téléphones, e-mails, nouvelle adresse).
          </p>
        ) : (
          <>
            {certaines.length > 0 && (
              <div className="fuite">
                <strong>À retirer avant de terminer :</strong>
                <ul>
                  {certaines.map((f, i) => (
                    <li key={i}>
                      {f.texte} — dans « {f.lieu} » (repris dans l'{f.ou === 'sortie' ? 'état des lieux de sortie' : "état des lieux d'entrée"})
                    </li>
                  ))}
                </ul>
                Ces textes (commentaires, observations communes) figurent dans les deux documents : retirez-y ces coordonnées.
              </div>
            )}
            {aVerifier.length > 0 && (
              <div className="carte rubrique-carte">
                <p style={{ marginTop: 0 }}>
                  <CircleAlert size={16} /> <strong>À vérifier :</strong>{' '}
                  {aVerifier.map((f) => `${f.texte} — dans « ${f.lieu} » (${f.ou})`).join(' ; ')}. Ce mot apparaît dans un texte du document : c'est peut-être un mot courant (rue, élément…), ou le nom saisi par erreur dans un commentaire.
                </p>
                <Interrupteur libelle="J'ai vérifié : ce n'est pas une donnée de l'autre locataire" valeur={nomsVerifies} onChange={setNomsVerifies} />
              </div>
            )}
          </>
        )}
      </Section>

      <Section titre="Et ensuite">
        <ul className="texte-doux">
          <li>La fiche de visite est remplacée par les deux états des lieux ; l'opération est inscrite au journal.</li>
          <li>Chaque document se relit et se signe séparément : le représentant du bailleur signe les deux, sans recopie de signature.</li>
          <li>Jusqu'à sa signature, chaque document reste modifiable ; une correction faite dans l'un ne se reporte pas dans l'autre.</li>
        </ul>
        {erreur && <p className="texte-erreur">{erreur}</p>}
        <button className="bouton bouton-accent bouton-signer" disabled={!pret} onClick={terminer}>
          <Check size={22} /> {enCours ? 'Création en cours…' : 'Terminer la visite et créer les deux documents'}
        </button>
      </Section>
    </div>
  )
}

function Resultat({ idSortie, idEntree }: { idSortie: string; idEntree: string }) {
  const navigate = useNavigate()
  const docs = useLiveQuery(async () => ({ sortie: await db.edls.get(idSortie), entree: await db.edls.get(idEntree) }), [idSortie, idEntree])
  if (!docs?.sortie || !docs.entree) return <Chargement />
  const tuile = (e: Edl, Icone: typeof LogIn, titre: string) => (
    <button className="carte tuile-ligne" style={{ marginBottom: 12 }} onClick={() => navigate(`/edl/${e.id}`)}>
      <span className="tuile-ligne-icone">
        <Icone size={22} />
      </span>
      <span className="tuile-ligne-texte">
        <strong>
          {titre} — {e.reference}
        </strong>
        <span className="texte-doux">{noms(e.locataires)} · relire, puis faire signer</span>
      </span>
      <ChevronRight />
    </button>
  )
  return (
    <div className="saisie-piece">
      <div className="tdb-entete">
        <div className="tdb-titre">
          <h1>
            <FileText size={24} style={{ verticalAlign: '-3px' }} /> Deux états des lieux créés
          </h1>
          <p className="texte-doux">Chacun se signe séparément, avec ses propres parties et sa propre empreinte.</p>
        </div>
      </div>
      {tuile(docs.sortie, LogOut, 'A — Sortie')}
      {tuile(docs.entree, LogIn, 'B — Entrée')}
      <button className="bouton bouton-discret" onClick={() => navigate('/')}>
        Retour à l'accueil
      </button>
    </div>
  )
}
