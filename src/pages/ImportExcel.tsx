import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, Check, CircleX, Download, FileSpreadsheet, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { db, demanderStockagePersistant, nouvelId } from '../db/base'
import { LIBELLE_CATEGORIE } from '../db/patrimoine'
import { CHAMPS, analyserLignes, construireBien, devinerCorrespondance, type CleChamp, type Correspondance } from '../patrimoine/importExcel'
import { Section } from '../components/ui'
import Chargement from '../components/Chargement'

type Feuille = { nom: string; lignes: unknown[][] }

/**
 * Import du patrimoine depuis Excel :
 * 1. fichier · 2. correspondance des colonnes · 3. aperçu et erreurs · 4. import.
 * Ajoute ou met à jour les biens, sans doublon ; ne touche jamais aux états des lieux.
 */
export default function ImportExcel() {
  const navigate = useNavigate()
  const existants = useLiveQuery(() => db.biens.toArray(), [])
  const entree = useRef<HTMLInputElement>(null)
  const [nomFichier, setNomFichier] = useState('')
  const [feuilles, setFeuilles] = useState<Feuille[] | null>(null)
  const [feuille, setFeuille] = useState(0)
  const [ligneEntetes, setLigneEntetes] = useState(0)
  const [correspondance, setCorrespondance] = useState<Correspondance>({})
  const [etape, setEtape] = useState<'fichier' | 'colonnes' | 'apercu' | 'fini'>('fichier')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string>()
  const [bilan, setBilan] = useState<{ crees: number; maj: number; ignores: number }>()

  const lignes = feuilles?.[feuille]?.lignes ?? []
  const entetes = lignes[ligneEntetes] ?? []
  const donnees = useMemo(() => lignes.slice(ligneEntetes + 1), [lignes, ligneEntetes])
  const analyse = useMemo(() => (etape === 'apercu' && existants ? analyserLignes(donnees, correspondance, existants) : []), [etape, donnees, correspondance, existants])
  const utiles = analyse.filter((l) => l.action !== 'ignoree')
  const avecErreur = analyse.filter((l) => l.erreurs.length)

  if (existants === undefined) return <Chargement />

  async function lire(f: File) {
    setErreur(undefined)
    setEnCours(true)
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser')
      const lues = (await readXlsxFile(f)).map((s) => ({ nom: s.sheet, lignes: s.data as unknown[][] }))
      if (!lues.some((s) => s.lignes.length > 1)) throw new Error('Le fichier ne contient aucune ligne de données.')
      const i = Math.max(0, lues.findIndex((s) => s.lignes.length > 1))
      choisirFeuille(lues, i)
      setFeuilles(lues)
      setNomFichier(f.name)
      setEtape('colonnes')
    } catch (e) {
      setErreur('Lecture impossible : ' + ((e as Error).message || 'fichier Excel (.xlsx) attendu.'))
    } finally {
      setEnCours(false)
    }
  }

  /** La ligne d'en-têtes est la première ligne remplie ; on devine alors les colonnes. */
  function choisirFeuille(lues: Feuille[], i: number) {
    setFeuille(i)
    const l = lues[i].lignes
    const k = Math.max(0, l.findIndex((r) => r.filter((v) => v !== null && v !== '').length >= 2))
    setLigneEntetes(k)
    setCorrespondance(devinerCorrespondance(l[k] ?? []))
  }

  async function importer() {
    setEnCours(true)
    setErreur(undefined)
    try {
      await demanderStockagePersistant()
      const maintenant = new Date().toISOString()
      const biens = utiles.map((l) => construireBien(l, nouvelId, maintenant))
      await db.biens.bulkPut(biens) // une seule opération : tout ou rien
      setBilan({ crees: utiles.filter((l) => l.action === 'creation').length, maj: utiles.filter((l) => l.action === 'mise_a_jour').length, ignores: analyse.length - utiles.length })
      setEtape('fini')
    } catch (e) {
      setErreur('Import interrompu, rien n’a été enregistré : ' + (e as Error).message)
    } finally {
      setEnCours(false)
    }
  }

  async function telechargerModele() {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')
    const blob = await writeXlsxFile([CHAMPS.map((c) => ({ value: c.libelle, fontWeight: 'bold' as const }))], { columns: CHAMPS.map(() => ({ width: 24 })) }).toBlob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'Modele-patrimoine-Brenguier.xlsx'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const exemple = (c: number | undefined) => (c === undefined ? '' : String(donnees.find((l) => l[c] !== null && l[c] !== '')?.[c] ?? ''))

  return (
    <div className="saisie-piece import-excel">
      <div className="piece-entete">
        <button className="bouton-icone" onClick={() => navigate('/patrimoine')} aria-label="Retour au patrimoine">
          <ArrowLeft />
        </button>
        <div className="piece-entete-titre">
          <div className="titre-modifiable">
            <FileSpreadsheet size={24} />
            <h1>Importer depuis Excel</h1>
          </div>
          <div className="piece-entete-progression">
            <span>{nomFichier || 'Fichier .xlsx'}</span>
          </div>
        </div>
      </div>

      <ol className="etapes">
        {['Fichier', 'Colonnes', 'Aperçu', 'Terminé'].map((n, i) => {
          const pos = ['fichier', 'colonnes', 'apercu', 'fini'].indexOf(etape)
          return (
            <li key={n} className={i === pos ? 'etape-active' : i < pos ? 'etape-faite' : ''}>
              <button disabled>
                <span className="etape-numero">{i < pos ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                <span className="etape-nom">{n}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {erreur && <p className="dictee-erreur">{erreur}</p>}

      {etape === 'fichier' && (
        <Section titre="Choisir le fichier">
          <div className="carte rubrique-carte">
            <p style={{ marginTop: 0 }}>
              Un bien par ligne, avec une ligne d'en-têtes (Ville, Adresse, Lot, Type…). Les colonnes peuvent être dans n'importe quel ordre : vous indiquerez à l'étape suivante à quoi correspond chacune.
            </p>
            <input ref={entree} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => e.target.files?.[0] && lire(e.target.files[0])} />
            <div className="rapport-actions">
              <button className="bouton bouton-principal" onClick={() => entree.current?.click()} disabled={enCours}>
                {enCours ? <Loader2 size={20} className="tourne" /> : <FileSpreadsheet size={20} />} Choisir un fichier Excel
              </button>
              <button className="bouton bouton-discret" onClick={telechargerModele}>
                <Download size={20} /> Télécharger le modèle vide
              </button>
            </div>
            <p className="texte-doux" style={{ marginBottom: 0 }}>
              Réimporter un fichier mis à jour ne crée pas de doublon : les biens déjà présents sont mis à jour. Les états des lieux ne sont jamais modifiés.
            </p>
          </div>
        </Section>
      )}

      {etape === 'colonnes' && feuilles && (
        <Section titre="Correspondance des colonnes">
          <div className="carte rubrique-carte">
            {feuilles.length > 1 && (
              <label className="champ">
                <span className="champ-label">Feuille du classeur</span>
                <select className="saisie" value={feuille} onChange={(e) => choisirFeuille(feuilles, Number(e.target.value))}>
                  {feuilles.map((f, i) => (
                    <option key={f.nom} value={i}>
                      {f.nom} ({Math.max(0, f.lignes.length - 1)} lignes)
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="texte-doux">
              <Sparkles size={16} style={{ verticalAlign: '-3px' }} /> Colonnes reconnues automatiquement d'après les en-têtes (ligne {ligneEntetes + 1}). Vérifiez et corrigez si besoin. {donnees.length} ligne{donnees.length > 1 ? 's' : ''} de données.
            </p>
            <div className="correspondance">
              {CHAMPS.map((c) => (
                <label key={c.cle} className="correspondance-ligne">
                  <span className="correspondance-champ">
                    {c.libelle}
                    {c.obligatoire && <strong className="obligatoire"> *</strong>}
                  </span>
                  <select
                    className="saisie"
                    value={correspondance[c.cle] ?? ''}
                    onChange={(e) => setCorrespondance((x) => ({ ...x, [c.cle]: e.target.value === '' ? undefined : Number(e.target.value) }) as Record<CleChamp, number>)}
                  >
                    <option value="">— Aucune colonne —</option>
                    {entetes.map((t, i) => (
                      <option key={i} value={i}>
                        {String(t ?? `Colonne ${i + 1}`)}
                      </option>
                    ))}
                  </select>
                  <span className="correspondance-exemple">{exemple(correspondance[c.cle])}</span>
                </label>
              ))}
            </div>
            <div className="rapport-actions" style={{ marginTop: 16 }}>
              <button className="bouton bouton-discret" onClick={() => (setEtape('fichier'), setFeuilles(null), setNomFichier(''))}>
                <RefreshCw size={20} /> Autre fichier
              </button>
              <button className="bouton bouton-principal" onClick={() => setEtape('apercu')} disabled={correspondance.adresse === undefined || correspondance.ville === undefined}>
                Voir l'aperçu <Check size={20} />
              </button>
            </div>
            {(correspondance.adresse === undefined || correspondance.ville === undefined) && <p className="texte-doux">L'adresse et la ville sont indispensables.</p>}
          </div>
        </Section>
      )}

      {etape === 'apercu' && (
        <Section titre="Aperçu avant import">
          <div className="carte rubrique-carte">
            <div className="bilan-import">
              <span className="statut-rubrique statut-ok">{analyse.filter((l) => l.action === 'creation').length} nouveaux biens</span>
              <span className="statut-rubrique statut-ok">{analyse.filter((l) => l.action === 'mise_a_jour').length} mises à jour</span>
              {avecErreur.length > 0 && <span className="statut-rubrique statut-alerte">{avecErreur.length} ligne{avecErreur.length > 1 ? 's' : ''} en erreur (ignorée{avecErreur.length > 1 ? 's' : ''})</span>}
            </div>
            <div className="apercu-tableau">
              <table>
                <thead>
                  <tr>
                    <th>Ligne</th>
                    <th>Action</th>
                    <th>Bien</th>
                    <th>Type</th>
                    <th>Remarques</th>
                  </tr>
                </thead>
                <tbody>
                  {analyse
                    .filter((l) => l.action !== 'ignoree' || l.erreurs.length)
                    .slice(0, 300)
                    .map((l) => (
                      <tr key={l.numero} className={l.erreurs.length ? 'ligne-erreur' : ''}>
                        <td>{l.numero}</td>
                        <td>{l.erreurs.length ? <CircleX size={18} /> : l.action === 'creation' ? 'Nouveau' : 'Mise à jour'}</td>
                        <td>
                          <strong>{l.valeurs.reference || (l.valeurs.lot ? `Lot ${l.valeurs.lot}` : l.valeurs.identifiantExterne) || (l.existant && (l.existant.reference || l.existant.lot)) || '—'}</strong>
                          <br />
                          {[l.valeurs.adresse ?? l.existant?.adresse, l.valeurs.ville ?? l.existant?.ville].filter(Boolean).join(', ')}
                        </td>
                        <td>{l.valeurs.categorie ? LIBELLE_CATEGORIE[l.valeurs.categorie] : ''} {l.valeurs.typologie}</td>
                        <td>
                          {[...l.erreurs, ...l.avertissements].map((m) => (
                            <div key={m} className={l.erreurs.includes(m) ? 'texte-erreur' : 'texte-alerte'}>
                              {l.erreurs.includes(m) ? <CircleX size={14} /> : <AlertTriangle size={14} />} {m}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="rapport-actions" style={{ marginTop: 16 }}>
              <button className="bouton bouton-discret" onClick={() => setEtape('colonnes')}>
                <ArrowLeft size={20} /> Corriger les colonnes
              </button>
              <button className="bouton bouton-accent" onClick={importer} disabled={!utiles.length || enCours}>
                {enCours ? <Loader2 size={20} className="tourne" /> : <Check size={20} />} Importer {utiles.length} bien{utiles.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </Section>
      )}

      {etape === 'fini' && bilan && (
        <Section titre="Import terminé">
          <div className="carte rubrique-carte signe-bandeau">
            <Check size={28} />
            <div>
              <strong>
                {bilan.crees} bien{bilan.crees > 1 ? 's' : ''} ajouté{bilan.crees > 1 ? 's' : ''}, {bilan.maj} mis à jour
              </strong>
              <span>{bilan.ignores ? `${bilan.ignores} ligne(s) vide(s) ou en erreur ignorée(s).` : 'Aucune ligne ignorée.'} Les états des lieux existants n'ont pas été modifiés.</span>
            </div>
          </div>
          <button className="bouton bouton-principal" style={{ marginTop: 16 }} onClick={() => navigate('/patrimoine')}>
            Voir le patrimoine
          </button>
        </Section>
      )}
    </div>
  )
}
