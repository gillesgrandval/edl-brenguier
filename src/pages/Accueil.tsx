import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, ChevronRight, HardDrive, CloudOff, ShieldCheck, ClipboardList, X, FileUp, CalendarClock, Gauge } from 'lucide-react'
import { ICONE_BIEN } from '../components/icones'
import { db, demanderStockagePersistant } from '../db/base'
import { adresseCourte, compteurFait, creerEdl, nomsLocataires, progressionGlobale } from '../db/edl'
import { importerPreparation } from '../db/patrimoine'
import type { Edl, Statut, TypeActe, TypeBien } from '../db/types'
import { LIBELLE_ACTE, LIBELLE_BIEN, LIBELLE_STATUT, formatDate } from '../libelles'
import { Badge, BarreProgression } from '../components/ui'

type Filtre<T> = T | 'tous'

export default function Accueil() {
  const navigate = useNavigate()
  const edls = useLiveQuery(() => db.edls.orderBy('modifieLe').reverse().toArray(), [])
  const [recherche, setRecherche] = useState('')
  const [statut, setStatut] = useState<Filtre<Statut>>('tous')
  const [acte, setActe] = useState<Filtre<TypeActe>>('tous')
  const [bien, setBien] = useState<Filtre<TypeBien>>('tous')
  const [creation, setCreation] = useState(false)

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return (edls ?? []).filter((e) => {
      if (statut !== 'tous' && e.statut !== statut) return false
      if (acte !== 'tous' && e.typeActe !== acte) return false
      if (bien !== 'tous' && e.typeBien !== bien) return false
      if (!q) return true
      const texte = [e.reference, adresseCourte(e), nomsLocataires(e), e.bien.lot].join(' ').toLowerCase()
      return texte.includes(q)
    })
  }, [edls, recherche, statut, acte, bien])

  async function nouveau() {
    if (creation) return
    setCreation(true)
    await demanderStockagePersistant()
    const id = await creerEdl()
    navigate(`/edl/${id}/infos`)
  }

  const total = edls?.length ?? 0
  const enCours = edls?.filter((e) => e.statut !== 'signe').length ?? 0
  // À réaliser : états des lieux non signés, du plus proche au plus lointain.
  const aRealiser = (edls ?? []).filter((e) => e.statut !== 'signe').sort((a, b) => a.dateVisite.localeCompare(b.dateVisite))

  // --- Import d'un fichier de patrimoine (reçu par e-mail) ---
  const fichier = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  async function importer(f: File) {
    setMessage(null)
    try {
      await demanderStockagePersistant()
      const r = await importerPreparation(JSON.parse(await f.text()))
      const morceaux = [
        r.biensAjoutes && `${r.biensAjoutes} bien${r.biensAjoutes > 1 ? 's' : ''} ajouté${r.biensAjoutes > 1 ? 's' : ''}`,
        r.biensMisAJour && `${r.biensMisAJour} bien${r.biensMisAJour > 1 ? 's' : ''} mis à jour`,
        r.edlCrees.length && `${r.edlCrees.length} état${r.edlCrees.length > 1 ? 's' : ''} des lieux préparé${r.edlCrees.length > 1 ? 's' : ''}`,
        r.edlDejaPresents && `${r.edlDejaPresents} déjà présent${r.edlDejaPresents > 1 ? 's' : ''}`,
      ].filter(Boolean)
      setMessage({ ok: true, texte: `Import réussi : ${morceaux.join(', ') || 'rien de nouveau'}.` })
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof SyntaxError ? 'Ce fichier est illisible (format inattendu).' : (e as Error).message })
    }
  }

  return (
    <>
      <section className="carte accueil-hero">
        <div>
          <p className="surtitre">GROUPE BRENGUIER</p>
          <h1>États des lieux</h1>
          <hr className="filet" />
          <p className="texte-doux">
            {edls === undefined
              ? 'Chargement…'
              : total === 0
              ? 'Aucun état des lieux pour le moment. Commencez par en créer un.'
              : `${total} état${total > 1 ? 's' : ''} des lieux · ${enCours} à terminer`}
          </p>
        </div>
        <div className="accueil-actions">
          <button className="bouton bouton-principal bouton-xl" onClick={nouveau} disabled={creation}>
            <Plus size={24} /> Nouvel état des lieux
          </button>
          <button className="bouton bouton-discret" onClick={() => fichier.current?.click()}>
            <FileUp size={20} /> Importer un fichier de patrimoine
          </button>
          <input
            ref={fichier}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void importer(f)
            }}
          />
        </div>
      </section>

      {message && (
        <div className={`carte message-import ${message.ok ? 'message-ok' : 'message-erreur'}`} role="status">
          {message.texte}
          <button className="bouton-icone" onClick={() => setMessage(null)} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
      )}

      {aRealiser.length > 0 && (
        <section className="a-realiser">
          <h2>
            <CalendarClock size={22} /> À réaliser
          </h2>
          <div className="liste-edl">
            {aRealiser.map((e) => (
              <CarteEdl key={e.id} edl={e} onOuvrir={() => navigate(`/edl/${e.id}`)} />
            ))}
          </div>
        </section>
      )}

      {total > 0 && (
        <>
          <h2 className="titre-liste">Tous les états des lieux</h2>
          <div className="barre-recherche">
            <Search size={20} />
            <input
              type="search"
              placeholder="Rechercher une adresse, un locataire, une référence…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            {recherche && (
              <button onClick={() => setRecherche('')} aria-label="Effacer la recherche">
                <X size={20} />
              </button>
            )}
          </div>

          <div className="filtres">
            <GroupeFiltre
              valeur={statut}
              onChange={setStatut}
              options={[['tous', 'Tous'], ['brouillon', 'Brouillons'], ['en_cours', 'En cours'], ['signe', 'Signés']]}
            />
            <GroupeFiltre valeur={acte} onChange={setActe} options={[['tous', 'Entrée et sortie'], ['entree', 'Entrées'], ['sortie', 'Sorties']]} />
            <GroupeFiltre
              valeur={bien}
              onChange={setBien}
              options={[['tous', 'Tous biens'], ['appartement', 'Appartements'], ['maison', 'Maisons'], ['local', 'Locaux']]}
            />
          </div>

          <div className="liste-edl">
            {filtres.map((e) => (
              <CarteEdl key={e.id} edl={e} onOuvrir={() => navigate(`/edl/${e.id}`)} />
            ))}
            {filtres.length === 0 && (
              <div className="vide">
                <ClipboardList size={36} />
                <p>Aucun état des lieux ne correspond à ces critères.</p>
              </div>
            )}
          </div>
        </>
      )}

      <EtatTablette />
    </>
  )
}

function GroupeFiltre<T extends string>(props: { valeur: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="segment">
      {props.options.map(([v, l]) => (
        <button key={v} className={props.valeur === v ? 'segment-actif' : ''} onClick={() => props.onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

function CarteEdl({ edl, onOuvrir }: { edl: Edl; onOuvrir: () => void }) {
  const Icone = ICONE_BIEN[edl.typeBien]
  const pct = progressionGlobale(edl)
  const tonStatut = edl.statut === 'signe' ? 'vert' : edl.statut === 'en_cours' ? 'orange' : 'gris'
  return (
    <button className={`carte carte-edl acte-${edl.typeActe}`} onClick={onOuvrir}>
      <div className="carte-edl-icone">
        <Icone size={26} />
      </div>
      <div className="carte-edl-corps">
        <div className="carte-edl-haut">
          <span className="reference">{edl.reference}</span>
          <Badge ton={edl.typeActe === 'sortie' ? 'bronze' : 'encre'}>{LIBELLE_ACTE[edl.typeActe]}</Badge>
          <Badge ton={tonStatut}>{LIBELLE_STATUT[edl.statut]}</Badge>
        </div>
        <div className="carte-edl-adresse">{adresseCourte(edl)}</div>
        <div className="carte-edl-detail">
          {nomsLocataires(edl)} · {LIBELLE_BIEN[edl.typeBien]} · {edl.statut === 'signe' ? '' : 'Prévu le '}
          {formatDate(edl.dateVisite)}
        </div>
        {edl.statut !== 'signe' && (edl.compteurs ?? []).some((c) => !compteurFait(c)) && (
          <div className="carte-edl-rappel">
            <Gauge size={15} /> Relevés de compteurs à effectuer
          </div>
        )}
        <div className="carte-edl-progression">
          <BarreProgression pourcent={pct} fine />
          <span>{pct} %</span>
        </div>
      </div>
      <ChevronRight className="carte-edl-chevron" />
    </button>
  )
}

/** Bandeau discret en bas de l'accueil : espace utilisé, hors ligne, protection. */
function EtatTablette() {
  const [infos, setInfos] = useState<{ utilise?: number; quota?: number; persistant?: boolean; horsLigne?: boolean }>({})
  const nbEdl = useLiveQuery(() => db.edls.count(), [])

  useEffect(() => {
    let actif = true
    ;(async () => {
      const est = await navigator.storage?.estimate?.()
      const persistant = await navigator.storage?.persisted?.()
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
      if (actif) setInfos({ utilise: est?.usage, quota: est?.quota, persistant, horsLigne: !!reg?.active })
    })()
    return () => {
      actif = false
    }
  }, [nbEdl])

  const mo = (o?: number) => (o === undefined ? '—' : o > 1e9 ? `${(o / 1e9).toFixed(1).replace('.', ',')} Go` : `${Math.max(1, Math.round(o / 1e6))} Mo`)

  return (
    <div className="etat-tablette">
      <span>
        <HardDrive size={16} /> {mo(infos.utilise)} utilisés sur {mo(infos.quota)}
      </span>
      <span className={infos.horsLigne ? 'ok' : 'attention'}>
        <CloudOff size={16} /> {infos.horsLigne ? 'Fonctionne hors ligne' : 'Hors ligne pas encore actif'}
      </span>
      <span className={infos.persistant ? 'ok' : 'attention'}>
        <ShieldCheck size={16} /> {infos.persistant ? 'Données protégées' : 'Protection demandée à la 1re création'}
      </span>
      <span className="version">v{__APP_VERSION__}</span>
    </div>
  )
}
