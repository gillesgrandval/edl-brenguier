import { useEffect, useState } from 'react'
import { CircleAlert, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { controlerPdfsLies, type ResultatControlePdf } from '../db/confidentialite'
import type { Edl } from '../db/types'
import { Interrupteur } from './ui'

/**
 * Contrôle anti-fuite des deux PDF d'une visite commune.
 * Les PDF sont fabriqués sur l'appareil, puis chacun est fouillé (texte de chaque
 * page et métadonnées) à la recherche des données du locataire de l'autre document.
 * `onPret(true)` : aucune fuite, ou seulement des noms vérifiés par l'opérateur.
 */
export default function ControleConfidentialite({ a, b, onPret }: { a: Edl; b: Edl; onPret: (pret: boolean) => void }) {
  const [resultat, setResultat] = useState<ResultatControlePdf | null>(null)
  const [erreur, setErreur] = useState<string>()
  const [verifie, setVerifie] = useState(false)
  const cle = `${a.id}:${a.modifieLe}:${b.id}:${b.modifieLe}`

  useEffect(() => {
    let actif = true
    setResultat(null)
    setErreur(undefined)
    onPret(false)
    // Petit délai : la saisie en cours est enregistrée avant la fabrication des PDF.
    const minuterie = window.setTimeout(() => {
      controlerPdfsLies(a, b)
        .then((r) => actif && setResultat(r))
        .catch((e) => actif && setErreur((e as Error).message))
    }, 600)
    return () => {
      actif = false
      window.clearTimeout(minuterie)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle])

  const fuites = resultat ? [a, b].flatMap((d) => resultat[d.id].map((f) => ({ ...f, doc: d }))) : []
  const certaines = fuites.filter((f) => f.certaine)
  const aVerifier = fuites.filter((f) => !f.certaine)
  const pret = !!resultat && !certaines.length && (!aVerifier.length || verifie)
  useEffect(() => onPret(pret), [pret, onPret])

  const nomDoc = (d: Edl) => `${d.typeActe === 'sortie' ? 'sortie' : 'entrée'} ${d.reference}`

  return (
    <div className="carte rubrique-carte">
      <div className="bloc-titre">
        <ShieldCheck size={16} /> Contrôle anti-fuite des deux PDF
      </div>
      {erreur ? (
        <p className="texte-erreur">Le contrôle n'a pas pu être effectué : {erreur}</p>
      ) : !resultat ? (
        <p className="texte-doux">
          <Loader2 size={16} className="tourne" /> Fabrication et vérification des PDF de la sortie et de l'entrée…
        </p>
      ) : fuites.length === 0 ? (
        <p style={{ margin: 0 }}>
          <span className="statut-rubrique statut-ok">
            <ShieldCheck size={16} /> Réussi
          </span>{' '}
          Aucun nom, téléphone, e-mail ni nouvelle adresse d'un locataire dans le PDF de l'autre, métadonnées du fichier comprises.
        </p>
      ) : (
        <>
          {certaines.length > 0 && (
            <div className="fuite">
              <ShieldAlert size={16} /> <strong>À corriger avant de signer :</strong>
              <ul>
                {certaines.map((f, i) => (
                  <li key={i}>
                    {f.texte} — PDF {nomDoc(f.doc)}, {f.ou}
                  </li>
                ))}
              </ul>
              Retirez cette donnée du document concerné (commentaires, observations), puis revenez ici.
            </div>
          )}
          {aVerifier.length > 0 && (
            <>
              <p>
                <CircleAlert size={16} /> <strong>À vérifier :</strong> {aVerifier.map((f) => `${f.texte} — PDF ${nomDoc(f.doc)}, ${f.ou}`).join(' ; ')}. Ce mot figure dans le PDF : c'est peut-être un mot courant (rue, élément…).
              </p>
              <Interrupteur libelle="J'ai vérifié : ce n'est pas une donnée de l'autre locataire" valeur={verifie} onChange={setVerifie} />
            </>
          )}
        </>
      )}
    </div>
  )
}
