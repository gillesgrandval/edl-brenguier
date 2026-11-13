import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'

export default function Chargement({ introuvable }: { introuvable?: boolean }) {
  if (!introuvable) return <div className="chargement" aria-busy="true" />
  return (
    <div className="vide">
      <SearchX size={40} />
      <p>Cet état des lieux est introuvable sur cette tablette.</p>
      <Link className="bouton bouton-principal" to="/">
        Retour à l'accueil
      </Link>
    </div>
  )
}
