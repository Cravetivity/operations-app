import { useCallback, useEffect, useState } from 'react'
import type { Order } from './types'

export function useOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null)

  const reload = useCallback(() => {
    fetch('/api/orders')
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrders)
      .catch(() => setOrders([]))
  }, [])

  useEffect(reload, [reload])

  /** Swap one order in place with the updated copy an endpoint returned;
   *  an order that left the open set (e.g. shipped) is removed. */
  const replaceOrder = useCallback((updated: Order) => {
    setOrders((prev) => {
      if (!prev) return prev
      if (updated.status === 'shipped' || updated.status === 'canceled')
        return prev.filter((o) => o.id !== updated.id)
      return prev.map((o) => (o.id === updated.id ? updated : o))
    })
  }, [])

  return { orders, reload, replaceOrder }
}
