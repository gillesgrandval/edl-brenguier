import { useCallback, useEffect, useRef, useState } from 'react'

/* Dictée continue pour le mémo vocal d'une pièce.
   Sur Android, Chrome coupe l'écoute après un silence : on la relance
   automatiquement tant que l'utilisateur n'a pas touché « Arrêter ».
   La reconnaissance vocale de Chrome a besoin d'Internet ; hors ligne,
   on utilise le micro du clavier (Samsung / Google), qui écrit dans la zone de texte. */

type Resultat = { isFinal: boolean; 0: { transcript: string } }
type Reconnaissance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<Resultat> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function creer(): Reconnaissance | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconnaissance; webkitSpeechRecognition?: new () => Reconnaissance }
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return C ? new C() : null
}

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function useDicteeContinue(onFinal: (texte: string) => void) {
  const [ecoute, setEcoute] = useState(false)
  const [provisoire, setProvisoire] = useState('')
  const [erreur, setErreur] = useState<string>()
  const rec = useRef<Reconnaissance | null>(null)
  const voulue = useRef(false)
  const rappel = useRef(onFinal)
  useEffect(() => {
    rappel.current = onFinal
  }, [onFinal])

  const disponible = typeof window !== 'undefined' && !!creer()

  const demarrer = useCallback(() => {
    const r = creer()
    if (!r) return
    r.lang = 'fr-FR'
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const t = res[0].transcript.trim()
        if (!t) continue
        if (res.isFinal) rappel.current(majuscule(t) + '.')
        else interim += ' ' + t
      }
      setProvisoire(interim.trim())
    }
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      voulue.current = false
      setErreur(
        e.error === 'network'
          ? 'Pas de réseau : touchez la zone de texte et utilisez le micro du clavier.'
          : e.error === 'not-allowed'
            ? "Autorisez l'accès au micro dans Chrome pour dicter."
            : 'La dictée s’est interrompue : touchez à nouveau le micro.',
      )
    }
    r.onend = () => {
      setProvisoire('')
      if (voulue.current) {
        try {
          r.start() // relance après un silence
          return
        } catch {
          /* déjà arrêtée */
        }
      }
      setEcoute(false)
    }
    rec.current = r
    setErreur(undefined)
    voulue.current = true
    setEcoute(true)
    r.start()
  }, [])

  const arreter = useCallback(() => {
    voulue.current = false
    rec.current?.stop()
  }, [])

  useEffect(() => () => {
    voulue.current = false
    rec.current?.stop()
  }, [])

  return { disponible, ecoute, provisoire, erreur, demarrer, arreter }
}
