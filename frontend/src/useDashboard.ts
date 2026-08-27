import { useCallback, useEffect, useState } from 'react'
import type { Dashboard, Snapshot } from './types'

const SPOOL_REFRESH_MS = 60_000
const WS_RETRY_MS = 5_000

/** Full dashboard via REST (printers + spools), live printer updates via
 *  /ws/status. If the socket drops, it retries; spools refresh on a timer.
 *  `refresh` refetches immediately (e.g. after a spool mutation) without
 *  touching the websocket. */
export function useDashboard(): {
  data: Dashboard | null
  backendDown: boolean
  refresh: () => void
} {
  const [data, setData] = useState<Dashboard | null>(null)
  const [backendDown, setBackendDown] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const refresh = useCallback(() => setRefreshTick((t) => t + 1), [])

  // REST: initial load, periodic spool refresh, and explicit refresh().
  useEffect(() => {
    let disposed = false
    const fetchDashboard = () =>
      fetch('/api/dashboard')
        .then((r) => r.json())
        .then((d: Dashboard) => {
          if (!disposed) {
            setData(d)
            setBackendDown(false)
          }
        })
        .catch(() => !disposed && setBackendDown(true))

    fetchDashboard()
    const timer = setInterval(fetchDashboard, SPOOL_REFRESH_MS)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [refreshTick])

  // WebSocket: live printer updates, reconnect on drop. Mount-scoped.
  useEffect(() => {
    let disposed = false
    let ws: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout>

    const connect = () => {
      if (disposed) return
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
      ws = new WebSocket(`${proto}//${location.host}/ws/status`)
      ws.onmessage = (event) => {
        const snapshot: Snapshot = JSON.parse(event.data)
        setData((prev) => (prev ? { ...prev, ...snapshot } : prev))
        setBackendDown(false)
      }
      ws.onclose = () => {
        if (!disposed) retry = setTimeout(connect, WS_RETRY_MS)
      }
    }

    connect()
    return () => {
      disposed = true
      clearTimeout(retry)
      ws?.close()
    }
  }, [])

  return { data, backendDown, refresh }
}
