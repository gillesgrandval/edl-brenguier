import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, ChevronRight, FileSpreadsheet, Plus, Search, X } from 'lucide-react'
import { db } from '../db/base'
import { LIBELLE_CATEGORIE, bienVide, enregistrerBien } from '../db/patrimoine'
import type { Bien } from '../db/types'
import Chargement from '../components/Chargement'

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Rubrique « Patrimoine immobilier » : tous les biens, filtres, recherche, création, import. */
export default function Patrimoine() {
  const navigate = useNavigate()
  const biens = useLiveQuery(() => db.biens.toArray(), [])
  // Nombre d'états des lieux par bien.
  const nbEdl = useLiveQuery(async () => {
    const m = new Map<string, number>()
    await db.edls.each((e) => e.bienId && m.set(e.bienId, (m.get(e.bienId) ?? 0) + 1))
    return m
  }, [])
  const [recherche, setRecherche] = useState('')
  const [ville, setVille] = useState('')
  const [categorie, setCategorie] = useState('')
  const [residence, setResidence] = useState('')
  const [societe, setSociete] = useState('')

  const options = (f: (b: Bien) => string | undefined) => [...new Set((biens ?? []).map(f).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'fr'))
  const filtres = useMemo(() => {
    const q = sansAccents(recherche.trim())
    return (biens ?? [])
      .filter((b) => (!ville || b.ville === ville) && (!categorie || b.categorie === categorie) && (!residence || b.residence === residence) && (!societe || b.societe === societe))
      .filter((b) => !q || sansAccents([b.reference, b.lot && `lot ${b.lot}`, b.identifiantExterne, b.adresse, b.ville, b.codePostal, b.residence, b.societe, b.typologie].filter(Boolean).join(' ')).includes(q))
      .sort((a, b) => a.ville.localeCompare(b.ville, 'fr') || (a.residence ?? '').localeCompare(b.residence ?? '', 'fr') || (a.lot ?? a.reference ?? '').localeCompare(b.lot ?? b.reference ?? '', 'fr', { numeric: true }))
  }, [biens, recherche, ville, categorie, residence, societe])

  if (biens === undefined) return <Chargement />

  async function nouveau() {
    const b = bienVide()
    await enregistrerBien(b)
    navigate(`/patrimoine/${b.id}?nouveau=1`)
  }

  return (
    <>
      <section className="carte accueil-hero">
        <div className="accueil-texte">
          <p className="surtitre">GROUPE BRENGUIER</p>
          <h1>Patrimoine immobilier</h1>
          <hr className="filet" />
          <p className="texte-doux">
            {biens.length} bien{biens.length > 1 ? 's' : ''} enregistré{biens.length > 1 ? 's' : ''} sur cet appareil
          </p>
        </div>
        <div className="accueil-actions">
          <button className="bouton bouton-principal bouton-xl" onClick={nouveau}>
            <Plus size={24} /> Nouveau bien
          </button>
          <button className="bouton bouton-discret" onClick={() => navigate('/patrimoine/import')}>
            <FileSpreadsheet size={20} /> Importer depuis Excel
          </button>
        </div>
      </section>

      <div className="barre-recherche">
        <Search size={20} />
        <input type="search" placeholder="Rechercher : adresse, lot, référence, résidence, société…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        {recherche && (
          <button onClick={() => setRecherche('')} aria-label="Effacer la recherche">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="cascade filtres-patrimoine">
        <Filtre label="Ville" valeur={ville} options={options((b) => b.ville).map((v) => [v, v])} onChange={setVille} />
        <Filtre label="Type" valeur={categorie} options={[...new Set(biens.map((b) => b.categorie))].map((c) => [c, LIBELLE_CATEGORIE[c]])} onChange={setCategorie} />
        <Filtre label="Résidence" valeur={residence} options={options((b) => b.residence).map((v) => [v, v])} onChange={setResidence} />
        <Filtre label="Société" valeur={societe} options={options((b) => b.societe).map((v) => [v, v])} onChange={setSociete} />
      </div>

      <div className="liste-edl" style={{ marginTop: 16 }}>
        {filtres.map((b) => (
          <button key={b.id} className="carte carte-edl" onClick={() => navigate(`/patrimoine/${b.id}`)}>
            <div className="carte-edl-icone">
              <Building2 size={26} />
            </div>
            <div className="carte-edl-corps">
              <div className="carte-edl-haut">
                <span className="reference">{b.reference || (b.lot ? `Lot ${b.lot}` : b.identifiantExterne || 'Sans référence')}</span>
                <span className="badge badge-encre">
                  {LIBELLE_CATEGORIE[b.categorie]} {b.typologie}
                </span>
                {b.residence && <span className="badge badge-gris">{b.residence}</span>}
              </div>
              <div className="carte-edl-adresse">{b.adresse ? `${b.adresse}, ${b.codePostal} ${b.ville}` : 'Adresse à compléter'}</div>
              <div className="carte-edl-detail">
                {[b.surface && `${b.surface} m²`, b.societe, `${nbEdl?.get(b.id) ?? 0} état${(nbEdl?.get(b.id) ?? 0) > 1 ? 's' : ''} des lieux`].filter(Boolean).join(' · ')}
              </div>
            </div>
            <ChevronRight className="carte-edl-chevron" />
          </button>
        ))}
        {filtres.length === 0 && (
          <div className="vide">
            <Building2 size={36} />
            <p>{biens.length ? 'Aucun bien ne correspond à ces critères.' : 'Aucun bien pour le moment : créez-en un ou importez votre fichier Excel.'}</p>
          </div>
        )}
      </div>
    </>
  )
}

function Filtre(props: { label: string; valeur: string; options: [string, string][]; onChange: (v: string) => void }) {
  if (props.options.length === 0) return null
  return (
    <label className="champ">
      <span className="champ-label">{props.label}</span>
      <select className="saisie" value={props.valeur} onChange={(e) => props.onChange(e.target.value)}>
        <option value="">Tous</option>
        {props.options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}
