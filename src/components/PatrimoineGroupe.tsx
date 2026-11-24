import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Download, Loader2, LockKeyhole } from 'lucide-react'
import { installationActuelle, installerPatrimoineGroupe, paquetLivre, type ResultatInstallation } from '../db/patrimoineGroupe'
import { formatDate } from '../libelles'
import { Fenetre } from './Admin'

/** Carte « Patrimoine du groupe » : installation des fiches chiffrées livrées avec l'application. */
export default function PatrimoineGroupe() {
  const paquet = useLiveQuery(paquetLivre, [])
  const installation = useLiveQuery(installationActuelle, [])
  const [ouvert, setOuvert] = useState(false)
  if (!paquet || installation === undefined) return null
  const aJour = installation?.version === paquet.version

  return (
    <section className="carte rubrique-carte" style={{ marginBottom: 16 }}>
      <div className="bloc-titre">
        <LockKeyhole size={16} /> Patrimoine du groupe
      </div>
      <p style={{ marginTop: 0 }}>
        {paquet.nombre} fiches de biens, établies d'après les anciens états des lieux, sont livrées <strong>chiffrées</strong> avec l'application.{' '}
        {aJour
          ? `Installées sur cet appareil le ${formatDate(installation!.installeLe, true)}.`
          : installation
            ? 'Une nouvelle version des fiches est disponible.'
            : 'Installez-les avec la phrase secrète du Groupe (une seule fois sur cet appareil).'}
      </p>
      <button className={`bouton ${aJour ? 'bouton-discret' : 'bouton-principal'}`} onClick={() => setOuvert(true)}>
        {aJour ? <Check size={20} /> : <Download size={20} />} {aJour ? 'Réinstaller' : installation ? 'Mettre à jour les fiches' : 'Installer le patrimoine du groupe'}
      </button>
      {ouvert && <FenetreInstallation onFermer={() => setOuvert(false)} />}
    </section>
  )
}

function FenetreInstallation({ onFermer }: { onFermer: () => void }) {
  const [phrase, setPhrase] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string>()
  const [resultat, setResultat] = useState<ResultatInstallation>()

  async function installer() {
    setEnCours(true)
    setErreur(undefined)
    try {
      setResultat(await installerPatrimoineGroupe(phrase))
      setPhrase('')
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Fenetre titre="Installer le patrimoine du groupe" onFermer={onFermer}>
      {resultat ? (
        <>
          <p>
            <Check size={18} /> <strong>Installation terminée</strong> : {resultat.ajoutes} fiche{resultat.ajoutes > 1 ? 's' : ''} ajoutée{resultat.ajoutes > 1 ? 's' : ''}
            {resultat.misAJour ? `, ${resultat.misAJour} mise${resultat.misAJour > 1 ? 's' : ''} à jour` : ''}.
          </p>
          {resultat.conservees > 0 && (
            <p className="texte-doux">
              {resultat.conservees} fiche{resultat.conservees > 1 ? 's' : ''} modifiée{resultat.conservees > 1 ? 's' : ''} sur cet appareil depuis la dernière installation {resultat.conservees > 1 ? 'ont été conservées' : 'a été conservée'} telle{resultat.conservees > 1 ? 's' : ''} quelle{resultat.conservees > 1 ? 's' : ''}.
            </p>
          )}
          <p className="texte-doux">Chaque fiche indique, dans ses informations, les états des lieux d'origine. Composition et nombres sont à vérifier lors de la prochaine visite.</p>
          <div className="dialogue-actions">
            <button className="bouton bouton-principal" onClick={onFermer}>
              Fermer
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="texte-doux">La phrase secrète vous a été communiquée par le Groupe. Elle n'est pas enregistrée sur l'appareil.</p>
          <label className="champ">
            <span className="champ-label">Phrase secrète</span>
            <input className="saisie" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus value={phrase} onChange={(e) => setPhrase(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && phrase && !enCours && void installer()} />
          </label>
          {erreur && <p className="texte-erreur">{erreur}</p>}
          <div className="dialogue-actions">
            <button className="bouton bouton-discret" onClick={onFermer}>
              Annuler
            </button>
            <button className="bouton bouton-principal" disabled={!phrase || enCours} onClick={installer}>
              {enCours ? <Loader2 size={20} className="tourne" /> : <Download size={20} />} {enCours ? 'Déchiffrement…' : 'Installer'}
            </button>
          </div>
        </>
      )}
    </Fenetre>
  )
}
