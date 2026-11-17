import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileText, Loader2, Share2 } from 'lucide-react'
import type { Edl } from '../db/types'

/**
 * Fabrique le rapport PDF sur la tablette, puis propose :
 * Ouvrir · Partager (e-mail, WhatsApp… via Android) · Enregistrer dans les fichiers.
 * Avant signature, le PDF est un projet (filigrane « PROJET »).
 */
export default function BoutonsRapport({ edl }: { edl: Edl }) {
  const [etat, setEtat] = useState<'repos' | 'en_cours' | 'pret'>('repos')
  const [progres, setProgres] = useState('')
  const [pdf, setPdf] = useState<{ blob: Blob; url: string; nom: string } | null>(null)
  const [erreur, setErreur] = useState<string>()
  const signe = edl.statut === 'signe'

  // Un PDF déjà fabriqué n'est plus à jour si l'état des lieux change.
  useEffect(() => {
    setEtat('repos')
    setPdf((p) => {
      if (p) URL.revokeObjectURL(p.url)
      return null
    })
  }, [edl.modifieLe, edl.statut])

  useEffect(() => () => void (pdf && URL.revokeObjectURL(pdf.url)), [pdf])

  async function generer() {
    setEtat('en_cours')
    setErreur(undefined)
    setProgres('Préparation…')
    try {
      // Le moteur PDF n'est chargé qu'au premier rapport (il est déjà sur la tablette).
      const { genererRapport, nomFichier } = await import('../rapport/rapport')
      const blob = await genererRapport(edl, (etape, fait, total) => setProgres(total ? `${etape} ${(fait ?? 0) + 1} / ${total}…` : `${etape}…`))
      setPdf({ blob, url: URL.createObjectURL(blob), nom: nomFichier(edl) })
      setEtat('pret')
    } catch (e) {
      setErreur('Le rapport n’a pas pu être fabriqué : ' + (e as Error).message)
      setEtat('repos')
    }
  }

  const fichier = pdf ? new File([pdf.blob], pdf.nom, { type: 'application/pdf' }) : null
  const partageable = !!fichier && !!navigator.canShare?.({ files: [fichier] })

  async function partager() {
    if (!fichier) return
    try {
      await navigator.share({ files: [fichier], title: pdf!.nom })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErreur('Partage impossible : ' + (e as Error).message)
    }
  }

  return (
    <div className="carte rapport">
      <div className="rapport-entete">
        <FileText size={26} />
        <div>
          <strong>{signe ? 'Rapport PDF' : 'Aperçu du rapport (projet)'}</strong>
          <span className="texte-doux">
            {signe ? 'Version signée, avec empreinte et annexe photos.' : 'Pour relire avant signature. Chaque page porte la mention « PROJET ».'}
          </span>
        </div>
      </div>

      {etat === 'repos' && (
        <button className={`bouton ${signe ? 'bouton-accent' : 'bouton-discret'}`} onClick={generer}>
          <FileText size={20} /> {signe ? 'Fabriquer le rapport PDF' : 'Fabriquer l’aperçu PDF'}
        </button>
      )}
      {etat === 'en_cours' && (
        <p className="texte-doux rapport-progres">
          <Loader2 size={18} className="tourne" /> {progres}
        </p>
      )}
      {etat === 'pret' && pdf && (
        <>
          <p className="rapport-pret">
            {pdf.nom} · {(pdf.blob.size / 1024 / 1024).toFixed(1).replace('.', ',')} Mo
          </p>
          <div className="rapport-actions">
            <a className="bouton bouton-accent" href={pdf.url} target="_blank" rel="noopener">
              <ExternalLink size={20} /> Ouvrir
            </a>
            {partageable && (
              <button className="bouton bouton-principal" onClick={partager}>
                <Share2 size={20} /> Partager
              </button>
            )}
            <a className="bouton bouton-discret" href={pdf.url} download={pdf.nom}>
              <Download size={20} /> Enregistrer
            </a>
          </div>
        </>
      )}
      {erreur && <p className="dictee-erreur">{erreur}</p>}
    </div>
  )
}
