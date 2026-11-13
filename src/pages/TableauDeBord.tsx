import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardList,
  Gauge,
  KeyRound,
  Sofa,
  AlarmSmoke,
  MessageSquareText,
  PenLine,
  Trash2,
  Info,
  CircleAlert,
} from 'lucide-react'
import { db } from '../db/base'
import { adresseCourte, infosManquantes, nomsLocataires, progressionGlobale, progressionPiece, supprimerEdl } from '../db/edl'
import { LIBELLE_ACTE, LIBELLE_BIEN, formatDate } from '../libelles'
import { Badge, BarreProgression, Confirmation, Section } from '../components/ui'
import Chargement from '../components/Chargement'
import { ICONE_BIEN } from '../components/icones'

/** Vue d'ensemble d'un état des lieux : on y voit d'un coup d'œil ce qui reste à faire. */
export default function TableauDeBord() {
  const { id } = useParams()
  const navigate = useNavigate()
  const edl = useLiveQuery(async () => (id ? ((await db.edls.get(id)) ?? null) : null), [id])
  const [confirmer, setConfirmer] = useState(false)

  if (edl === undefined) return <Chargement />
  if (edl === null) return <Chargement introuvable />

  const pct = progressionGlobale(edl)
  const manque = infosManquantes(edl)
  const piecesFinies = edl.pieces.filter((p) => {
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
            {piecesFinies} pièce{piecesFinies > 1 ? 's' : ''} terminée{piecesFinies > 1 ? 's' : ''} sur {edl.pieces.length}
            {manque.length > 0 ? ` · ${manque.length} information${manque.length > 1 ? 's' : ''} à compléter` : ''}
          </p>
        </div>
      </div>

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

      <Section titre={`Pièces (${edl.pieces.length})`}>
        <div className="grille-pieces">
          {edl.pieces.map((p) => {
            const pr = progressionPiece(p)
            const finie = pr.total > 0 && pr.faits === pr.total
            return (
              <button key={p.id} className={`carte tuile-piece ${finie ? 'tuile-piece-finie' : ''}`} onClick={() => navigate(`/edl/${edl.id}/piece/${p.id}`)}>
                <div className="tuile-piece-haut">
                  <span className="tuile-piece-nom">{p.nom}</span>
                  {finie && (
                    <span className="pastille-ok">
                      <Check size={16} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <BarreProgression pourcent={pr.total ? (pr.faits / pr.total) * 100 : 0} fine />
                <span className="tuile-piece-detail">
                  {pr.faits} / {pr.total} éléments
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section titre="Rubriques">
        <div className="grille-pieces">
          <TuileAVenir icone={<Gauge />} nom="Compteurs" etape={5} />
          <TuileAVenir icone={<KeyRound />} nom="Clés et badges" etape={5} />
          {edl.typeBien !== 'local' && <TuileAVenir icone={<AlarmSmoke />} nom="Détecteur de fumée" etape={5} />}
          {edl.meuble && <TuileAVenir icone={<Sofa />} nom="Inventaire du mobilier" etape={5} />}
          <TuileAVenir icone={<MessageSquareText />} nom="Observations générales" etape={5} />
        </div>
      </Section>

      <Section titre="Clôture">
        <div className="grille-pieces">
          <TuileAVenir icone={<PenLine />} nom="Signatures et rapport PDF" etape={6} />
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

function TuileAVenir(props: { icone: React.ReactNode; nom: string; etape: number }) {
  return (
    <div className="carte tuile-piece tuile-a-venir" aria-disabled>
      <div className="tuile-piece-haut">
        <span className="tuile-piece-icone">{props.icone}</span>
        <span className="tuile-piece-nom">{props.nom}</span>
      </div>
      <span className="tuile-piece-detail">
        <Info size={14} /> Disponible à l'étape {props.etape}
      </span>
    </div>
  )
}
