import { useEffect, useState } from 'react'

export const SCREENS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'orders', label: 'Orders' },
  { key: 'prints', label: 'Current Prints' },
  { key: 'filament', label: 'Filament' },
  { key: 'products', label: 'Products' },
] as const

export type ScreenKey = (typeof SCREENS)[number]['key']

function fromHash(): ScreenKey {
  const key = location.hash.replace(/^#\/?/, '')
  return SCREENS.some((s) => s.key === key) ? (key as ScreenKey) : 'dashboard'
}

/** Hash-based navigation (#/orders) so refresh and tablet bookmarks keep the
 *  screen without needing a router. */
export function useScreen(): [ScreenKey, (key: ScreenKey) => void] {
  const [screen, setScreen] = useState<ScreenKey>(fromHash)

  useEffect(() => {
    const onHashChange = () => setScreen(fromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return [screen, (key) => (location.hash = `/${key}`)]
}
