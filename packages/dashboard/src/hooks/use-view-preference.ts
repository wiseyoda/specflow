"use client"

import { useCallback, useSyncExternalStore } from 'react'
import type { ViewType } from '@/components/projects/view-tabs'

const STORAGE_KEY_PREFIX = 'specflow-view-'
const DEFAULT_VIEW: ViewType = 'status'

/**
 * Hook for persisting view preference per project in localStorage
 */
export function useViewPreference(projectId: string): [ViewType, (view: ViewType) => void] {
  const storageKey = `${STORAGE_KEY_PREFIX}${projectId}`

  // Use useSyncExternalStore for SSR-safe localStorage reading
  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return DEFAULT_VIEW
    const stored = localStorage.getItem(storageKey)
    return stored && isValidViewType(stored) ? stored : DEFAULT_VIEW
  }, [storageKey])

  const getServerSnapshot = useCallback(() => DEFAULT_VIEW, [])

  const subscribe = useCallback((callback: () => void) => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) callback()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [storageKey])

  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setView = useCallback((newView: ViewType) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(storageKey, newView)
    // Trigger re-render by dispatching a storage event
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey }))
  }, [storageKey])

  return [view, setView]
}

function isValidViewType(value: string): value is ViewType {
  return ['status', 'kanban', 'timeline'].includes(value)
}
