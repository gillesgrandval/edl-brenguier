import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db/base'
import { enregistrerEdl } from '../db/edl'
import type { Edl } from '../db/types'

/**
 * Charge un état des lieux et le garde en mémoire pendant la saisie.
 * Chaque modification est enregistrée automatiquement :
 *  - 400 ms après la dernière frappe,
 *  - immédiatement si l'application passe en arrière-plan ou se ferme,
 *  - immédiatement en quittant l'écran.
 * Rien ne se perd si la tablette se met en veille.
 */
export function useEdl(id: string | undefined) {
  const [edl, setEdl] = useState<Edl | null | undefined>(undefined) // undefined = chargement, null = introuvable
  const courant = useRef<Edl | null>(null)
  const enAttente = useRef<Edl | null>(null)
  const minuterie = useRef<number | undefined>(undefined)
  const [sauvegarde, setSauvegarde] = useState<'ok' | 'en_cours'>('ok')

  useEffect(() => {
    let actif = true
    if (!id) return
    db.edls.get(id).then((e) => {
      if (!actif) return
      courant.current = e ?? null
      setEdl(e ?? null)
    })
    return () => {
      actif = false
    }
  }, [id])

  const vider = useCallback(async () => {
    window.clearTimeout(minuterie.current)
    const a = enAttente.current
    if (!a) return
    enAttente.current = null
    await enregistrerEdl(a)
    setSauvegarde('ok')
  }, [])

  // Sauvegarde immédiate en cas de mise en veille, de changement d'application ou de fermeture.
  useEffect(() => {
    const surMasque = () => {
      if (document.visibilityState === 'hidden') void vider()
    }
    document.addEventListener('visibilitychange', surMasque)
    window.addEventListener('pagehide', vider)
    return () => {
      document.removeEventListener('visibilitychange', surMasque)
      window.removeEventListener('pagehide', vider)
      void vider() // en quittant l'écran
    }
  }, [vider])

  /** Modifie l'état des lieux : la « recette » reçoit une copie à modifier librement. */
  const modifier = useCallback(
    (recette: (brouillon: Edl) => void) => {
      if (!courant.current) return
      const copie = structuredClone(courant.current)
      recette(copie)
      courant.current = copie
      enAttente.current = copie
      setEdl(copie)
      setSauvegarde('en_cours')
      window.clearTimeout(minuterie.current)
      minuterie.current = window.setTimeout(() => void vider(), 400)
    },
    [vider],
  )

  return { edl, modifier, sauvegarde, enregistrerMaintenant: vider }
}
