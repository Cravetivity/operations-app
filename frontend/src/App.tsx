import PrinterCard from './components/PrinterCard'
import SpoolStrip from './components/SpoolStrip'
import { useDashboard } from './useDashboard'

export default function App() {
  const { data, backendDown } = useDashboard()

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Cravetivity Operations</h1>
        <div className="text-sm text-slate-400">
          {backendDown && <span className="text-red-400 font-semibold">Backend unreachable</span>}
          {!backendDown && data?.bambuddy === 'unreachable' && (
            <span className="text-amber-400 font-semibold">BamBuddy unreachable</span>
          )}
          {!backendDown && data?.bambuddy === 'unconfigured' && (
            <span className="text-amber-400">BamBuddy not configured — set BAMBUDDY_URL</span>
          )}
          {!backendDown && data?.low_stock_count ? (
            <span className="ml-3 text-amber-400">
              {data.low_stock_count} spool{data.low_stock_count > 1 ? 's' : ''} low
            </span>
          ) : null}
        </div>
      </header>

      {!data && !backendDown && <p className="text-slate-400">Loading…</p>}

      {data && (
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
      )}
    </main>
  )
}
