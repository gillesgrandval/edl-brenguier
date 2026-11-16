import { useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'

/* Dictée vocale (Web Speech API de Chrome).
   Elle nécessite en général une connexion : hors ligne, utiliser
   le micro du clavier Samsung / Google, qui fonctionne sans réseau. */

type Reconnaissance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function creer(): Reconnaissance | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconnaissance; webkitSpeechRecognition?: new () => Reconnaissance }
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return C ? new C() : null
}

const dicteeDisponible = () => !!creer()

export function BoutonDictee({ onTexte }: { onTexte: (t: string) => void }) {
  const [ecoute, setEcoute] = useState(false)
  const [erreur, setErreur] = useState<string>()
  const rec = useRef<Reconnaissance | null>(null)

  if (!dicteeDisponible()) return null

  function basculer() {
    if (ecoute) {
      rec.current?.stop()
      return
    }
    const r = creer()!
    r.lang = 'fr-FR'
    r.interimResults = false
    r.continuous = false
    r.onresult = (e) => {
      const t = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(' ')
        .trim()
      if (t) onTexte(t.charAt(0).toUpperCase() + t.slice(1))
    }
    r.onerror = (e) => {
      setErreur(
        e.error === 'network'
          ? 'Dictée indisponible sans réseau : utilisez le micro du clavier.'
          : e.error === 'not-allowed'
            ? "Autorisez l'accès au micro pour utiliser la dictée."
            : undefined,
      )
    }
    r.onend = () => setEcoute(false)
    rec.current = r
    setErreur(undefined)
    setEcoute(true)
    r.start()
  }

  return (
    <span className="dictee">
      <button type="button" className={`bouton-icone ${ecoute ? 'dictee-active' : ''}`} onClick={basculer} aria-label={ecoute ? 'Arrêter la dictée' : 'Dicter'}>
        {ecoute ? <MicOff /> : <Mic />}
      </button>
      {erreur && <span className="dictee-erreur">{erreur}</span>}
    </span>
  )
}
