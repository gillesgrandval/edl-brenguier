import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  DoorOpen,
  Flame,
  Home,
  LogIn,
  LogOut,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Warehouse,
  Droplets,
  Ban,
} from 'lucide-react'
import { useEdl } from '../hooks/useEdl'
import { db, nouvelId } from '../db/base'
import { enregistrerEdl, infosManquantes } from '../db/edl'
import type { Edl, Energie, ModeEnergie, TypeActe, TypeBien } from '../db/types'
import { ANNEXES, ENERGIES } from '../libelles'
import { creerPieces, modelesPour, quantitesParDefaut } from '../modeles/pieces'
import { Champ, Compteur, Interrupteur, Puces, Section, Tuiles, ZoneTexte } from '../components/ui'
import Chargement from '../components/Chargement'

const ETAPES = ['Type', 'Le bien', 'Les parties', 'Date et énergies', 'Pièces'] as const

/**
 * Assistant de création / modification des informations générales.
 * L'étape « Pièces » n'apparaît qu'à la création (ensuite, les pièces se gèrent
 * depuis le tableau de bord).
 */
export default function Infos() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { edl, modifier, sauvegarde, enregistrerMaintenant } = useEdl(id)
  const [quantites, setQuantites] = useState<Record<string, number> | null>(null)

  if (edl === undefined) return <Chargement />
  if (edl === null) return <Chargement introuvable />

  const creation = edl.pieces.length === 0
  const nbEtapes = creation ? ETAPES.length : ETAPES.length - 1
  const etape = Math.min(Number(params.get('etape') ?? 0), nbEtapes - 1)
  const allerA = (n: number) => {
    setParams({ etape: String(n) }, { replace: true })
    window.scrollTo({ top: 0 })
  }
  const derniere = etape === nbEtapes - 1

  const qte = quantites ?? quantitesParDefaut(edl.typeBien)

  async function terminer() {
    if (!edl) return
    await enregistrerMaintenant()
    if (creation) {
      // Enregistrement direct (et non différé) : les pièces doivent exister avant d'ouvrir le tableau de bord.
      await enregistrerEdl({ ...edl, pieces: creerPieces(qte, edl.typeBien), statut: 'en_cours' })
    }
    navigate(`/edl/${edl.id}`, { replace: true })
  }

  return (
    <div className="assistant">
      <div className="assistant-entete">
        <button className="bouton-icone" onClick={() => navigate(creation ? '/' : `/edl/${edl.id}`)} aria-label="Retour">
          <ArrowLeft />
        </button>
        <div>
          <div className="reference">{edl.reference}</div>
          <h1>{creation ? 'Nouvel état des lieux' : 'Informations générales'}</h1>
        </div>
        <span className={`indicateur-sauvegarde ${sauvegarde}`}>{sauvegarde === 'ok' ? 'Enregistré' : 'Enregistrement…'}</span>
      </div>

      <ol className="etapes">
        {ETAPES.slice(0, nbEtapes).map((nom, i) => (
          <li key={nom} className={i === etape ? 'etape-active' : i < etape ? 'etape-faite' : ''}>
            <button onClick={() => allerA(i)}>
              <span className="etape-numero">{i < etape ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
              <span className="etape-nom">{nom}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="assistant-corps">
        {etape === 0 && <EtapeType edl={edl} modifier={modifier} />}
        {etape === 1 && <EtapeBien edl={edl} modifier={modifier} />}
        {etape === 2 && <EtapeParties edl={edl} modifier={modifier} />}
        {etape === 3 && <EtapeEnergies edl={edl} modifier={modifier} />}
        {etape === 4 && creation && <EtapePieces bien={edl.typeBien} quantites={qte} onChange={setQuantites} />}
      </div>

      {derniere && <RappelManquants edl={edl} />}

      <div className="assistant-pied">
        <button className="bouton bouton-discret" onClick={() => allerA(etape - 1)} disabled={etape === 0} style={{ visibility: etape === 0 ? 'hidden' : 'visible' }}>
          <ArrowLeft size={20} /> Précédent
        </button>
        {derniere ? (
          <button className="bouton bouton-accent" onClick={terminer}>
            {creation ? 'Commencer la visite' : 'Terminer'} <Check size={20} />
          </button>
        ) : (
          <button className="bouton bouton-principal" onClick={() => allerA(etape + 1)}>
            Suivant <ArrowRight size={20} />
          </button>
        )}
      </div>
    </div>
  )
}

type Props = { edl: Edl; modifier: (f: (e: Edl) => void) => void }

// ---------------------------------------------------------------------
function EtapeType({ edl, modifier }: Props) {
  const verrouBien = edl.pieces.length > 0
  return (
    <>
      <Section titre="Type d'état des lieux">
        <Tuiles<TypeActe>
          valeur={edl.typeActe}
          onChange={(v) => modifier((e) => void (e.typeActe = v))}
          options={[
            { valeur: 'entree', libelle: 'Entrée', icone: <LogIn size={30} />, detail: 'Remise des clés au locataire' },
            { valeur: 'sortie', libelle: 'Sortie', icone: <LogOut size={30} />, detail: 'Restitution des clés' },
            { valeur: 'pre', libelle: 'Pré-état des lieux', icone: <DoorOpen size={30} />, detail: 'Visite préalable' },
          ]}
        />
      </Section>
      <Section titre="Type de bien">
        {verrouBien ? (
          <p className="texte-doux">Le type de bien ne peut plus être modifié une fois les pièces créées.</p>
        ) : (
          <Tuiles<TypeBien>
            valeur={edl.typeBien}
            onChange={(v) =>
              modifier((e) => {
                e.typeBien = v
                if (v === 'local') e.meuble = false
              })
            }
            options={[
              { valeur: 'appartement', libelle: 'Appartement', icone: <Building2 size={30} /> },
              { valeur: 'maison', libelle: 'Maison', icone: <Home size={30} /> },
              { valeur: 'local', libelle: 'Local / Entrepôt', icone: <Warehouse size={30} /> },
            ]}
          />
        )}
      </Section>
      {edl.typeBien !== 'local' && (
        <Section titre="Location">
          <Interrupteur libelle="Logement meublé (inventaire du mobilier)" valeur={edl.meuble} onChange={(v) => modifier((e) => void (e.meuble = v))} />
        </Section>
      )}
    </>
  )
}

// ---------------------------------------------------------------------
function EtapeBien({ edl, modifier }: Props) {
  const b = edl.bien
  const maj = (f: (b: Edl['bien']) => void) => modifier((e) => f(e.bien))
  return (
    <>
      <Section titre="Adresse du bien">
        <div className="grille">
          <Champ large label="Adresse" valeur={b.adresse} onChange={(v) => maj((b) => void (b.adresse = v))} placeholder="N° et nom de la voie" autoComplete="street-address" />
          <Champ large label="Complément" valeur={b.complement} onChange={(v) => maj((b) => void (b.complement = v))} placeholder="Bâtiment, résidence, lieu-dit…" />
          <Champ label="Code postal" valeur={b.codePostal} onChange={(v) => maj((b) => void (b.codePostal = v))} inputMode="numeric" />
          <Champ label="Ville" valeur={b.ville} onChange={(v) => maj((b) => void (b.ville = v))} />
        </div>
      </Section>
      <Section titre="Caractéristiques">
        <div className="grille grille-3">
          <Champ label="Étage" valeur={b.etage} onChange={(v) => maj((b) => void (b.etage = v))} placeholder="RDC, 2e…" />
          <Champ label="N° de lot" valeur={b.lot} onChange={(v) => maj((b) => void (b.lot = v))} />
          <Champ label="Surface (m²)" valeur={b.surface} onChange={(v) => maj((b) => void (b.surface = v))} inputMode="decimal" />
          <Champ label={edl.typeBien === 'local' ? 'Nombre de zones' : 'Pièces principales'} valeur={b.nbPieces} onChange={(v) => maj((b) => void (b.nbPieces = v))} inputMode="numeric" />
          <Champ label="Digicode / accès" valeur={b.digicode} onChange={(v) => maj((b) => void (b.digicode = v))} />
        </div>
      </Section>
      <Section titre="Annexes louées avec le bien">
        <Puces
          options={ANNEXES}
          choisies={b.annexes}
          onBasculer={(a) => maj((b) => void (b.annexes = b.annexes.includes(a) ? b.annexes.filter((x) => x !== a) : [...b.annexes, a]))}
        />
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------
function EtapeParties({ edl, modifier }: Props) {
  const entites = useLiveQuery(() => db.entites.orderBy('raisonSociale').toArray(), [])
  const [nouvelleEntite, setNouvelleEntite] = useState(false)
  const [ent, setEnt] = useState({ raisonSociale: '', adresse: '', siren: '', representant: '' })

  async function ajouterEntite() {
    if (!ent.raisonSociale.trim()) return
    const e = { id: nouvelId(), ...ent }
    await db.entites.add(e)
    modifier((x) => void (x.bailleur = { entiteId: e.id, raisonSociale: e.raisonSociale, adresse: e.adresse, siren: e.siren, representant: e.representant }))
    setEnt({ raisonSociale: '', adresse: '', siren: '', representant: '' })
    setNouvelleEntite(false)
  }

  return (
    <>
      <Section titre="Bailleur">
        {(entites?.length ?? 0) > 0 && (
          <div className="tuiles tuiles-compactes">
            {entites!.map((e) => {
              const actif = edl.bailleur.entiteId === e.id
              return (
                <button
                  key={e.id}
                  className={`tuile ${actif ? 'tuile-active' : ''}`}
                  onClick={() =>
                    modifier((x) => void (x.bailleur = { entiteId: e.id, raisonSociale: e.raisonSociale, adresse: e.adresse, siren: e.siren, representant: e.representant }))
                  }
                >
                  <span className="tuile-libelle">{e.raisonSociale}</span>
                  <span className="tuile-detail">{e.adresse}</span>
                  {actif && (
                    <span className="tuile-coche">
                      <Check size={16} strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
        {nouvelleEntite || (entites?.length ?? 0) === 0 ? (
          <div className="carte carte-insert">
            <p className="texte-doux" style={{ marginTop: 0 }}>
              Enregistrez une entité du groupe une seule fois : elle sera proposée ensuite pour tous les états des lieux.
            </p>
            <div className="grille">
              <Champ label="Raison sociale" valeur={ent.raisonSociale} onChange={(v) => setEnt({ ...ent, raisonSociale: v })} placeholder="SCI…, SAS…" />
              <Champ label="SIREN" valeur={ent.siren} onChange={(v) => setEnt({ ...ent, siren: v })} inputMode="numeric" />
              <Champ large label="Adresse du siège" valeur={ent.adresse} onChange={(v) => setEnt({ ...ent, adresse: v })} />
              <Champ large label="Représentant légal" valeur={ent.representant} onChange={(v) => setEnt({ ...ent, representant: v })} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button className="bouton bouton-principal" onClick={ajouterEntite} disabled={!ent.raisonSociale.trim()}>
                <Check size={20} /> Enregistrer l'entité
              </button>
              {(entites?.length ?? 0) > 0 && (
                <button className="bouton bouton-discret" onClick={() => setNouvelleEntite(false)}>
                  Annuler
                </button>
              )}
            </div>
          </div>
        ) : (
          <button className="bouton bouton-discret" onClick={() => setNouvelleEntite(true)}>
            <Plus size={20} /> Ajouter une entité
          </button>
        )}
      </Section>

      <Section titre="Représentant du bailleur présent">
        <div className="grille">
          <Champ label="Nom" valeur={edl.operateur.nom} onChange={(v) => modifier((e) => void (e.operateur.nom = v))} placeholder="Personne qui réalise l'état des lieux" />
          <Champ label="Qualité" valeur={edl.operateur.qualite} onChange={(v) => modifier((e) => void (e.operateur.qualite = v))} placeholder="Gestionnaire, directeur…" />
        </div>
        <details className="details">
          <summary>Un mandataire intervient (agence, administrateur de biens)</summary>
          <div className="grille" style={{ marginTop: 12 }}>
            <Champ label="Nom du mandataire" valeur={edl.mandataire?.nom} onChange={(v) => modifier((e) => void (e.mandataire = { ...e.mandataire, nom: v }))} />
            <Champ label="Adresse" valeur={edl.mandataire?.adresse} onChange={(v) => modifier((e) => void (e.mandataire = { nom: e.mandataire?.nom ?? '', adresse: v }))} />
          </div>
        </details>
      </Section>

      <Section
        titre={edl.locataires.length > 1 ? 'Locataires' : 'Locataire'}
        action={
          <button className="bouton bouton-discret bouton-petit" onClick={() => modifier((e) => void e.locataires.push({ id: nouvelId(), nom: '' }))}>
            <UserPlus size={18} /> Ajouter
          </button>
        }
      >
        {edl.locataires.map((l, i) => (
          <div key={l.id} className="carte carte-insert" style={{ marginBottom: 12 }}>
            <div className="carte-insert-titre">
              <strong>{edl.typeBien === 'local' ? `Preneur ${i + 1}` : `Locataire ${i + 1}`}</strong>
              {edl.locataires.length > 1 && (
                <button className="bouton-icone" aria-label="Retirer ce locataire" onClick={() => modifier((e) => void e.locataires.splice(i, 1))}>
                  <Trash2 size={20} />
                </button>
              )}
            </div>
            <div className="grille">
              <Champ label="Nom ou raison sociale" valeur={l.nom} onChange={(v) => modifier((e) => void (e.locataires[i].nom = v))} />
              <Champ label="Prénom" valeur={l.prenom} onChange={(v) => modifier((e) => void (e.locataires[i].prenom = v))} />
              <Champ label="Téléphone" type="tel" inputMode="tel" valeur={l.telephone} onChange={(v) => modifier((e) => void (e.locataires[i].telephone = v))} />
              <Champ label="E-mail" type="email" inputMode="email" valeur={l.email} onChange={(v) => modifier((e) => void (e.locataires[i].email = v))} aide="Pour lui envoyer le PDF signé" />
            </div>
          </div>
        ))}
        {edl.typeActe === 'sortie' && (
          <ZoneTexte
            label="Nouvelle adresse du locataire (obligatoire en sortie)"
            valeur={edl.nouvelleAdresseLocataire}
            onChange={(v) => modifier((e) => void (e.nouvelleAdresseLocataire = v))}
          />
        )}
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------
function ChoixEnergie(props: { valeur: Energie; onChange: (f: (e: Energie) => void) => void }) {
  return (
    <>
      <Tuiles<ModeEnergie>
        colonnes={3}
        valeur={props.valeur.mode}
        onChange={(m) => props.onChange((e) => void (e.mode = m))}
        options={[
          { valeur: 'individuel', libelle: 'Individuel' },
          { valeur: 'collectif', libelle: 'Collectif' },
          { valeur: 'aucun', libelle: 'Aucun', icone: <Ban size={22} /> },
        ]}
      />
      {props.valeur.mode !== 'aucun' && (
        <div style={{ marginTop: 14 }}>
          <Puces
            options={ENERGIES}
            choisies={props.valeur.energie ? [props.valeur.energie] : []}
            onBasculer={(v) => props.onChange((e) => void (e.energie = e.energie === v ? undefined : v))}
          />
        </div>
      )}
    </>
  )
}

function EtapeEnergies({ edl, modifier }: Props) {
  return (
    <>
      <Section titre="Date et heure de la visite">
        <div className="grille">
          <Champ type="datetime-local" label="Date et heure" valeur={edl.dateVisite} onChange={(v) => modifier((e) => void (e.dateVisite = v))} />
        </div>
      </Section>
      <Section titre="Chauffage">
        <div className="titre-icone">
          <Flame size={20} /> Mode de chauffage
        </div>
        <ChoixEnergie valeur={edl.chauffage} onChange={(f) => modifier((e) => f(e.chauffage))} />
      </Section>
      <Section titre="Eau chaude sanitaire">
        <Interrupteur
          libelle="Identique au chauffage"
          valeur={!!edl.eauChaude.idemChauffage}
          onChange={(v) => modifier((e) => void (e.eauChaude.idemChauffage = v))}
        />
        {!edl.eauChaude.idemChauffage && (
          <div style={{ marginTop: 14 }}>
            <div className="titre-icone">
              <Droplets size={20} /> Production d'eau chaude
            </div>
            <ChoixEnergie valeur={edl.eauChaude} onChange={(f) => modifier((e) => f(e.eauChaude))} />
          </div>
        )}
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------
function EtapePieces(props: { bien: TypeBien; quantites: Record<string, number>; onChange: (q: Record<string, number>) => void }) {
  const [filtre, setFiltre] = useState('')
  const modeles = modelesPour(props.bien).filter((m) => m.nom.toLowerCase().includes(filtre.toLowerCase()))
  const total = Object.values(props.quantites).reduce((a, b) => a + b, 0)
  return (
    <Section titre={`Pièces à visiter (${total})`}>
      <p className="texte-doux" style={{ marginTop: 0 }}>
        Une sélection est proposée selon le type de bien. Ajustez les quantités : chaque pièce sera préremplie avec ses éléments (sol, murs,
        équipements…). Vous pourrez encore ajouter ou retirer des pièces pendant la visite.
      </p>
      {modelesPour(props.bien).length > 10 && (
        <div className="barre-recherche barre-recherche-petite">
          <Search size={18} />
          <input placeholder="Filtrer les pièces…" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        </div>
      )}
      <div className="liste-pieces">
        {modeles.map((m) => {
          const n = props.quantites[m.cle] ?? 0
          return (
            <div key={m.cle} className={`ligne-piece ${n > 0 ? 'ligne-piece-active' : ''}`}>
              <div>
                <div className="ligne-piece-nom">{m.nom}</div>
                <div className="ligne-piece-detail">{m.elements.length} éléments</div>
              </div>
              <Compteur libelle={m.nom} valeur={n} onChange={(v) => props.onChange({ ...props.quantites, [m.cle]: v })} />
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function RappelManquants({ edl }: { edl: Edl }) {
  const manque = infosManquantes(edl)
  if (manque.length === 0) return null
  return (
    <div className="rappel">
      <strong>À compléter avant la signature :</strong> {manque.join(', ')}. Vous pouvez commencer la visite et compléter plus tard.
    </div>
  )
}
