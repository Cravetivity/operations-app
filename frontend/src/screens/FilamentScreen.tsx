import { useState } from 'react'
import SpoolList from '../components/SpoolList'
import { isAmsLocation } from '../spools'
import { useBins } from '../useBins'
import type { Dashboard, Spool } from '../types'

function matches(s: Spool, q: string): boolean {
  const hay = [s.filament_name, s.vendor, s.material, s.location].filter(Boolean).join(' ')
  return hay.toLowerCase().includes(q)
}

/** Task-focused view (CLAUDE.md: task-focused, not data-complete):
 *  what's loaded in printers, what's running low, and search-on-demand.
 *  Full inventory and bin management live on the Admin screen. */
export default function FilamentScreen({
  data,
  refresh,
}: {
  data: Dashboard
  refresh: () => void
}) {
  const { bins, reload } = useBins()
  const [query, setQuery] = useState('')

  if (data.spoolman === 'unconfigured')
    return <p className="text-amber-400">Spoolman not configured — set SPOOLMAN_URL.</p>
  if (data.spoolman === 'unreachable')
    return <p className="text-amber-400">Spoolman unreachable.</p>

  const onChanged = () => {
    refresh()
    reload()
  }
  const q = query.trim().toLowerCase()
  const loaded = data.spools.filter((s) => isAmsLocation(s.location))
  const low = data.spools.filter((s) => s.low && !isAmsLocation(s.location))
  const found = q ? data.spools.filter((s) => matches(s, q)) : []

  return (
    <div className="flex flex-col gap-8">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search spools (name, material, bin…)"
        className="w-full max-w-xl rounded-xl bg-slate-800 px-5 py-4 text-lg outline outline-slate-700 placeholder:text-slate-500"
      />

      {q ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-slate-300">
            {found.length} match{found.length === 1 ? '' : 'es'}
          </h2>
          <SpoolList spools={found} bins={bins} printers={data.printers} onChanged={onChanged} />
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-slate-300">Loaded in printers</h2>
            {loaded.length === 0 && (
              <p className="text-slate-500">No spools assigned to printers yet.</p>
            )}
            <SpoolList spools={loaded} bins={bins} printers={data.printers} onChanged={onChanged} />
          </section>

          {low.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-amber-400">Low stock</h2>
              <SpoolList spools={low} bins={bins} printers={data.printers} onChanged={onChanged} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
