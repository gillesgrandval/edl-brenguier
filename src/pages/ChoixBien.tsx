import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowRightLeft, Building2, ChevronRight, ClipboardList, MapPin, PencilLine, Search, X } from 'lucide-react'
import { db, demanderStockagePersistant } from '../db/base'
import { creerEdl, maintenantLocal } from '../db/edl'
import { LIBELLE_CATEGORIE, bienVide, creerEdlDepuisBien, enregistrerBien, libelleBien } from '../db/patrimoine'
import type { Bien } from '../db/types'
import { creerVisiteDepuisBien, entreePrecedente } from '../db/visite'
import { libelleActe, formatDate } from '../libelles'
import { Champ, Section } from '../components/ui'
import Chargement from '../components/Chargement'

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Nouvel état des lieux :
 *  A. choisir un bien du patrimoine (listes successives Ville → Type → Résidence → Référence, ou recherche),
 *  B. ou saisir un bien qui n'est pas encore dans le patrimoine.
 */
export default function ChoixBien() {
  const navigate = useNavigate()
  const biens = useLiveQuery(() => db.biens.toArray(), [])
  const [ville, setVille] = useState('')
  const [categorie, setCategorie] = useState('')
  const [residence, setResidence] = useState('')
  const [bienId, setBienId] = useState('')
  const [recherche, setRecherche] = useState('')
  const [date, setDate] = useState(maintenantLocal().slice(0, 10))
  const [enCours, setEnCours] = useState(false)

  const tous = useMemo(() => (biens ?? []).sort((a, b) => libelleBien(a).localeCompare(libelleBien(b), 'fr', { numeric: true })), [biens])
  // Chaque choix filtre les suivants.
  const villes = [...new Set(tous.map((b) => b.ville))].sort((a, b) => a.localeCompare(b, 'fr'))
  const dansVille = tous.filter((b) => !ville || b.ville === ville)
  const categories = [...new Set(dansVille.map((b) => b.categorie))]
  const dansCategorie = dansVille.filter((b) => !categorie || b.categorie === categorie)
  const residences = [...new Set(dansCategorie.map((b) => b.residence).filter((r): r is string => !!r))].sort()
  const candidats = dansCategorie.filter((b) => !residence || b.residence === residence)
  const choisi = tous.find((b) => b.id === bienId)

  const resultats = useMemo(() => {
    const q = sansAccents(recherche.trim())
    if (!q) return []
    return tous.filter((b) => sansAccents([b.reference, b.lot && `lot ${b.lot}`, b.adresse, b.ville, b.codePostal, b.residence, b.societe, b.typologie].filter(Boolean).join(' ')).includes(q)).slice(0, 12)
  }, [tous, recherche])

  // Historique des états des lieux du bien choisi.
  const historique = useLiveQuery(async () => (bienId ? (await db.edls.where('bienId').equals(bienId).toArray()).filter((e) => !e.corbeille).sort((a, b) => b.dateVisite.localeCompare(a.dateVisite)) : []), [bienId])

  // Visite commune : entrée signée précédente du bien (référence de la sortie).
  const entreeAvant = useLiveQuery(async () => (bienId ? ((await entreePrecedente(bienId)) ?? null) : null), [bienId])

  if (biens === undefined) return <Chargement />

  function choisir(b: Bien) {
    setVille(b.ville)
    setCategorie(b.categorie)
    setResidence(b.residence ?? '')
    setBienId(b.id)
    setRecherche('')
  }

  async function preparer() {
    if (!choisi || enCours) return
    setEnCours(true)
    await demanderStockagePersistant()
    const id = await creerEdlDepuisBien(choisi, date)
    navigate(`/edl/${id}`, { replace: true })
  }

  async function visiteCommune() {
    if (!choisi || enCours) return
    setEnCours(true)
    await demanderStockagePersistant()
    const id = await creerVisiteDepuisBien(choisi, date)
    navigate(`/edl/${id}/infos`, { replace: true })
  }

  async function creerFiche() {
    const b = bienVide()
    await enregistrerBien(b)
    navigate(`/patrimoine/${b.id}?nouveau=1`)
  }

  async function saisieLibre() {
    if (enCours) return
    setEnCours(true)
    await demanderStockagePersistant()
    const id = await creerEdl()
    navigate(`/edl/${id}/infos`, { replace: true })
  }

  return (
    <div className="saisie-piece choix-bien">
      <div className="piece-entete">
        <button className="bouton-icone" onClick={() => navigate('/')} aria-label="Retour à l'accueil">
          <ArrowLeft />
        </button>
        <div className="piece-entete-titre">
          <div className="titre-modifiable">
            <h1>Nouvel état des lieux</h1>
          </div>
        </div>
      </div>

      <Section titre="Choisir un bien du patrimoine">
        <div className="carte rubrique-carte">
          <div className="barre-recherche" style={{ marginTop: 0 }}>
            <Search size={20} />
            <input type="search" placeholder="Rechercher : adresse, lot, référence, ville…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            {recherche && (
              <button onClick={() => setRecherche('')} aria-label="Effacer la recherche">
                <X size={20} />
              </button>
            )}
          </div>
          {recherche.trim() && (
            <div className="resultats-biens">
              {resultats.length === 0 && <p className="texte-doux">Aucun bien ne correspond.</p>}
              {resultats.map((b) => (
                <button key={b.id} className="resultat-bien" onClick={() => choisir(b)}>
                  <MapPin size={18} />
                  <span>
                    <strong>{b.reference || `Lot ${b.lot}`}</strong> · {b.adresse}, {b.codePostal} {b.ville}
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          )}

          <div className="cascade">
            <Liste label="1. Ville" valeur={ville} vide="Toutes les villes" options={villes.map((v) => [v, v])} onChange={(v) => (setVille(v), setCategorie(''), setResidence(''), setBienId(''))} />
            <Liste
              label="2. Type de bien"
              valeur={categorie}
              vide="Tous les types"
              options={categories.map((c) => [c, LIBELLE_CATEGORIE[c]])}
              onChange={(v) => (setCategorie(v), setResidence(''), setBienId(''))}
            />
            {residences.length > 0 && (
              <Liste label="3. Résidence / immeuble" valeur={residence} vide="Toutes" options={residences.map((r) => [r, r])} onChange={(v) => (setResidence(v), setBienId(''))} />
            )}
            <Liste
              label={residences.length > 0 ? '4. Référence / lot' : '3. Référence / lot'}
              valeur={bienId}
              vide={candidats.length ? `Choisir parmi ${candidats.length} bien${candidats.length > 1 ? 's' : ''}` : 'Aucun bien'}
              options={candidats.map((b) => [b.id, `${b.reference || `Lot ${b.lot}`}${b.typologie ? ` · ${b.typologie}` : ''}`])}
              onChange={setBienId}
            />
          </div>

          {choisi && (
            <div className="fiche-bien">
              <div className="fiche-bien-titre">
                <Building2 size={22} />
                <div>
                  <strong>
                    {choisi.reference || `Lot ${choisi.lot}`} · {LIBELLE_CATEGORIE[choisi.categorie]} {choisi.typologie}
                  </strong>
                  <span>
                    {choisi.adresse}, {choisi.codePostal} {choisi.ville}
                  </span>
                </div>
              </div>
              <ul className="fiche-bien-details">
                {choisi.etage && <li>Niveau : {choisi.etage}</li>}
                {choisi.surface && <li>Surface habitable : {choisi.surface} m²</li>}
                {choisi.pieces.length > 0 && <li>Pièces : {choisi.pieces.map((p) => p.nom).join(', ')}</li>}
                {choisi.annexes.length > 0 && <li>Annexes : {choisi.annexes.join(', ')}</li>}
                {choisi.equipements.length > 0 && <li>Équipements connus : {choisi.equipements.join(', ')}</li>}
              </ul>
              {historique && historique.length > 0 && (
                <div className="fiche-bien-historique">
                  <strong>
                    <ClipboardList size={16} /> États des lieux de ce bien
                  </strong>
                  {historique.map((e) => (
                    <button key={e.id} className="resultat-bien" onClick={() => navigate(`/edl/${e.id}`)}>
                      <span>
                        {e.reference} · {libelleActe(e)} · {formatDate(e.dateVisite)} · {e.statut === 'signe' ? 'signé' : 'en préparation'}
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              )}
              <div className="grille" style={{ marginTop: 12 }}>
                <Champ type="date" label="Date de la visite" valeur={date} onChange={(v) => v && setDate(v)} aide="L'heure, le locataire et le type se complètent ensuite." />
              </div>
              <button className="bouton bouton-accent bouton-signer" onClick={preparer} disabled={enCours}>
                Préparer l'état des lieux <ChevronRight size={22} />
              </button>
              <button className="carte tuile-ligne" style={{ marginTop: 12 }} onClick={visiteCommune} disabled={enCours || entreeAvant === undefined}>
                <span className="tuile-ligne-icone">
                  <ArrowRightLeft size={22} />
                </span>
                <span className="tuile-ligne-texte">
                  <strong>Visite commune : sortie + entrée</strong>
                  <span className="texte-doux">
                    Le locataire sortant et le nouveau locataire le même jour : une seule visite, puis deux états des lieux séparés.{' '}
                    {entreeAvant
                      ? `Comparatif avec l'entrée ${entreeAvant.reference} du ${formatDate(entreeAvant.dateVisite)}.`
                      : "Aucune entrée signée de ce bien dans l'application : sortie sans comparatif automatique."}
                  </span>
                </span>
                <ChevronRight />
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section titre="Bien absent du patrimoine">
        <button className="carte tuile-ligne" onClick={creerFiche} disabled={enCours} style={{ marginBottom: 12 }}>
          <span className="tuile-ligne-icone">
            <Building2 size={22} />
          </span>
          <span className="tuile-ligne-texte">
            <strong>Créer la fiche du bien</strong>
            <span className="texte-doux">Enregistrée dans le patrimoine pour les prochaines fois, puis préparation de l'état des lieux</span>
          </span>
          <ChevronRight />
        </button>
        <button className="carte tuile-ligne" onClick={saisieLibre} disabled={enCours}>
          <span className="tuile-ligne-icone">
            <PencilLine size={22} />
          </span>
          <span className="tuile-ligne-texte">
            <strong>Saisie libre, sans fiche</strong>
            <span className="texte-doux">Adresse, type et pièces pas à pas (le bien pourra être ajouté au patrimoine ensuite)</span>
          </span>
          <ChevronRight />
        </button>
      </Section>
    </div>
  )
}

function Liste(props: { label: string; valeur: string; vide: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="champ">
      <span className="champ-label">{props.label}</span>
      <select className="saisie" value={props.valeur} onChange={(e) => props.onChange(e.target.value)}>
        <option value="">{props.vide}</option>
        {props.options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}
