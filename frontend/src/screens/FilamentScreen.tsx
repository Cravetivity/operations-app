import type { Dashboard } from '../types'

/** Spool inventory from Spoolman: what's on hand, where it lives, what's low. */
export default function FilamentScreen({ data }: { data: Dashboard }) {
  if (data.spoolman === 'unconfigured')
    return <p className="text-amber-400">Spoolman not configured — set SPOOLMAN_URL.</p>
  if (data.spoolman === 'unreachable')
    return <p className="text-amber-400">Spoolman unreachable.</p>
  if (data.spools.length === 0)
    return <p className="text-slate-400 text-lg">No spools in Spoolman yet.</p>

  const spools = [...data.spools].sort(
    (a, b) => (a.remaining_weight ?? Infinity) - (b.remaining_weight ?? Infinity),
  )

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 content-start">
      {spools.map((s) => (
        <div
          key={s.id}
          className={`flex items-center gap-4 rounded-2xl p-5 ${
            s.low ? 'bg-amber-500/15 outline outline-amber-500/40' : 'bg-slate-800'
          }`}
        >
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
                {s.remaining_weight != null ? `${Math.round(s.remaining_weight)}g left` : 'weight unknown'}
                {s.low && ' — LOW'}
              </span>
              {s.location && <span className="text-slate-500"> · {s.location}</span>}
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}
