import { Fragment, useState, type ReactNode } from 'react'
import { BookOpen, CircleHelp, Smartphone, TriangleAlert } from 'lucide-react'
// Les guides du projet, embarqués dans l'application : lisibles hors ligne.
import guideUtilisation from '../../GUIDE_UTILISATEUR.md?raw'
import guideInstallation from '../../GUIDE_INSTALLATION.md?raw'
import limites from '../../LIMITES.md?raw'

const ONGLETS = [
  { cle: 'utilisation', libelle: 'Utilisation', icone: <BookOpen size={18} />, texte: guideUtilisation },
  { cle: 'installation', libelle: 'Installation', icone: <Smartphone size={18} />, texte: guideInstallation },
  { cle: 'limites', libelle: 'Limites connues', icone: <TriangleAlert size={18} />, texte: limites },
] as const

/** Gras (**…**) dans une ligne de texte. */
function enLigne(t: string): ReactNode {
  return t.split(/(\*\*[^*]+\*\*)/g).map((m, i) => (m.startsWith('**') ? <strong key={i}>{m.slice(2, -2)}</strong> : <Fragment key={i}>{m}</Fragment>))
}

/** Affiche le Markdown simple des guides : titres, listes, paragraphes, gras. */
function Markdown({ texte }: { texte: string }) {
  const blocs: ReactNode[] = []
  let liste: { ordonnee: boolean; items: string[] } | null = null
  let paragraphe: string[] = []
  const fermer = () => {
    if (paragraphe.length) blocs.push(<p key={blocs.length}>{enLigne(paragraphe.join(' '))}</p>)
    paragraphe = []
    if (liste) {
      const items = liste.items.map((x, i) => <li key={i}>{enLigne(x)}</li>)
      blocs.push(liste.ordonnee ? <ol key={blocs.length}>{items}</ol> : <ul key={blocs.length}>{items}</ul>)
    }
    liste = null
  }
  for (const brut of texte.split('\n')) {
    const l = brut.trim()
    const titre = /^(#{1,3})\s+(.*)$/.exec(l)
    const puce = /^[-*]\s+(.*)$/.exec(l)
    const num = /^\d+\.\s+(.*)$/.exec(l)
    if (!l) fermer()
    else if (titre) {
      fermer()
      const n = titre[1].length
      blocs.push(n === 1 ? <h2 key={blocs.length}>{titre[2]}</h2> : n === 2 ? <h3 key={blocs.length}>{titre[2]}</h3> : <h4 key={blocs.length}>{titre[2]}</h4>)
    } else if (puce || num) {
      if (paragraphe.length) fermer()
      const ordonnee = !!num
      if (liste && liste.ordonnee !== ordonnee) fermer()
      liste ??= { ordonnee, items: [] }
      liste.items.push((puce ?? num)![1])
    } else if (liste && brut.startsWith('   ')) liste.items[liste.items.length - 1] += ' ' + l
    else {
      if (liste) fermer()
      paragraphe.push(l)
    }
  }
  fermer()
  return <div className="guide">{blocs}</div>
}

export default function Aide() {
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number]['cle']>('utilisation')
  const actif = ONGLETS.find((o) => o.cle === onglet)!
  return (
    <div className="saisie-piece aide">
      <div className="piece-entete">
        <div className="piece-entete-titre">
          <div className="titre-modifiable">
            <CircleHelp size={24} />
            <h1>Aide</h1>
          </div>
          <div className="piece-entete-progression">
            <span>Disponible hors ligne · version {__APP_VERSION__}</span>
          </div>
        </div>
      </div>
      <div className="segment segment-large aide-onglets">
        {ONGLETS.map((o) => (
          <button key={o.cle} className={o.cle === onglet ? 'segment-actif' : ''} onClick={() => setOnglet(o.cle)}>
            {o.icone} {o.libelle}
          </button>
        ))}
      </div>
      <div className="carte rubrique-carte">
        <Markdown texte={actif.texte} />
      </div>
    </div>
  )
}
