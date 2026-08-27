import PrinterCard from '../components/PrinterCard'
import SpoolStrip from '../components/SpoolStrip'
import type { Dashboard } from '../types'

export default function DashboardScreen({ data }: { data: Dashboard }) {
  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 grow content-start">
        {data.printers.map((p) => (
          <PrinterCard key={p.id} printer={p} />
        ))}
        {data.printers.length === 0 && data.bambuddy === 'ok' && (
          <p className="text-slate-400">No printers configured in BamBuddy.</p>
        )}
      </section>
      <SpoolStrip data={data} />
    </>
  )
}
