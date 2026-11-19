import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, KeyRound, ListChecks, Trash2 } from 'lucide-react'
import { db } from '../db/base'
import { CODE_VALIDE, LIBELLE_ACTION, codeDefini, definirCode, reinitialiserCode } from '../db/admin'
import { formatDate } from '../libelles'
import { Section } from './ui'
import { ChampCode, Fenetre } from './Admin'

/** Paramètres : code administrateur, corbeille, journal des suppressions et annulations. */
export default function SectionSecurite() {
  const navigate = useNavigate()
  const defini = useLiveQuery(codeDefini, [])
  const nbCorbeille = useLiveQuery(async () => (await db.edls.toArray()).filter((e) => e.corbeille).length, [])
  const journal = useLiveQuery(() => db.journal.orderBy('le').reverse().toArray(), [])
  const [fenetre, setFenetre] = useState<'code' | 'oubli' | null>(null)
  const [toutVoir, setToutVoir] = useState(false)

  return (
    <Section titre="Sécurité et suppressions">
      <div className="carte rubrique-carte">
        <div className="bloc-titre">
          <KeyRound size={16} /> Code administrateur
        </div>
        <p className="texte-doux" style={{ marginTop: 0 }}>
          Demandé pour supprimer définitivement un état des lieux de la corbeille et pour annuler un état des lieux signé. C'est une protection contre les fausses manœuvres, propre à cet appareil.
        </p>
        <p>{defini === undefined ? '…' : defini ? <strong>Code défini.</strong> : <strong>Aucun code défini.</strong>}</p>
        <div className="actions-rapides">
          <button className="bouton bouton-discret" onClick={() => setFenetre('code')}>
            <KeyRound size={18} /> {defini ? 'Changer le code' : 'Définir le code'}
          </button>
          {defini && (
            <button className="bouton bouton-discret bouton-petit" onClick={() => setFenetre('oubli')}>
              Code oublié
            </button>
          )}
        </div>
      </div>

      <button className="carte tuile-ligne" style={{ margin: '12px 0' }} onClick={() => navigate('/corbeille')}>
        <span className="tuile-ligne-icone">
          <Trash2 size={22} />
        </span>
        <span className="tuile-ligne-texte">
          <strong>Corbeille</strong>
          <span className="texte-doux">{nbCorbeille ? `${nbCorbeille} état${nbCorbeille > 1 ? 's' : ''} des lieux` : 'Vide'} — restaurer ou supprimer définitivement</span>
        </span>
        <ChevronRight />
      </button>

      <div className="carte rubrique-carte">
        <div className="bloc-titre">
          <ListChecks size={16} /> Journal des suppressions et annulations
        </div>
        {!journal?.length && <p className="texte-doux">Aucune action pour le moment.</p>}
        {(toutVoir ? journal : journal?.slice(0, 8))?.map((j) => (
          <div key={j.id} className="journal-ligne">
            <strong>{LIBELLE_ACTION[j.action]}</strong> — {formatDate(j.le, true)}
            <br />
            <span className="texte-doux">{j.description}</span>
            {j.motif && (
              <>
                <br />
                Motif : <em>{j.motif}</em>
              </>
            )}
          </div>
        ))}
        {!toutVoir && (journal?.length ?? 0) > 8 && (
          <button className="bouton bouton-discret bouton-petit" onClick={() => setToutVoir(true)}>
            Tout afficher ({journal!.length})
          </button>
        )}
      </div>

      {fenetre === 'code' && <FenetreCode existe={!!defini} onFermer={() => setFenetre(null)} />}
      {fenetre === 'oubli' && <FenetreOubli onFermer={() => setFenetre(null)} />}
    </Section>
  )
}

function FenetreCode({ existe, onFermer }: { existe: boolean; onFermer: () => void }) {
  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState('')
  const valide = CODE_VALIDE.test(nouveau) && nouveau === confirmation && (!existe || !!ancien)
  return (
    <Fenetre titre={existe ? 'Changer le code administrateur' : 'Définir le code administrateur'} onFermer={onFermer}>
      <p className="texte-doux">4 à 8 chiffres. Notez-le en lieu sûr : il n'est pas récupérable.</p>
      <div className="grille">
        {existe && <ChampCode label="Code actuel" valeur={ancien} onChange={setAncien} autoFocus />}
        <ChampCode label="Nouveau code" valeur={nouveau} onChange={setNouveau} autoFocus={!existe} />
        <ChampCode label="Confirmer le nouveau code" valeur={confirmation} onChange={setConfirmation} />
      </div>
      {nouveau && confirmation && nouveau !== confirmation && <p className="texte-alerte">Les deux codes sont différents.</p>}
      {erreur && <p className="texte-erreur">{erreur}</p>}
      <div className="dialogue-actions">
        <button className="bouton bouton-discret" onClick={onFermer}>
          Annuler
        </button>
        <button
          className="bouton bouton-principal"
          disabled={!valide}
          onClick={async () => {
            try {
              await definirCode(nouveau, ancien)
              onFermer()
            } catch (e) {
              setErreur((e as Error).message)
            }
          }}
        >
          Enregistrer
        </button>
      </div>
    </Fenetre>
  )
}

function FenetreOubli({ onFermer }: { onFermer: () => void }) {
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState('')
  return (
    <Fenetre titre="Code oublié" onFermer={onFermer}>
      <p>
        Le code actuel sera effacé ; vous en définirez un nouveau. Aucune donnée n'est touchée, mais la réinitialisation est <strong>inscrite au journal</strong>, avec la raison indiquée.
      </p>
      <label className="champ">
        <span className="champ-label">Raison (obligatoire)</span>
        <input className="saisie" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="ex. code oublié par …" />
      </label>
      {erreur && <p className="texte-erreur">{erreur}</p>}
      <div className="dialogue-actions">
        <button className="bouton bouton-discret" onClick={onFermer}>
          Annuler
        </button>
        <button
          className="bouton bouton-danger"
          disabled={!motif.trim()}
          onClick={async () => {
            try {
              await reinitialiserCode(motif)
              onFermer()
            } catch (e) {
              setErreur((e as Error).message)
            }
          }}
        >
          Réinitialiser le code
        </button>
      </div>
    </Fenetre>
  )
}
