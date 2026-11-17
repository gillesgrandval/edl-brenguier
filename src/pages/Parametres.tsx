import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Download, FileSpreadsheet, HardDriveDownload, HardDriveUpload, Landmark, Loader2, Percent, RotateCcw, ScrollText, Settings, Share2, Trash2, UserRound } from 'lucide-react'
import { db } from '../db/base'
import { ecrireParametres, useParametres, PARAMETRES_DEFAUT } from '../db/parametres'
import { CLE_DERNIERE, creerSauvegarde, restaurerSauvegarde, type BilanRestauration } from '../db/sauvegarde'
import type { Entite } from '../db/types'
import type { CategorieVetuste } from '../modeles/vetuste'
import { formatDate } from '../libelles'
import { Champ, Confirmation, Interrupteur, Section } from '../components/ui'
import Chargement from '../components/Chargement'

type Fichier = { blob: Blob; nom: string; detail?: string }

/** Fichier prêt : Enregistrer (téléchargement) ou Partager (Drive, e-mail… via Android). */
function FichierPret({ f }: { f: Fichier }) {
  const url = useMemo(() => URL.createObjectURL(f.blob), [f.blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const fichier = new File([f.blob], f.nom, { type: f.blob.type })
  const partageable = !!navigator.canShare?.({ files: [fichier] })
  return (
    <div className="fichier-pret">
      <span className="texte-doux">
        {f.nom} · {(f.blob.size / 1024 / 1024).toFixed(1).replace('.', ',')} Mo{f.detail ? ` · ${f.detail}` : ''}
      </span>
      <div className="rapport-actions">
        <a className="bouton bouton-accent" href={url} download={f.nom}>
          <Download size={20} /> Enregistrer
        </a>
        {partageable && (
          <button className="bouton bouton-principal" onClick={() => navigator.share({ files: [fichier], title: f.nom }).catch(() => undefined)}>
            <Share2 size={20} /> Partager (Drive, e-mail…)
          </button>
        )}
      </div>
    </div>
  )
}

/** Champ texte enregistré 0,5 s après la dernière frappe (aucune lettre perdue pendant l'enregistrement). */
function ChampDiffere(props: { label: string; valeur?: string; onSave: (v: string) => void; placeholder?: string; large?: boolean; multiligne?: boolean; inputMode?: 'numeric' }) {
  const [v, setV] = useState(props.valeur ?? '')
  const minuterie = useRef<number | undefined>(undefined)
  const sauver = useRef(props.onSave)
  sauver.current = props.onSave
  const changer = (x: string) => {
    setV(x)
    window.clearTimeout(minuterie.current)
    minuterie.current = window.setTimeout(() => sauver.current(x), 500)
  }
  useEffect(() => () => window.clearTimeout(minuterie.current), [])
  if (props.multiligne) return <textarea className="saisie" rows={4} value={v} placeholder={props.placeholder} onChange={(e) => changer(e.target.value)} onBlur={() => sauver.current(v)} />
  return <Champ label={props.label} valeur={v} onChange={changer} placeholder={props.placeholder} large={props.large} inputMode={props.inputMode} />
}

export default function Parametres() {
  const parametres = useParametres()
  const entites = useLiveQuery(() => db.entites.orderBy('raisonSociale').toArray(), [])
  const derniere = useLiveQuery(async () => (await db.meta.get(CLE_DERNIERE))?.valeur as string | undefined, [])
  const [sauvegarde, setSauvegarde] = useState<Fichier | null>(null)
  const [progres, setProgres] = useState<string>()
  const [restauration, setRestauration] = useState<File | null>(null)
  const [bilan, setBilan] = useState<BilanRestauration>()
  const [erreur, setErreur] = useState<string>()
  const [exports, setExports] = useState<Record<string, Fichier>>({})
  const [enCours, setEnCours] = useState<string>()
  const [reinitGrille, setReinitGrille] = useState(false)
  const entreeRestauration = useRef<HTMLInputElement>(null)

  if (!parametres || !entites) return <Chargement />

  async function sauvegarder() {
    setErreur(undefined)
    setEnCours('sauvegarde')
    try {
      const s = await creerSauvegarde((fait, total) => setProgres(`Photos ${fait} / ${total}…`))
      setSauvegarde({ blob: s.blob, nom: s.nom, detail: s.resume })
    } catch (e) {
      setErreur('Sauvegarde impossible : ' + (e as Error).message)
    } finally {
      setEnCours(undefined)
      setProgres(undefined)
    }
  }

  async function restaurer() {
    if (!restauration) return
    setErreur(undefined)
    setEnCours('restauration')
    try {
      setBilan(await restaurerSauvegarde(restauration))
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnCours(undefined)
      setRestauration(null)
    }
  }

  async function exporter(type: 'edl' | 'patrimoine') {
    setEnCours(type)
    try {
      const { exporterEtatsDesLieux, exporterPatrimoine } = await import('../patrimoine/exportExcel')
      const d = new Date().toISOString().slice(0, 10)
      const blob = type === 'edl' ? await exporterEtatsDesLieux() : await exporterPatrimoine()
      setExports((x) => ({ ...x, [type]: { blob, nom: type === 'edl' ? `Etats-des-lieux-${d}.xlsx` : `Patrimoine-${d}.xlsx` } }))
    } catch (e) {
      setErreur('Export impossible : ' + (e as Error).message)
    } finally {
      setEnCours(undefined)
    }
  }

  const majEntite = (id: string, champ: keyof Entite, v: string) => (champ === 'raisonSociale' && !v.trim() ? undefined : db.entites.update(id, { [champ]: v.trim() || undefined }))
  const ancienne = derniere ? (Date.now() - new Date(derniere).getTime()) / 86400000 : Infinity

  return (
    <div className="saisie-piece parametres">
      <div className="piece-entete">
        <div className="piece-entete-titre">
          <div className="titre-modifiable">
            <Settings size={24} />
            <h1>Paramètres</h1>
          </div>
          <div className="piece-entete-progression">
            <span>Version {__APP_VERSION__}</span>
          </div>
        </div>
      </div>

      {erreur && <p className="dictee-erreur">{erreur}</p>}

      <Section titre="Sauvegarde">
        <div className="carte rubrique-carte" id="sauvegarde">
          <p style={{ marginTop: 0 }}>
            Toutes les données sont <strong>uniquement sur cet appareil</strong>. Une sauvegarde régulière, rangée ailleurs (Google Drive, ordinateur), les protège en cas de perte ou de panne.
          </p>
          <p className={ancienne > 7 ? 'attention' : 'texte-doux'}>{derniere ? `Dernière sauvegarde : ${formatDate(derniere, true)}` : 'Aucune sauvegarde pour le moment.'}</p>
          <button className="bouton bouton-principal" onClick={sauvegarder} disabled={!!enCours}>
            {enCours === 'sauvegarde' ? <Loader2 size={20} className="tourne" /> : <HardDriveDownload size={20} />} {enCours === 'sauvegarde' ? (progres ?? 'Préparation…') : 'Créer une sauvegarde complète'}
          </button>
          {sauvegarde && <FichierPret f={sauvegarde} />}
        </div>

        <div className="carte rubrique-carte" style={{ marginTop: 12 }}>
          <strong>Restaurer une sauvegarde</strong>
          <p className="texte-doux">
            Ajoute les éléments absents et met à jour ceux qui sont plus récents dans la sauvegarde. <strong>Rien n'est supprimé</strong>, et un état des lieux signé sur cet appareil n'est jamais remplacé.
          </p>
          <input ref={entreeRestauration} type="file" accept=".zip,application/zip" hidden onChange={(e) => e.target.files?.[0] && setRestauration(e.target.files[0])} />
          <button className="bouton bouton-discret" onClick={() => entreeRestauration.current?.click()} disabled={!!enCours}>
            {enCours === 'restauration' ? <Loader2 size={20} className="tourne" /> : <HardDriveUpload size={20} />} Choisir une sauvegarde (.zip)
          </button>
          {bilan && (
            <p className="recap-complet">
              <Check size={18} strokeWidth={3} /> Restauration terminée : {bilan.ajoutes} état(s) des lieux ajouté(s), {bilan.misAJour} mis à jour, {bilan.photos} photo(s) ajoutée(s)
              {bilan.signesProteges ? `, ${bilan.signesProteges} état(s) signé(s) conservé(s) tel(s) quel(s)` : ''}.
            </p>
          )}
        </div>
      </Section>

      <Section titre="Exports Excel">
        <div className="carte rubrique-carte">
          <div className="rapport-actions">
            <button className="bouton bouton-discret" onClick={() => exporter('edl')} disabled={!!enCours}>
              {enCours === 'edl' ? <Loader2 size={20} className="tourne" /> : <FileSpreadsheet size={20} />} Liste des états des lieux
            </button>
            <button className="bouton bouton-discret" onClick={() => exporter('patrimoine')} disabled={!!enCours}>
              {enCours === 'patrimoine' ? <Loader2 size={20} className="tourne" /> : <FileSpreadsheet size={20} />} Patrimoine
            </button>
          </div>
          <p className="texte-doux" style={{ marginBottom: 0 }}>
            L'export du patrimoine a les mêmes colonnes que l'import : modifiez-le dans Excel, puis réimportez-le depuis « Patrimoine » sans créer de doublon.
          </p>
          {exports.edl && <FichierPret f={exports.edl} />}
          {exports.patrimoine && <FichierPret f={exports.patrimoine} />}
        </div>
      </Section>

      <Section titre="Opérateur par défaut">
        <div className="carte rubrique-carte grille">
          <ChampDiffere
            label="Nom de la personne qui réalise les états des lieux"
            valeur={parametres.operateur?.nom}
            onSave={(v) => ecrireParametres((p) => void (p.operateur = v.trim() || p.operateur?.qualite ? { nom: v.trim(), qualite: p.operateur?.qualite } : undefined))}
          />
          <ChampDiffere label="Qualité" valeur={parametres.operateur?.qualite} placeholder="Gestionnaire, mandataire…" onSave={(v) => ecrireParametres((p) => void (p.operateur = { nom: p.operateur?.nom ?? '', qualite: v.trim() || undefined }))} />
        </div>
        <p className="texte-doux">
          <UserRound size={16} style={{ verticalAlign: '-3px' }} /> Repris automatiquement dans chaque nouvel état des lieux (modifiable ensuite).
        </p>
      </Section>

      <Section titre="Entités du groupe (bailleurs)">
        {entites.length === 0 && <p className="texte-doux">Aucune entité : elles s'ajoutent lors de la saisie des parties d'un état des lieux.</p>}
        {entites.map((e) => (
          <div key={e.id} className="carte rubrique-carte composition-piece">
            <div className="grille">
              <ChampDiffere label="Raison sociale" valeur={e.raisonSociale} onSave={(v) => majEntite(e.id, 'raisonSociale', v)} />
              <ChampDiffere label="SIREN" valeur={e.siren} inputMode="numeric" onSave={(v) => majEntite(e.id, 'siren', v)} />
              <ChampDiffere label="Adresse du siège" valeur={e.adresse} onSave={(v) => majEntite(e.id, 'adresse', v)} large />
              <ChampDiffere label="Représentant légal" valeur={e.representant} onSave={(v) => majEntite(e.id, 'representant', v)} large />
            </div>
            <button className="bouton bouton-discret bouton-petit bouton-danger-texte" onClick={() => db.entites.delete(e.id)}>
              <Trash2 size={18} /> Retirer de la liste
            </button>
          </div>
        ))}
        <p className="texte-doux">
          <Landmark size={16} style={{ verticalAlign: '-3px' }} /> Une modification s'applique aux prochains états des lieux ; ceux déjà saisis gardent leurs informations.
        </p>
      </Section>

      <Section titre="Grille de vétusté">
        <div className="carte rubrique-carte">
          <p style={{ marginTop: 0 }}>
            <Percent size={16} style={{ verticalAlign: '-3px' }} /> Pour chaque catégorie : années sans abattement (franchise), abattement par an, et part qui reste toujours imputable (valeur résiduelle). Une sortie signée garde la grille du jour de sa signature.
          </p>
          <div className="apercu-tableau">
            <table className="table-grille">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Franchise (ans)</th>
                  <th>Abattement (%/an)</th>
                  <th>Résiduel (%)</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(parametres.grille) as CategorieVetuste[]).map((cat) => {
                  const g = parametres.grille[cat]
                  const champ = (k: 'franchise' | 'abattement' | 'residuel', max: number) => (
                    <input
                      className="saisie saisie-nombre"
                      type="number"
                      min={0}
                      max={max}
                      step={k === 'franchise' ? 0.5 : 1}
                      value={g[k]}
                      onChange={(ev) => ecrireParametres((p) => void (p.grille[cat] = { ...p.grille[cat], [k]: Math.min(max, Math.max(0, Number(ev.target.value) || 0)) }))}
                      aria-label={`${g.libelle} : ${k}`}
                    />
                  )
                  return (
                    <tr key={cat}>
                      <td>{g.libelle}</td>
                      <td>{champ('franchise', 30)}</td>
                      <td>{champ('abattement', 100)}</td>
                      <td>{champ('residuel', 100)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Interrupteur
            libelle="Grille validée par le Groupe Brenguier (annexée aux baux)"
            valeur={parametres.grilleValidee}
            onChange={(v) => ecrireParametres((p) => void (p.grilleValidee = v))}
          />
          <p className="texte-doux">{parametres.grilleValidee ? 'Le rapport PDF indique « grille de vétusté du bailleur ».' : 'Tant qu’elle n’est pas validée, le rapport PDF la présente comme « grille indicative ».'}</p>
          <button className="bouton bouton-discret bouton-petit" onClick={() => setReinitGrille(true)}>
            <RotateCcw size={18} /> Revenir à la grille indicative
          </button>
        </div>
      </Section>

      <Section titre="Mentions du rapport PDF">
        <div className="carte rubrique-carte">
          <p className="texte-doux" style={{ marginTop: 0 }}>
            <ScrollText size={16} style={{ verticalAlign: '-3px' }} /> Ajoutées à la fin des mentions légales de chaque rapport (une mention par ligne).
          </p>
          <ChampDiffere label="Mentions" multiligne valeur={parametres.mentionsPdf} placeholder="Ex. : Contact gestion locative : …" onSave={(v) => ecrireParametres((p) => void (p.mentionsPdf = v.trim() || undefined))} />
        </div>
      </Section>

      <Confirmation
        ouvert={!!restauration}
        titre="Restaurer cette sauvegarde ?"
        message={
          <>
            <strong>{restauration?.name}</strong>
            <br />
            Les éléments absents seront ajoutés et les plus récents mis à jour. Rien ne sera supprimé.
          </>
        }
        libelleOk="Restaurer"
        onAnnuler={() => setRestauration(null)}
        onOk={restaurer}
      />
      <Confirmation
        ouvert={reinitGrille}
        titre="Revenir à la grille indicative ?"
        message="Vos valeurs de vétusté seront remplacées par la grille indicative d'origine. Les sorties déjà signées ne changent pas."
        libelleOk="Revenir à la grille indicative"
        onAnnuler={() => setReinitGrille(false)}
        onOk={() => {
          setReinitGrille(false)
          void ecrireParametres((p) => {
            p.grille = PARAMETRES_DEFAUT.grille
            p.grilleValidee = false
          })
        }}
      />
    </div>
  )
}
