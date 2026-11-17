import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowRight, Gauge, GitCompareArrows, Info, KeyRound } from 'lucide-react'
import { db } from '../db/base'
import { useEdl } from '../hooks/useEdl'
import { comparer, consommation, type LigneComparatif } from '../db/sortie'
import type { Degradation } from '../db/types'
import { ETATS, formatDate } from '../libelles'
import { Champ, Interrupteur, Section, Verrou } from '../components/ui'
import Chargement from '../components/Chargement'

const euros = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const code = (etat?: string) => ETATS.find((e) => e.cle === etat)

/**
 * Comparatif entrée / sortie : compteurs, clés, éléments dégradés,
 * et part du locataire après application de la grille de vétusté.
 */
export default function Comparatif() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { edl, modifier, sauvegarde } = useEdl(id)
  const idEntree = edl?.edlEntreeId
  // Le résultat porte l'identifiant demandé : on attend la bonne entrée avant d'afficher.
  const charge = useLiveQuery(async () => ({ id: idEntree, edl: idEntree ? ((await db.edls.get(idEntree)) ?? null) : null }), [idEntree])

  if (edl === undefined || !charge || (edl && charge.id !== edl.edlEntreeId)) return <Chargement />
  const entree = charge.edl
  if (!edl) return <Chargement introuvable />

  const lignes = comparer(edl, entree)
  const degradees = lignes.filter((l) => l.evolution === 'degradation' || l.degradation)
  const total = degradees.reduce((s, l) => s + (l.montant ?? 0), 0)
  const dateEntree = entree?.dateVisite

  const majDeg = (eid: string, f: (d: Degradation) => void, defaut: boolean) =>
    modifier((e) => {
      e.degradations ??= {}
      const d = e.degradations[eid] ?? { imputable: defaut }
      f(d)
      e.degradations[eid] = d
    })

  return (
    <div className="saisie-piece comparatif">
      <div className="piece-entete">
        <button className="bouton-icone" onClick={() => navigate(`/edl/${edl.id}`)} aria-label="Retour au tableau de bord">
          <ArrowLeft />
        </button>
        <div className="piece-entete-titre">
          <div className="titre-modifiable">
            <GitCompareArrows size={24} />
            <h1>Comparatif entrée / sortie</h1>
          </div>
          <div className="piece-entete-progression">
            <span>
              {entree ? `Entrée ${entree.reference} du ${formatDate(entree.dateVisite)}` : 'Entrée introuvable sur cet appareil'} · Sortie du {formatDate(edl.dateVisite)}
            </span>
            <span className={`indicateur-sauvegarde ${sauvegarde}`}>{sauvegarde === 'ok' ? 'Enregistré' : '…'}</span>
          </div>
        </div>
      </div>

      {!entree && <p className="dictee-erreur">L'état des lieux d'entrée n'est pas sur cet appareil : la comparaison est impossible.</p>}

      <Verrou actif={edl.statut === 'signe'} signeLe={edl.cloture?.signeLe}>
        <Section titre="Compteurs">
          <div className="carte rubrique-carte apercu-tableau">
            <table>
              <thead>
                <tr>
                  <th>
                    <Gauge size={16} /> Compteur
                  </th>
                  <th>Entrée</th>
                  <th>Sortie</th>
                  <th>Consommation</th>
                </tr>
              </thead>
              <tbody>
                {(edl.compteurs ?? []).map((c) => {
                  const e = entree?.compteurs?.find((x) => x.id === c.id || x.type === c.type)
                  const conso = consommation(e?.index, c.index)
                  return (
                    <tr key={c.id}>
                      <td>{c.libelle}</td>
                      <td>{e?.nonApplicable ? 'Sans objet' : (e?.index ?? '—')}</td>
                      <td>{c.nonApplicable ? 'Sans objet' : (c.index ?? 'À relever')}</td>
                      <td className={conso !== undefined && conso < 0 ? 'texte-erreur' : ''}>{conso !== undefined ? conso.toLocaleString('fr-FR') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section titre="Clés et accès">
          <div className="carte rubrique-carte apercu-tableau">
            <table>
              <thead>
                <tr>
                  <th>
                    <KeyRound size={16} /> Désignation
                  </th>
                  <th>Remis à l'entrée</th>
                  <th>Restitués</th>
                </tr>
              </thead>
              <tbody>
                {(edl.cles ?? []).map((c) => {
                  const remis = entree?.cles?.find((x) => x.id === c.id)?.nombre
                  return (
                    <tr key={c.id} className={remis !== undefined && c.nombre < remis ? 'ligne-erreur' : ''}>
                      <td>{c.libelle}</td>
                      <td>{remis ?? '—'}</td>
                      <td>{c.nombre}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section titre={`Dégradations constatées (${degradees.length})`}>
          <p className="texte-doux note-vetuste">
            <Info size={16} /> La vétusté (usure normale due au temps) reste à la charge du bailleur. Elle est calculée avec une <strong>grille indicative</strong> (à valider par le Groupe Brenguier),
            à partir de la date de pose ou de rénovation de l'élément — par défaut, la date d'entrée. Les montants sont des estimations.
          </p>
          {degradees.length === 0 && <p className="recap-complet">Aucune dégradation : tous les éléments comparables sont dans un état égal ou meilleur qu'à l'entrée.</p>}
          {degradees.map((l) => (
            <LigneDegradation key={l.element.id} l={l} dateEntree={dateEntree} maj={(f) => majDeg(l.element.id, f, l.evolution === 'degradation')} />
          ))}
          {degradees.length > 0 && (
            <div className="carte total-degradations">
              <span>Total estimé à la charge du locataire</span>
              <strong>{euros(total)}</strong>
            </div>
          )}
        </Section>

        <Section titre="Tous les éléments">
          <details className="details">
            <summary>Afficher le comparatif complet ({lignes.length} éléments)</summary>
            <div className="apercu-tableau">
              <table>
                <thead>
                  <tr>
                    <th>Pièce</th>
                    <th>Élément</th>
                    <th>Entrée</th>
                    <th></th>
                    <th>Sortie</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.element.id} className={l.evolution === 'degradation' ? 'ligne-erreur' : ''}>
                      <td>{l.piece}</td>
                      <td>{l.element.libelle}</td>
                      <td>{l.evolution === 'nouveau' ? 'Ajouté' : (code(l.entree?.etat)?.code ?? '—')}</td>
                      <td>
                        <ArrowRight size={14} />
                      </td>
                      <td>{code(l.element.etat)?.code ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Section>
      </Verrou>
    </div>
  )
}

function LigneDegradation({ l, dateEntree, maj }: { l: LigneComparatif; dateEntree?: string; maj: (f: (d: Degradation) => void) => void }) {
  const d = l.degradation
  const imputable = d ? d.imputable : l.evolution === 'degradation'
  const avant = code(l.entree?.etat)
  const apres = code(l.element.etat)
  const constat = [...l.element.observations, l.element.localisation, l.element.commentaire].filter(Boolean).join(' · ')
  return (
    <div className="carte rubrique-carte ligne-degradation">
      <div className="ligne-degradation-titre">
        <div>
          <strong>
            {l.piece} — {l.element.libelle}
          </strong>
          <span className="texte-doux">
            {avant?.code ?? '—'} → {apres?.code ?? '—'}
            {constat ? ` · ${constat}` : ''}
          </span>
        </div>
        <span className="pastille-entree">{l.categorie}</span>
      </div>
      <Interrupteur libelle="Imputable au locataire" valeur={imputable} onChange={(v) => maj((x) => void (x.imputable = v))} />
      {imputable && (
        <>
          <div className="grille grille-3">
            <Champ
              type="date"
              label="Posé ou rénové le"
              valeur={d?.depuis ?? dateEntree?.slice(0, 10)}
              onChange={(v) => maj((x) => void (x.depuis = v || undefined))}
              aide={d?.depuis ? undefined : "Par défaut : date d'entrée"}
            />
            <Champ
              label="Coût de remise en état (€ TTC)"
              valeur={d?.cout?.toString().replace('.', ',')}
              inputMode="decimal"
              onChange={(v) => maj((x) => void (x.cout = v.trim() ? Number(v.replace(',', '.').replace(/[^\d.]/g, '')) || 0 : undefined))}
            />
            <Champ label="Commentaire" valeur={d?.commentaire} onChange={(v) => maj((x) => void (x.commentaire = v || undefined))} />
          </div>
          <div className="calcul-vetuste">
            <span>
              Âge : <strong>{l.age.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} an{l.age >= 2 ? 's' : ''}</strong>
            </span>
            <span>
              Vétusté : <strong>{l.vetuste} %</strong>
            </span>
            <span>
              Part locataire : <strong>{l.partLocataire} %</strong>
            </span>
            {l.montant !== undefined && (
              <span className="calcul-montant">
                Soit <strong>{euros(l.montant)}</strong>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
