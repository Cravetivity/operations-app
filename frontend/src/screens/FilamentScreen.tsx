import { useCallback, useEffect, useState } from 'react'
import PickerModal, { PickerOption } from '../components/PickerModal'
import type { Dashboard, Spool } from '../types'

type Bin = { name: string; spool_count: number }
type Picking = { spool: Spool; action: 'check-in' | 'check-out' } | null

const AMS_SLOTS = [1, 2, 3, 4]

function isAmsLocation(location: string | null): boolean {
  return !!location && / \/ AMS \d$/.test(location)
}

function useBins(): { bins: Bin[]; reload: () => void } {
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

export default function FilamentScreen({
  data,
  refresh,
}: {
  data: Dashboard
  refresh: () => void
}) {
  const { bins, reload } = useBins()
  const [picking, setPicking] = useState<Picking>(null)
  const [pickedPrinter, setPickedPrinter] = useState<string | null>(null)
  const [newBin, setNewBin] = useState('')
  const [busy, setBusy] = useState(false)

  if (data.spoolman === 'unconfigured')
    return <p className="text-amber-400">Spoolman not configured — set SPOOLMAN_URL.</p>
  if (data.spoolman === 'unreachable')
    return <p className="text-amber-400">Spoolman unreachable.</p>

  const act = async (path: string, body: object) => {
    setBusy(true)
    try {
      await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      refresh()
      reload()
    } finally {
      setBusy(false)
      setPicking(null)
      setPickedPrinter(null)
    }
  }

  const addBin = async () => {
    const name = newBin.trim()
    if (!name) return
    await act('/api/bins', { name })
    setNewBin('')
  }

  const spools = [...data.spools].sort(
    (a, b) => (a.remaining_weight ?? Infinity) - (b.remaining_weight ?? Infinity),
  )

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-center gap-3">
        {bins.map((b) => (
          <span key={b.name} className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3">
            <span className="font-semibold">{b.name}</span>
            <span className="text-sm text-slate-400">{b.spool_count}</span>
            <a
              href={`/api/labels/bin/${encodeURIComponent(b.name)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
              title="Print bin label"
            >
              Label
            </a>
          </span>
        ))}
        <span className="flex items-center gap-2">
          <input
            value={newBin}
            onChange={(e) => setNewBin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addBin()}
            placeholder="New bin name"
            className="w-40 rounded-xl bg-slate-800 px-4 py-3 outline outline-slate-700 placeholder:text-slate-500"
          />
          <button
            onClick={addBin}
            disabled={busy || !newBin.trim()}
            className="rounded-xl bg-sky-600 px-4 py-3 font-semibold hover:bg-sky-500 disabled:opacity-40"
          >
            Add bin
          </button>
        </span>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 content-start">
        {spools.map((s) => (
          <div
            key={s.id}
            className={`flex flex-col gap-3 rounded-2xl p-5 ${
              s.low ? 'bg-amber-500/15 outline outline-amber-500/40' : 'bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-4">
              <span
                className="h-12 w-12 shrink-0 rounded-full border-2 border-slate-600"
                style={{ backgroundColor: s.color_hex ? `#${s.color_hex}` : '#64748b' }}
              />
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{s.filament_name}</div>
                <div className="text-sm text-slate-400 truncate">
                  {[s.vendor, s.material].filter(Boolean).join(' · ')}
                </div>
                <div className="text-sm mt-1">
                  <span className={s.low ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                    {s.remaining_weight != null
                      ? `${Math.round(s.remaining_weight)}g`
                      : 'weight unknown'}
                    {s.low && ' — LOW'}
                  </span>
                  {s.location && (
                    <span className={isAmsLocation(s.location) ? 'text-sky-400' : 'text-slate-500'}>
                      {' '}
                      · {s.location}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/labels/spool/${s.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-600"
              >
                Label
              </a>
              <button
                onClick={() => setPicking({ spool: s, action: 'check-in' })}
                disabled={busy}
                className="rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-600 disabled:opacity-40"
              >
                To bin
              </button>
              <button
                onClick={() => setPicking({ spool: s, action: 'check-out' })}
                disabled={busy}
                className="rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-600 disabled:opacity-40"
              >
                To printer
              </button>
            </div>
          </div>
        ))}
      </section>

      {picking?.action === 'check-in' && (
        <PickerModal title={`Check in — ${picking.spool.filament_name}`} onClose={() => setPicking(null)}>
          {bins.length === 0 && <p className="text-slate-400">No bins yet — add one first.</p>}
          {bins.map((b) => (
            <PickerOption
              key={b.name}
              onClick={() => act(`/api/spools/${picking.spool.id}/check-in`, { bin: b.name })}
            >
              {b.name} <span className="text-sm font-normal text-slate-400">({b.spool_count})</span>
            </PickerOption>
          ))}
        </PickerModal>
      )}

      {picking?.action === 'check-out' && !pickedPrinter && (
        <PickerModal title={`Assign — ${picking.spool.filament_name}`} onClose={() => setPicking(null)}>
          {data.printers.length === 0 && <p className="text-slate-400">No printers available.</p>}
          {data.printers.map((p) => (
            <PickerOption key={p.id} onClick={() => setPickedPrinter(p.name)}>
              {p.name} <span className="text-sm font-normal text-slate-400">{p.model}</span>
            </PickerOption>
          ))}
        </PickerModal>
      )}

      {picking?.action === 'check-out' && pickedPrinter && (
        <PickerModal
          title={`${pickedPrinter} — pick AMS slot`}
          onClose={() => {
            setPicking(null)
            setPickedPrinter(null)
          }}
        >
          {AMS_SLOTS.map((slot) => (
            <PickerOption
              key={slot}
              onClick={() =>
                act(`/api/spools/${picking.spool.id}/check-out`, {
                  printer_name: pickedPrinter,
                  ams_slot: slot,
                })
              }
            >
              AMS slot {slot}
            </PickerOption>
          ))}
        </PickerModal>
      )}
    </div>
  )
}
