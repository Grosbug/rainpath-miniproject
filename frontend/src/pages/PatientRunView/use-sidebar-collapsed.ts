import { useCallback, useEffect, useState } from 'react'

type Section = 'profile' | 'history'

const STORAGE_KEY = (section: Section) => `rainpath:patient-run:sidebar-collapsed:${section}`

/**
 * Boolean collapse state for a PatientRunView sidebar section, persisted in
 * localStorage so it survives reloads. Defaults to expanded (false) on first visit.
 * SSR-safe: reads localStorage lazily inside the initialiser.
 */
export function useSidebarCollapsed(section: Section): [
  boolean,
  (next: boolean | ((prev: boolean) => boolean)) => void
] {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY(section)) === '1'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY(section), collapsed ? '1' : '0')
  }, [section, collapsed])

  const set = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setCollapsedState(prev => (typeof next === 'function' ? next(prev) : next))
    },
    []
  )

  return [collapsed, set]
}
