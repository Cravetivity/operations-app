import { useState } from 'react'
import SpoolList from '../components/SpoolList'
import { useBins } from '../useBins'
import type { Dashboard } from '../types'

/** Desk/setup tasks kept off the tablet workflows: bin management, label
 *  printing, full spool inventory. Full data management stays in the
 *  upstream UIs (Spoolman, BamBuddy). */
export default function AdminScreen({
  data,
  refresh,
}: {
  data: Dashboard
  refresh: () => void
}) {
  const { bins, reload } = useBins()
  const [newBin, setNewBin] = useState('')
  const [busy, setBusy] = useState(false)

  const onChanged = () => {
    refresh()
    reload()
  }

  const addBin = async () => {
    const name = newBin.trim()
    if (!name) return
    setBusy(true)
    try {
      await fetch('/api/bins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      setNewBin('')
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-300">Bins</h2>
        <div className="flex flex-wrap items-center gap-3">
          {bins.map((b) => (
            <span
              key={b.name}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3"
            >
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
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-300">
          All spools <span className="text-sm font-normal text-slate-500">({data.spools.length})</span>
        </h2>
        {data.spoolman !== 'ok' && <p className="text-amber-400">Spoolman {data.spoolman}.</p>}
        <SpoolList
          spools={[...data.spools].sort(
            (a, b) => (a.remaining_weight ?? Infinity) - (b.remaining_weight ?? Infinity),
          )}
          bins={bins}
          printers={data.printers}
          onChanged={onChanged}
        />
      </section>
    </div>
  )
}
