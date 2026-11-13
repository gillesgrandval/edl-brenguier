import { useEffect, useState } from 'react'

/** Indique si la tablette a du réseau. L'application fonctionne dans les deux cas. */
export function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(navigator.onLine)
  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine)
    window.addEventListener('online', maj)
    window.addEventListener('offline', maj)
    return () => {
      window.removeEventListener('online', maj)
      window.removeEventListener('offline', maj)
    }
  }, [])
  return enLigne
}
