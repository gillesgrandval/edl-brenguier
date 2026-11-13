import { Building2, Home, Warehouse } from 'lucide-react'
import type { TypeBien } from '../db/types'

/** Icône associée à chaque type de bien. */
export const ICONE_BIEN: Record<TypeBien, typeof Home> = {
  appartement: Building2,
  maison: Home,
  local: Warehouse,
}
