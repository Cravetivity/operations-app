import { useEffect, useState } from 'react'

type Health = { status: string; database: string }

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError(true))
  }, [])

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Cravetivity Operations</h1>
      <p className="text-xl text-slate-400">Printer wall coming soon (Phase 1)</p>
      <div className="rounded-2xl bg-slate-800 px-8 py-5 text-lg">
        {error && <span className="text-red-400">Backend unreachable</span>}
        {!error && !health && <span className="text-slate-400">Checking backend…</span>}
        {health && (
          <span>
            Backend: <span className="text-emerald-400">{health.status}</span> · Database:{' '}
            <span className={health.database === 'ok' ? 'text-emerald-400' : 'text-amber-400'}>
              {health.database}
            </span>
          </span>
        )}
      </div>
    </main>
  )
}
