import { useState } from 'react'
import PrintWizard from '../components/PrintWizard'
import { useOrders } from '../useOrders'
import type { Dashboard, MilestoneKey, Order, OrderItemT } from '../types'

const STATUS_BADGE: Record<Order['status'], string> = {
  new: 'bg-slate-600/40 text-slate-300',
  in_progress: 'bg-sky-500/20 text-sky-300',
  ready_to_ship: 'bg-emerald-500/20 text-emerald-300',
  packed: 'bg-emerald-500/20 text-emerald-300',
  shipped: 'bg-emerald-500/20 text-emerald-300',
  canceled: 'bg-red-500/20 text-red-300',
}

const ITEM_BADGE: Record<OrderItemT['status'], string> = {
  pending: 'bg-slate-600/40 text-slate-300',
  queued: 'bg-sky-500/20 text-sky-300',
  printing: 'bg-sky-500/20 text-sky-300',
  printed: 'bg-emerald-500/20 text-emerald-300',
  short: 'bg-red-500/20 text-red-300',
}

const MILESTONES: { key: MilestoneKey; label: string }[] = [
  { key: 'label_printed', label: 'Label printed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
]

export default function OrdersScreen({ data }: { data: Dashboard }) {
  const { orders, reload, replaceOrder } = useOrders()
  const [wizard, setWizard] = useState<{ order: Order; item: OrderItemT } | null>(null)
  const [showNew, setShowNew] = useState(false)

  const post = async (path: string, body: object) => {
    const resp = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (resp.ok) replaceOrder(await resp.json())
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => setShowNew(true)}
        className="self-start rounded-xl bg-sky-600 px-5 py-3 text-lg font-bold hover:bg-sky-500"
      >
        + New order
      </button>

      {orders === null && <p className="text-slate-400">Loading…</p>}
      {orders?.length === 0 && <p className="text-slate-400 text-lg">No open orders.</p>}

      {orders?.map((order) => (
        <div key={order.id} className="flex flex-col gap-4 rounded-2xl bg-slate-800 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold">{order.buyer_name}</span>
              <span className="rounded-full bg-slate-700 px-3 py-1 text-sm text-slate-300">
                {order.channel}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS_BADGE[order.status]}`}
              >
                {order.status.replace(/_/g, ' ').toUpperCase()}
              </span>
              {order.ship_by && (
                <span className="text-sm text-amber-300">ship by {order.ship_by}</span>
              )}
            </div>
            <div className="flex gap-2">
              {MILESTONES.map(({ key, label }) => {
                const done = !!order.milestones[key]
                return (
                  <button
                    key={key}
                    onClick={() => post(`/api/orders/${order.id}/milestone`, { milestone: key, value: !done })}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                      done
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {done ? '✓ ' : ''}
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {order.buyer_note && <p className="text-sm text-slate-400">“{order.buyer_note}”</p>}

          <div className="flex flex-col gap-2">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900/60 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {item.title}
                    {item.quantity > 1 && ` ×${item.quantity}`}
                  </span>
                  {item.variant && <span className="text-sm text-slate-400">{item.variant}</span>}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${ITEM_BADGE[item.status]}`}
                  >
                    {item.status.toUpperCase()}
                  </span>
                  {item.jobs.length > 0 && (
                    <span className="text-xs text-slate-500">
                      {item.jobs.at(-1)!.printer_name}
                      {item.jobs.at(-1)!.plate != null && ` · plate ${item.jobs.at(-1)!.plate}`}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {(item.status === 'pending' || item.status === 'short') && (
                    <button
                      onClick={() => setWizard({ order, item })}
                      className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold hover:bg-sky-500"
                    >
                      Print
                    </button>
                  )}
                  {(item.status === 'queued' || item.status === 'printing') && (
                    <>
                      <button
                        onClick={() => post(`/api/order-items/${item.id}/status`, { status: 'printed' })}
                        className="rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-600"
                      >
                        Mark printed
                      </button>
                      <button
                        onClick={() => post(`/api/order-items/${item.id}/status`, { status: 'short' })}
                        className="rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-slate-600"
                      >
                        Failed
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {wizard && (
        <PrintWizard
          item={wizard.item}
          order={wizard.order}
          data={data}
          onDone={(updated) => {
            replaceOrder(updated)
            setWizard(null)
          }}
          onClose={() => setWizard(null)}
        />
      )}

      {showNew && (
        <NewOrderForm
          onCreated={() => {
            setShowNew(false)
            reload()
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  )
}

function NewOrderForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [buyer, setBuyer] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([{ title: '', variant: '', quantity: 1 }])
  const [busy, setBusy] = useState(false)

  const valid = buyer.trim() && items.every((i) => i.title.trim())

  const submit = async () => {
    setBusy(true)
    const resp = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        buyer_name: buyer.trim(),
        buyer_note: note.trim() || null,
        items: items.map((i) => ({
          title: i.title.trim(),
          variant: i.variant.trim() || null,
          quantity: i.quantity,
        })),
      }),
    })
    setBusy(false)
    if (resp.ok) onCreated()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-6" onClick={onClose}>
      <div
        className="flex w-full max-w-xl flex-col gap-4 rounded-2xl bg-slate-800 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold">New order</h2>
        <input
          value={buyer}
          onChange={(e) => setBuyer(e.target.value)}
          placeholder="Buyer name"
          className="rounded-xl bg-slate-900 px-4 py-3 outline outline-slate-700 placeholder:text-slate-500"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="rounded-xl bg-slate-900 px-4 py-3 outline outline-slate-700 placeholder:text-slate-500"
        />
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              value={item.title}
              onChange={(e) =>
                setItems(items.map((it, i) => (i === idx ? { ...it, title: e.target.value } : it)))
              }
              placeholder="Item"
              className="grow rounded-xl bg-slate-900 px-4 py-3 outline outline-slate-700 placeholder:text-slate-500"
            />
            <input
              value={item.variant}
              onChange={(e) =>
                setItems(items.map((it, i) => (i === idx ? { ...it, variant: e.target.value } : it)))
              }
              placeholder="Variant"
              className="w-32 rounded-xl bg-slate-900 px-4 py-3 outline outline-slate-700 placeholder:text-slate-500"
            />
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) =>
                setItems(
                  items.map((it, i) =>
                    i === idx ? { ...it, quantity: Math.max(1, Number(e.target.value) || 1) } : it,
                  ),
                )
              }
              className="w-20 rounded-xl bg-slate-900 px-3 py-3 text-center outline outline-slate-700"
            />
          </div>
        ))}
        <button
          onClick={() => setItems([...items, { title: '', variant: '', quantity: 1 }])}
          className="self-start rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-600"
        >
          + Add item
        </button>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-5 py-3 text-slate-400 hover:bg-slate-700">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!valid || busy}
            className="rounded-xl bg-sky-600 px-6 py-3 font-bold hover:bg-sky-500 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
