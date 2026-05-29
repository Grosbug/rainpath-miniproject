import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'rainpath:app-nav-collapsed'

export function useAppNavCollapsed(): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const set = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setCollapsedState(prev => (typeof next === 'function' ? next(prev) : next))
    },
    []
  )

  return [collapsed, set]
}
