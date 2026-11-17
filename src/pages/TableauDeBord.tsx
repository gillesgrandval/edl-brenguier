import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardList,
  PenLine,
  Trash2,
  CircleAlert,
  Building2,
  Gauge,
  Lock,
} from 'lucide-react'
import { db } from '../db/base'
import type { Edl } from '../db/types'
import { adresseCourte, compteurFait, infosManquantes, nomsLocataires, progressionGlobale, normaliser, progressionPiece, supprimerEdl } from '../db/edl'
import { LIBELLE_ACTE, LIBELLE_BIEN, formatDate } from '../libelles'
import { Badge, BarreProgression, Confirmation, Section } from '../components/ui'
import Chargement from '../components/Chargement'
import { ICONE_BIEN } from '../components/icones'
import BlocPieces from '../components/BlocPieces'
import BlocRubriques from '../components/BlocRubriques'
import BoutonsRapport from '../components/BoutonsRapport'
import { bienDepuisEdl } from '../db/patrimoine'

/** Vue d'ensemble d'un état des lieux : on y voit d'un coup d'œil ce qui reste à faire. */
export default function TableauDeBord() {
  const { id } = useParams()
  const navigate = useNavigate()
  const edl = useLiveQuery(async () => {
    const e = id ? await db.edls.get(id) : undefined
    return e ? normaliser(e) : null
  }, [id])
  const [confirmer, setConfirmer] = useState(false)

  if (edl === undefined) return <Chargement />
  if (edl === null) return <Chargement introuvable />

  const pct = progressionGlobale(edl)
  const manque = infosManquantes(edl)
  const pieces = edl.pieces.filter((p) => p.modele !== 'mobilier')
  const piecesFinies = pieces.filter((p) => {
    const pr = progressionPiece(p)
    return pr.total > 0 && pr.faits === pr.total
  }).length
  const Icone = ICONE_BIEN[edl.typeBien]

  return (
    <>
      <div className="tdb-entete">
        <button className="bouton-icone" onClick={() => navigate('/')} aria-label="Retour à l'accueil">
          <ArrowLeft />
        </button>
        <div className="tdb-titre">
          <div className="carte-edl-haut">
            <span className="reference">{edl.reference}</span>
            <Badge ton={edl.typeActe === 'sortie' ? 'bronze' : 'encre'}>{LIBELLE_ACTE[edl.typeActe]}</Badge>
            <Badge>
              <Icone size={14} /> {LIBELLE_BIEN[edl.typeBien]}
              {edl.meuble ? ' meublé' : ''}
            </Badge>
          </div>
          <h1>{adresseCourte(edl)}</h1>
          <p className="texte-doux">
            {nomsLocataires(edl)} · {formatDate(edl.dateVisite, true)}
          </p>
        </div>
      </div>

      <div className="carte tdb-progression">
        <div className="tdb-pourcent">
          {pct}
          <small>%</small>
        </div>
        <div style={{ flex: 1 }}>
          <BarreProgression pourcent={pct} />
          <p className="texte-doux" style={{ margin: '10px 0 0' }}>
            {piecesFinies} pièce{piecesFinies > 1 ? 's' : ''} terminée{piecesFinies > 1 ? 's' : ''} sur {pieces.length}
            {manque.length > 0 ? ` · ${manque.length} information${manque.length > 1 ? 's' : ''} à compléter` : ''}
          </p>
        </div>
      </div>

      {edl.statut !== 'signe' && (
        <Rappels edl={edl} onOuvrir={(chemin) => navigate(`/edl/${edl.id}/${chemin}`)} />
      )}

      <Section titre="Informations générales">
        <button className={`carte tuile-ligne ${manque.length === 0 ? 'tuile-ligne-ok' : ''}`} onClick={() => navigate(`/edl/${edl.id}/infos`)}>
          <span className="tuile-ligne-icone">{manque.length === 0 ? <Check size={22} strokeWidth={3} /> : <ClipboardList size={22} />}</span>
          <span className="tuile-ligne-texte">
            <strong>Bien, parties, date et énergies</strong>
            <span className={manque.length ? 'attention' : 'texte-doux'}>
              {manque.length ? (
                <>
                  <CircleAlert size={15} /> À compléter : {manque.join(', ')}
                </>
              ) : (
                'Complètes'
              )}
            </span>
          </span>
          <ChevronRight />
        </button>
      </Section>

      {!edl.bienId && edl.statut !== 'signe' && edl.bien.adresse.trim() && (
        <button
          className="carte tuile-ligne"
          style={{ marginBottom: 12 }}
          onClick={async () => {
            const id = await bienDepuisEdl(edl)
            navigate(`/patrimoine/${id}`)
          }}
        >
          <span className="tuile-ligne-icone">
            <Building2 size={22} />
          </span>
          <span className="tuile-ligne-texte">
            <strong>Enregistrer ce bien dans le patrimoine</strong>
            <span className="texte-doux">Adresse et pièces réutilisées pour les prochains états des lieux</span>
          </span>
          <ChevronRight />
        </button>
      )}
      {edl.bienId && (
        <button className="carte tuile-ligne" style={{ marginBottom: 12 }} onClick={() => navigate(`/patrimoine/${edl.bienId}`)}>
          <span className="tuile-ligne-icone">
            <Building2 size={22} />
          </span>
          <span className="tuile-ligne-texte">
            <strong>Fiche du bien</strong>
            <span className="texte-doux">Caractéristiques permanentes et historique des états des lieux</span>
          </span>
          <ChevronRight />
        </button>
      )}

      <BlocPieces edl={edl} />

      <BlocRubriques edl={edl} />

      <Section titre="Clôture">
        <button className={`carte tuile-ligne ${edl.statut === 'signe' ? 'tuile-ligne-ok' : ''}`} onClick={() => navigate(`/edl/${edl.id}/signature`)}>
          <span className="tuile-ligne-icone">{edl.statut === 'signe' ? <Lock size={22} /> : <PenLine size={22} />}</span>
          <span className="tuile-ligne-texte">
            <strong>{edl.statut === 'signe' ? 'Signé et verrouillé' : 'Récapitulatif et signatures'}</strong>
            <span className="texte-doux">
              {edl.statut === 'signe' && edl.cloture
                ? `Le ${formatDate(edl.cloture.signeLe, true)} · empreinte ${edl.cloture.empreinte.slice(0, 8)}…`
                : 'Vérifier, faire signer les parties, puis verrouiller'}
            </span>
          </span>
          <ChevronRight />
        </button>
        <div style={{ marginTop: 12 }}>
          <BoutonsRapport edl={edl} />
        </div>
      </Section>

      {edl.statut !== 'signe' && (
        <div className="zone-danger">
          <button className="bouton bouton-discret bouton-danger-texte" onClick={() => setConfirmer(true)}>
            <Trash2 size={20} /> Supprimer cet état des lieux
          </button>
        </div>
      )}

      <Confirmation
        ouvert={confirmer}
        danger
        titre="Supprimer cet état des lieux ?"
        message={
          <>
            <strong>{edl.reference}</strong> — {adresseCourte(edl)}
            <br />
            Toutes ses saisies et photos seront effacées de la tablette. Cette action est définitive.
          </>
        }
        libelleOk="Supprimer définitivement"
        onAnnuler={() => setConfirmer(false)}
        onOk={async () => {
          await supprimerEdl(edl.id)
          navigate('/', { replace: true })
        }}
      />
    </>
  )
}

/** Rappels visibles tant que l'état des lieux n'est pas signé. */
function Rappels({ edl, onOuvrir }: { edl: Edl; onOuvrir: (chemin: string) => void }) {
  const compteurs = (edl.compteurs ?? []).filter((c) => !compteurFait(c))
  if (!compteurs.length && edl.typeActe !== 'a_definir') return null
  return (
    <div className="rappels">
      {edl.typeActe === 'a_definir' && (
        <button className="carte rappel" onClick={() => onOuvrir('infos')}>
          <CircleAlert size={20} /> <span>Type d'état des lieux à définir (entrée, sortie…)</span> <ChevronRight size={18} />
        </button>
      )}
      {compteurs.length > 0 && (
        <button className="carte rappel" onClick={() => onOuvrir('compteurs')}>
          <Gauge size={20} />
          <span>
            Relevés à effectuer : {compteurs.map((c) => c.libelle).join(', ')}
          </span>
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  )
}
