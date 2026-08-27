import PrinterCard from '../components/PrinterCard'
import type { Dashboard } from '../types'

const ACTIVE_STATES = new Set(['printing', 'finished', 'error'])

function isActive(state: string, awaitingClear: boolean): boolean {
  return ACTIVE_STATES.has(state) || awaitingClear
}

/** Focused view of in-flight work: active prints sorted by time remaining,
 *  plus anything needing attention (plate clear, errors). */
export default function PrintsScreen({ data }: { data: Dashboard }) {
  const active = data.printers
    .filter((p) => isActive(p.state, p.awaiting_plate_clear))
    .sort((a, b) => (a.remaining_time ?? -1) - (b.remaining_time ?? -1))

  if (active.length === 0)
    return <p className="text-slate-400 text-lg">Nothing printing right now.</p>

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 content-start">
      {active.map((p) => (
        <PrinterCard key={p.id} printer={p} />
      ))}
    </section>
  )
}
