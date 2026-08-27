import { useState } from 'react'
import ScanFlow from './components/ScanFlow'
import ScreenMenu from './components/ScreenMenu'
import { useScreen } from './navigation'
import AdminScreen from './screens/AdminScreen'
import DashboardScreen from './screens/DashboardScreen'
import FilamentScreen from './screens/FilamentScreen'
import PlaceholderScreen from './screens/PlaceholderScreen'
import PrintsScreen from './screens/PrintsScreen'
import { useDashboard } from './useDashboard'
import type { Dashboard } from './types'

function Screen({
  screen,
  data,
  refresh,
}: {
  screen: string
  data: Dashboard
  refresh: () => void
}) {
  switch (screen) {
    case 'orders':
      return <PlaceholderScreen title="Orders" phase="Phase 2" />
    case 'prints':
      return <PrintsScreen data={data} />
    case 'filament':
      return <FilamentScreen data={data} refresh={refresh} />
    case 'products':
      return <PlaceholderScreen title="Products" phase="a later phase" />
    case 'admin':
      return <AdminScreen data={data} refresh={refresh} />
    default:
      return <DashboardScreen data={data} />
  }
}

export default function App() {
  const { data, backendDown, refresh } = useDashboard()
  const [screen, setScreen] = useScreen()
  const [scanOpen, setScanOpen] = useState(false)

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <ScreenMenu screen={screen} onSelect={setScreen} />
        <div className="flex items-center gap-4">
          {data && (
            <button
              onClick={() => setScanOpen(true)}
              aria-label="Scan a label"
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-lg font-semibold hover:bg-slate-700 active:bg-slate-600"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M3 12h18" />
              </svg>
              Scan
            </button>
          )}
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
        </div>
      </header>

      {!data && !backendDown && <p className="text-slate-400">Loading…</p>}
      {data && <Screen screen={screen} data={data} refresh={refresh} />}
      {scanOpen && data && (
        <ScanFlow data={data} refresh={refresh} onClose={() => setScanOpen(false)} />
      )}
    </main>
  )
}
