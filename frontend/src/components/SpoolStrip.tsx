import type { Dashboard } from '../types'

export default function SpoolStrip({ data }: { data: Dashboard }) {
  if (data.spoolman === 'unconfigured') return null
  if (data.spoolman === 'unreachable')
    return <div className="text-amber-400 text-sm px-1">Spoolman unreachable</div>

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {data.spools.map((s) => (
        <div
          key={s.id}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 shrink-0 ${
            s.low ? 'bg-amber-500/15 outline outline-amber-500/40' : 'bg-slate-800'
          }`}
        >
          <span
            className="h-6 w-6 rounded-full border border-slate-600"
            style={{ backgroundColor: s.color_hex ? `#${s.color_hex}` : '#64748b' }}
          />
          <div className="leading-tight">
            <div className="text-sm font-medium">{s.filament_name}</div>
            <div className="text-xs text-slate-400">
              {s.remaining_weight != null ? `${Math.round(s.remaining_weight)}g` : '?'}
              {s.low && <span className="text-amber-400 font-semibold"> · LOW</span>}
              {s.location && <span> · {s.location}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
