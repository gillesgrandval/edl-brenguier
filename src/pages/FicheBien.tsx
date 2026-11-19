import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Building2, ChevronRight, ClipboardList, Plus, Trash2, Wand2 } from 'lucide-react'
import { db } from '../db/base'
import { maintenantLocal } from '../db/edl'
import { LIBELLE_CATEGORIE, creerEdlDepuisBien, enregistrerBien, supprimerBien } from '../db/patrimoine'
import type { Bien, CategorieBien, EquipementConnu, GenreElement, TypeCompteur } from '../db/types'
import { MODELES } from '../modeles/pieces'
import { GENRES } from '../modeles/comptes'
import { compositionDepuisTableau } from '../patrimoine/importExcel'
import { libelleActe, formatDate } from '../libelles'
import { Champ, Confirmation, Interrupteur, Section } from '../components/ui'
import Chargement from '../components/Chargement'

const COMPTEURS: [TypeCompteur, string][] = [
  ['electricite', 'Électricité'],
  ['eau_froide', 'Eau'],
  ['eau_chaude', 'Eau chaude'],
  ['gaz', 'Gaz'],
]
const enListe = (s: string) =>
  s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)

/** Fiche permanente d'un bien : caractéristiques, composition, compteurs, historique des états des lieux. */
export default function FicheBien() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [bien, setBien] = useState<Bien | null | undefined>(undefined)
  const minuterie = useRef<number | undefined>(undefined)
  const enAttente = useRef<Bien | null>(null)
  const [date, setDate] = useState(maintenantLocal().slice(0, 10))
  const [confirmer, setConfirmer] = useState(false)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    if (id) db.biens.get(id).then((b) => setBien(b ?? null))
  }, [id])
  // Enregistrement automatique (comme pour les états des lieux), et immédiat en quittant l'écran.
  useEffect(
    () => () => {
      window.clearTimeout(minuterie.current)
      if (enAttente.current) void enregistrerBien(enAttente.current)
    },
    [],
  )
  const historique = useLiveQuery(async () => (id ? (await db.edls.where('bienId').equals(id).toArray()).filter((e) => !e.corbeille).sort((a, b) => b.dateVisite.localeCompare(a.dateVisite)) : []), [id])

  if (bien === undefined || historique === undefined) return <Chargement />
  if (bien === null) return <Chargement introuvable />
  const b = bien

  function maj(f: (b: Bien) => void) {
    const copie = structuredClone(b)
    f(copie)
    setBien(copie)
    enAttente.current = copie
    window.clearTimeout(minuterie.current)
    minuterie.current = window.setTimeout(() => {
      enAttente.current = null
      void enregistrerBien(copie)
    }, 400)
  }
  const texte = (cle: keyof Bien) => (v: string) => maj((x) => void ((x as unknown as Record<string, unknown>)[cle] = v.trim() ? v : undefined))
  const nombre = (cle: 'chambres' | 'sallesEau' | 'wc') => (v: string) => maj((x) => void (x[cle] = v === '' ? undefined : Math.max(0, Math.round(Number(v) || 0))))

  async function preparer() {
    window.clearTimeout(minuterie.current)
    await enregistrerBien(b)
    enAttente.current = null
    const edl = await creerEdlDepuisBien(b, date)
    navigate(`/edl/${edl}`)
  }

  return (
    <div className="saisie-piece fiche-bien-page">
      <div className="piece-entete">
        <button className="bouton-icone" onClick={() => navigate('/patrimoine')} aria-label="Retour au patrimoine">
          <ArrowLeft />
        </button>
        <div className="piece-entete-titre">
          <div className="titre-modifiable">
            <Building2 size={24} />
            <h1>{b.reference || (b.lot ? `Lot ${b.lot}` : params.get('nouveau') ? 'Nouveau bien' : 'Bien sans référence')}</h1>
          </div>
          <div className="piece-entete-progression">
            <span>{[b.adresse, b.ville].filter(Boolean).join(', ') || 'Adresse à compléter'}</span>
          </div>
        </div>
      </div>

      <Section titre="Préparer un état des lieux">
        <div className="carte rubrique-carte">
          <div className="grille">
            <Champ type="date" label="Date de la visite" valeur={date} onChange={(v) => v && setDate(v)} aide="L'heure, le locataire et le type se complètent ensuite." />
          </div>
          <button className="bouton bouton-accent bouton-signer" onClick={preparer} disabled={!b.adresse || !b.ville}>
            Préparer l'état des lieux <ChevronRight size={22} />
          </button>
          {(!b.adresse || !b.ville) && <p className="texte-doux">Renseignez au moins l'adresse et la ville.</p>}
        </div>
        {historique.length > 0 && (
          <div className="carte rubrique-carte fiche-bien-historique" style={{ marginTop: 12 }}>
            <strong>
              <ClipboardList size={18} /> Historique des états des lieux ({historique.length})
            </strong>
            {historique.map((e) => (
              <button key={e.id} className="resultat-bien" onClick={() => navigate(`/edl/${e.id}`)}>
                <span>
                  {e.reference} · {libelleActe(e)} · {formatDate(e.dateVisite)} · {e.statut === 'signe' ? 'signé' : 'en préparation'}
                  {e.locataires.some((l) => l.nom.trim()) ? ` · ${e.locataires.filter((l) => l.nom.trim()).map((l) => l.nom).join(', ')}` : ''}
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section titre="Identification">
        <div className="carte rubrique-carte grille">
          <Champ label="Référence interne" valeur={b.reference} onChange={texte('reference')} placeholder="Ex. : Lot n° 5" />
          <Champ label="N° de lot" valeur={b.lot} onChange={texte('lot')} />
          <Champ label="Identifiant (fichier Excel)" valeur={b.identifiantExterne} onChange={texte('identifiantExterne')} aide="Sert à mettre à jour ce bien lors des imports" />
          <Champ label="Société propriétaire / gestionnaire" valeur={b.societe} onChange={texte('societe')} />
          <label className="champ">
            <span className="champ-label">Type de bien</span>
            <select className="saisie" value={b.categorie} onChange={(e) => maj((x) => void (x.categorie = e.target.value as CategorieBien))}>
              {Object.entries(LIBELLE_CATEGORIE).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Champ label="Typologie" valeur={b.typologie} onChange={texte('typologie')} placeholder="T1, T2, T3…" />
        </div>
      </Section>

      <Section titre="Adresse">
        <div className="carte rubrique-carte grille">
          <Champ label="Adresse" valeur={b.adresse} onChange={(v) => maj((x) => void (x.adresse = v))} large />
          <Champ label="Complément" valeur={b.complement} onChange={texte('complement')} />
          <Champ label="Code postal" valeur={b.codePostal} onChange={(v) => maj((x) => void (x.codePostal = v))} inputMode="numeric" />
          <Champ label="Ville" valeur={b.ville} onChange={(v) => maj((x) => void (x.ville = v))} />
          <Champ label="Résidence / immeuble / camping" valeur={b.residence} onChange={texte('residence')} />
          <Champ label="Bâtiment" valeur={b.batiment} onChange={texte('batiment')} />
          <Champ label="Étage / niveau" valeur={b.etage} onChange={texte('etage')} />
          <Champ label="N° de porte" valeur={b.porte} onChange={texte('porte')} />
        </div>
      </Section>

      <Section titre="Caractéristiques">
        <div className="carte rubrique-carte grille">
          <Champ label="Surface (m²)" valeur={b.surface} onChange={texte('surface')} inputMode="decimal" />
          <Champ label="Nombre de pièces" valeur={b.nbPieces} onChange={texte('nbPieces')} />
          <Champ label="Chambres" valeur={b.chambres?.toString()} onChange={nombre('chambres')} type="number" />
          <Champ label="Salles d'eau / de bains" valeur={b.sallesEau?.toString()} onChange={nombre('sallesEau')} type="number" />
          <Champ label="WC" valeur={b.wc?.toString()} onChange={nombre('wc')} type="number" />
          <Champ label="Annexes (séparées par des virgules)" valeur={b.annexes.join(', ')} onChange={(v) => maj((x) => void (x.annexes = enListe(v)))} large />
          <Champ label="Équipements connus (séparés par des virgules)" valeur={b.equipements.join(', ')} onChange={(v) => maj((x) => void (x.equipements = enListe(v)))} large />
          <Champ label="Boîte aux lettres : numéro" valeur={b.bal?.numero} onChange={(v) => maj((x) => void (x.bal = { ...x.bal, numero: v || undefined }))} />
          <Champ label="Boîte aux lettres : emplacement" valeur={b.bal?.emplacement} onChange={(v) => maj((x) => void (x.bal = { ...x.bal, emplacement: v || undefined }))} placeholder="ex. hall d'entrée" />
        </div>
        <div className="carte rubrique-carte" style={{ marginTop: 12 }}>
          <Interrupteur libelle="Location meublée" valeur={!!b.meuble} onChange={(v) => maj((x) => void (x.meuble = v))} />
        </div>
      </Section>

      <Section titre="Composition (pièces de la visite)">
        <p className="texte-doux" style={{ marginTop: 0 }}>
          Ces pièces et équipements sont créés à chaque nouvel état des lieux. Les modifier ici ne change pas les états des lieux déjà réalisés.
        </p>
        {b.pieces.map((p, i) => (
          <div key={i} className="carte rubrique-carte composition-piece">
            <div className="grille">
              <Champ label="Nom de la pièce" valeur={p.nom} onChange={(v) => maj((x) => void (x.pieces[i].nom = v))} />
              <label className="champ">
                <span className="champ-label">Modèle (éléments à contrôler)</span>
                <select className="saisie" value={p.modele} onChange={(e) => maj((x) => void (x.pieces[i].modele = e.target.value))}>
                  {MODELES.filter((m) => !m.special).map((m) => (
                    <option key={m.cle} value={m.cle}>
                      {m.nom}
                    </option>
                  ))}
                  <option value="libre">Pièce personnalisée (rubriques de base)</option>
                </select>
              </label>
              <Champ
                label="Équipements de cette pièce (séparés par des virgules)"
                valeur={(p.equipements ?? []).map((e) => e.libelle).join(', ')}
                onChange={(v) =>
                  maj((x) => {
                    const anciens = x.pieces[i].equipements ?? []
                    x.pieces[i].equipements = enListe(v).map((l): EquipementConnu => anciens.find((a) => a.libelle === l) ?? { libelle: l })
                  })
                }
                large
              />
            </div>
            <div className="grille grille-nombres">
              {(Object.keys(GENRES) as GenreElement[]).map((g) => (
                <label key={g} className="champ">
                  <span className="champ-label">{g === 'climatisation' ? 'Climatisations' : GENRES[g].libelle}</span>
                  <input
                    className="saisie"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    placeholder="Non renseigné"
                    value={p.quantites?.[g] ?? ''}
                    onChange={(e) =>
                      maj((x) => {
                        const v = e.target.value === '' ? undefined : Math.max(0, Math.min(99, Math.round(Number(e.target.value))))
                        const q = { ...x.pieces[i].quantites }
                        if (v === undefined || Number.isNaN(v)) delete q[g]
                        else q[g] = v
                        x.pieces[i].quantites = Object.keys(q).length ? q : undefined
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="texte-doux" style={{ marginTop: 4 }}>Nombres connus, repris « à vérifier » lors de chaque visite. Laisser vide si inconnu.</p>
            <button className="bouton bouton-discret bouton-petit bouton-danger-texte" onClick={() => maj((x) => void x.pieces.splice(i, 1))}>
              <Trash2 size={18} /> Retirer la pièce
            </button>
          </div>
        ))}
        <div className="actions-rapides">
          <label className="champ" style={{ flex: 1 }}>
            <span className="champ-label">
              <Plus size={14} /> Ajouter une pièce
            </span>
            <select
              className="saisie"
              value=""
              onChange={(e) => {
                const m = MODELES.find((x) => x.cle === e.target.value)
                if (m) maj((x) => void x.pieces.push({ modele: m.cle, nom: m.nom }))
              }}
            >
              <option value="">Choisir un type de pièce…</option>
              {MODELES.filter((m) => !m.special).map((m) => (
                <option key={m.cle} value={m.cle}>
                  {m.nom}
                </option>
              ))}
            </select>
          </label>
          {b.pieces.length === 0 && (b.chambres || b.sallesEau || b.wc || b.annexes.length > 0) && (
            <button className="bouton bouton-discret" onClick={() => maj((x) => void (x.pieces = compositionDepuisTableau(x)))}>
              <Wand2 size={20} /> Proposer d'après les caractéristiques
            </button>
          )}
        </div>
      </Section>

      <Section titre="Compteurs à relever">
        <div className="carte rubrique-carte">
          {COMPTEURS.map(([t, l]) => (
            <Interrupteur
              key={t}
              libelle={l}
              valeur={b.compteurs.includes(t)}
              onChange={(v) => maj((x) => void (x.compteurs = v ? [...new Set([...x.compteurs, t])] : x.compteurs.filter((c) => c !== t)))}
            />
          ))}
        </div>
      </Section>

      <Section titre="Informations complémentaires">
        <div className="carte rubrique-carte">
          <textarea className="saisie" rows={4} value={b.infos ?? ''} onChange={(e) => maj((x) => void (x.infos = e.target.value || undefined))} placeholder="Accès, digicode du parking, particularités…" />
        </div>
      </Section>

      <div className="zone-danger">
        {message && <p className="dictee-erreur">{message}</p>}
        <button className="bouton bouton-discret bouton-danger-texte" onClick={() => (historique.length ? setMessage('Cette fiche a des états des lieux : elle est conservée pour garder leur historique.') : setConfirmer(true))}>
          <Trash2 size={20} /> Supprimer cette fiche
        </button>
      </div>
      <Confirmation
        ouvert={confirmer}
        danger
        titre="Supprimer cette fiche ?"
        message="La fiche du bien sera effacée de cet appareil. Aucun état des lieux n'y est rattaché."
        libelleOk="Supprimer"
        onAnnuler={() => setConfirmer(false)}
        onOk={async () => {
          window.clearTimeout(minuterie.current)
          enAttente.current = null
          if (await supprimerBien(b.id)) navigate('/patrimoine', { replace: true })
          else setMessage('Suppression impossible : un état des lieux est rattaché à ce bien.')
        }}
      />
    </div>
  )
}
