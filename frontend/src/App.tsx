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

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <ScreenMenu screen={screen} onSelect={setScreen} />
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
      {data && <Screen screen={screen} data={data} refresh={refresh} />}
    </main>
  )
}
