import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlarmSmoke, Check, Gauge, KeyRound, Mailbox, MessageSquareText, Plus, Sofa } from 'lucide-react'
import { etatRubriques, majEdl, progressionPiece } from '../db/edl'
import type { Edl } from '../db/types'
import { creerInventaire } from '../modeles/pieces'
import { BarreProgression, Section } from './ui'

/** Tuiles des rubriques transversales du tableau de bord. */
export default function BlocRubriques({ edl }: { edl: Edl }) {
  const navigate = useNavigate()
  const r = etatRubriques(edl)
  const nbCles = (edl.cles ?? []).reduce((n, c) => n + c.nombre, 0)
  const inventaire = edl.pieces.find((p) => p.modele === 'mobilier')
  const prInv = inventaire ? progressionPiece(inventaire) : null
  const aller = (chemin: string) => navigate(`/edl/${edl.id}/${chemin}`)

  async function ouvrirInventaire() {
    if (inventaire) return aller(`piece/${inventaire.id}`)
    const p = creerInventaire()
    await majEdl(edl.id, (e) => {
      e.pieces.push(p)
      e.meuble = true
    })
    aller(`piece/${p.id}`)
  }

  return (
    <Section titre="Rubriques">
      <div className="grille-pieces">
        <Tuile
          icone={<Gauge />}
          nom="Compteurs"
          ok={r.compteurs.total > 0 && r.compteurs.faits === r.compteurs.total}
          pourcent={r.compteurs.total ? (r.compteurs.faits / r.compteurs.total) * 100 : 0}
          detail={`${r.compteurs.faits} / ${r.compteurs.total} relevés (photo comprise)`}
          onClick={() => aller('compteurs')}
        />
        <Tuile icone={<KeyRound />} nom="Clés et badges" ok={r.cles} detail={nbCles ? `${nbCles} remis(es)` : 'À compter'} onClick={() => aller('cles')} />
        {r.detecteur !== null && (
          <Tuile
            icone={<AlarmSmoke />}
            nom="Détecteur de fumée"
            ok={r.detecteur}
            detail={edl.detecteur?.present === undefined ? 'À renseigner' : edl.detecteur.present ? 'Présent' : 'Absent'}
            onClick={() => aller('detecteur')}
          />
        )}
        {r.boiteAuxLettres !== null && (
          <Tuile
            icone={<Mailbox />}
            nom="Boîte aux lettres"
            ok={r.boiteAuxLettres}
            detail={edl.boiteAuxLettres?.presence === undefined ? 'À renseigner' : edl.boiteAuxLettres.presence === 'non' ? 'Absente' : ['Présente', edl.boiteAuxLettres.numero && `n° ${edl.boiteAuxLettres.numero}`].filter(Boolean).join(' · ')}
            onClick={() => aller('boite-aux-lettres')}
          />
        )}
        {edl.typeBien !== 'local' &&
          (inventaire || edl.meuble ? (
            <Tuile
              icone={<Sofa />}
              nom="Inventaire du mobilier"
              ok={!!prInv && prInv.total > 0 && prInv.faits === prInv.total}
              pourcent={prInv && prInv.total ? (prInv.faits / prInv.total) * 100 : 0}
              detail={prInv ? `${prInv.faits} / ${prInv.total} éléments` : 'À créer'}
              onClick={ouvrirInventaire}
            />
          ) : (
            <Tuile icone={<Plus />} nom="Inventaire du mobilier" ok={false} discret detail="Logement meublé uniquement" onClick={ouvrirInventaire} />
          ))}
        <Tuile
          icone={<MessageSquareText />}
          nom="Observations générales"
          ok={!!edl.observationsGenerales?.trim()}
          neutre
          detail={edl.observationsGenerales?.trim() ? 'Renseignées' : 'Facultatif'}
          onClick={() => aller('observations')}
        />
      </div>
    </Section>
  )
}

function Tuile(props: { icone: ReactNode; nom: string; ok: boolean; detail: string; pourcent?: number; neutre?: boolean; discret?: boolean; onClick: () => void }) {
  return (
    <button className={`carte tuile-piece ${props.ok ? 'tuile-rubrique-ok' : ''} ${props.discret ? 'tuile-a-venir' : ''}`} onClick={props.onClick}>
      <div className="tuile-piece-haut">
        <span className={`tuile-piece-icone ${props.ok ? 'ok' : ''}`}>{props.icone}</span>
        <span className="tuile-piece-nom" style={{ flex: 1 }}>
          {props.nom}
        </span>
        {props.ok && !props.neutre && (
          <span className="pastille-ok">
            <Check size={16} strokeWidth={3} />
          </span>
        )}
      </div>
      {props.pourcent !== undefined && <BarreProgression pourcent={props.pourcent} fine />}
      <span className="tuile-piece-detail">{props.detail}</span>
    </button>
  )
}
