import { useCallback, useEffect, useState } from 'react'

export type Bin = { name: string; spool_count: number }

export function useBins(): { bins: Bin[]; reload: () => void } {
  const [bins, setBins] = useState<Bin[]>([])
  const reload = useCallback(() => {
    fetch('/api/bins')
      .then((r) => (r.ok ? r.json() : []))
      .then(setBins)
      .catch(() => setBins([]))
  }, [])
  useEffect(reload, [reload])
  return { bins, reload }
}
