import type { PrinterStatus } from '../types'

function fmtRemaining(minutes: number | null): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

type Look = { label: string; badge: string; bar: string }

function look(p: PrinterStatus): Look {
  if (p.state === 'unreachable' || !p.connected)
    return { label: 'OFFLINE', badge: 'bg-amber-500/20 text-amber-300', bar: 'bg-amber-400' }
  if (p.hms_errors.length > 0 || p.state === 'error')
    return { label: 'ERROR', badge: 'bg-red-500/20 text-red-300', bar: 'bg-red-400' }
  if (p.awaiting_plate_clear)
    return { label: 'CLEAR PLATE', badge: 'bg-emerald-500/20 text-emerald-300', bar: 'bg-emerald-400' }
  if (p.state === 'printing')
    return { label: 'PRINTING', badge: 'bg-sky-500/20 text-sky-300', bar: 'bg-sky-400' }
  if (p.state === 'finished')
    return { label: 'FINISHED', badge: 'bg-emerald-500/20 text-emerald-300', bar: 'bg-emerald-400' }
  return { label: p.state.toUpperCase(), badge: 'bg-slate-600/40 text-slate-300', bar: 'bg-slate-500' }
}

export default function PrinterCard({ printer }: { printer: PrinterStatus }) {
  const l = look(printer)
  const printing = printer.state === 'printing' && printer.progress != null
  return (
    <div className="rounded-2xl bg-slate-800 p-5 flex flex-col gap-3 min-h-44">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xl font-semibold">{printer.name}</div>
          {printer.model && <div className="text-sm text-slate-400">{printer.model}</div>}
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm font-bold tracking-wide ${l.badge}`}>
          {l.label}
        </span>
      </div>

      {printing ? (
        <>
          <div className="truncate text-slate-300">{printer.filename}</div>
          <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
            <div className={`h-full ${l.bar}`} style={{ width: `${printer.progress}%` }} />
          </div>
          <div className="flex justify-between text-sm text-slate-400">
            <span>
              {printer.progress?.toFixed(0)}% · layer {printer.layer_num}/{printer.total_layers}
            </span>
            <span className="font-medium text-slate-200">{fmtRemaining(printer.remaining_time)} left</span>
          </div>
        </>
      ) : (
        <div className="text-slate-400 text-sm mt-auto">
          {printer.hms_errors[0]?.message ??
            (printer.awaiting_plate_clear ? 'Print done — remove parts to continue' : ' ')}
        </div>
      )}

      <div className="flex gap-4 text-sm text-slate-500 mt-auto">
        <span>Nozzle {printer.temperatures.nozzle?.toFixed(0) ?? '–'}°</span>
        <span>Bed {printer.temperatures.bed?.toFixed(0) ?? '–'}°</span>
      </div>
    </div>
  )
}
