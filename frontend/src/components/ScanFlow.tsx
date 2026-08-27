import { useEffect, useRef, useState } from 'react'
import Scanner from './Scanner'
import { PickerOption } from './PickerModal'
import { isAmsLocation, parseScan } from '../spools'
import { useBins } from '../useBins'
import type { Dashboard, Spool } from '../types'

const AMS_SLOTS = [1, 2, 3, 4]

type Step =
  | { step: 'scan' }
  | { step: 'spool'; spool: Spool }
  | { step: 'scan-dest'; spool: Spool }
  | { step: 'printers'; spool: Spool }
  | { step: 'slots'; spool: Spool; printer: string }
  | { step: 'bins'; spool: Spool }
  | { step: 'bin'; name: string }
  | { step: 'done'; message: string }

export default function ScanFlow({
  data,
  refresh,
  onClose,
}: {
  data: Dashboard
  refresh: () => void
  onClose: () => void
}) {
  const { bins } = useBins()
  const [state, setState] = useState<Step>({ step: 'scan' })
  const [flash, setFlash] = useState<string | null>(null)
  const [scannerKey, setScannerKey] = useState(0)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const resumeScan = (next: Step) => {
    setState(next)
    setScannerKey((k) => k + 1)
  }

  const finish = (message: string) => {
    refresh()
    setState({ step: 'done', message })
    closeTimer.current = setTimeout(onClose, 1500)
  }

  const act = async (path: string, body: object, message: string) => {
    const resp = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (resp.ok) {
      finish(message)
    } else {
      setFlash('Action failed — try again')
      setTimeout(() => setFlash(null), 2000)
    }
  }

  const checkIn = (spool: Spool, bin: string) =>
    act(`/api/spools/${spool.id}/check-in`, { bin }, `${spool.filament_name} → ${bin}`)

  const checkOut = (spool: Spool, printer: string, slot: number) =>
    act(
      `/api/spools/${spool.id}/check-out`,
      { printer_name: printer, ams_slot: slot },
      `${spool.filament_name} → ${printer} / AMS ${slot}`,
    )

  const handleScan = (payload: string) => {
    const target = parseScan(payload)
    const current = state
    if (!target) {
      setFlash('Not a Cravetivity label')
      setTimeout(() => setFlash(null), 1500)
      resumeScan(current)
      return
    }
    if (target.kind === 'spool') {
      const spool = data.spools.find((s) => s.id === target.id)
      if (!spool) {
        setFlash(`Unknown spool S${target.id}`)
        setTimeout(() => setFlash(null), 2000)
        resumeScan(current)
        return
      }
      setState({ step: 'spool', spool })
      return
    }
    // Bin scanned
    if (current.step === 'scan-dest') {
      void checkIn(current.spool, target.name)
      return
    }
    setState({ step: 'bin', name: target.name })
  }

  const scanning = state.step === 'scan' || state.step === 'scan-dest'

  return (
    <div className="fixed inset-0 z-40 flex flex-col gap-4 bg-slate-900 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Scan</h2>
        <button
          onClick={onClose}
          className="rounded-xl bg-slate-800 px-5 py-3 text-lg font-semibold hover:bg-slate-700"
        >
          Close
        </button>
      </div>

      {flash && (
        <p className="rounded-xl bg-amber-500/20 px-4 py-3 text-center font-semibold text-amber-300">
          {flash}
        </p>
      )}

      {scanning && (
        <Scanner
          key={scannerKey}
          hint={
            state.step === 'scan-dest'
              ? `Scan a bin for ${state.spool.filament_name}`
              : 'Scan a spool or bin label'
          }
          onScan={handleScan}
        />
      )}

      {state.step === 'spool' && (
        <SpoolSheet
          spool={state.spool}
          onScanDest={() => resumeScan({ step: 'scan-dest', spool: state.spool })}
          onPickPrinter={() => setState({ step: 'printers', spool: state.spool })}
          onPickBin={() => setState({ step: 'bins', spool: state.spool })}
        />
      )}

      {state.step === 'printers' && (
        <div className="flex flex-col gap-2 overflow-y-auto">
          <h3 className="text-lg font-semibold text-slate-300">
            Assign {state.spool.filament_name} to…
          </h3>
          {data.printers.map((p) => (
            <PickerOption
              key={p.id}
              onClick={() => setState({ step: 'slots', spool: state.spool, printer: p.name })}
            >
              {p.name} <span className="text-sm font-normal text-slate-400">{p.model}</span>
            </PickerOption>
          ))}
        </div>
      )}

      {state.step === 'slots' && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-slate-300">{state.printer} — pick AMS slot</h3>
          {AMS_SLOTS.map((slot) => (
            <PickerOption
              key={slot}
              onClick={() => void checkOut(state.spool, state.printer, slot)}
            >
              AMS slot {slot}
            </PickerOption>
          ))}
        </div>
      )}

      {state.step === 'bins' && (
        <div className="flex flex-col gap-2 overflow-y-auto">
          <h3 className="text-lg font-semibold text-slate-300">
            Check {state.spool.filament_name} into…
          </h3>
          {bins.length === 0 && <p className="text-slate-400">No bins yet — add one in Admin.</p>}
          {bins.map((b) => (
            <PickerOption key={b.name} onClick={() => void checkIn(state.spool, b.name)}>
              {b.name}{' '}
              <span className="text-sm font-normal text-slate-400">({b.spool_count})</span>
            </PickerOption>
          ))}
        </div>
      )}

      {state.step === 'bin' && (
        <BinSheet
          name={state.name}
          spools={data.spools.filter((s) => s.location === state.name)}
          onPick={(spool) => setState({ step: 'spool', spool })}
        />
      )}

      {state.step === 'done' && (
        <div className="flex grow flex-col items-center justify-center gap-3">
          <div className="text-5xl">✓</div>
          <p className="text-2xl font-bold text-emerald-400">{state.message}</p>
        </div>
      )}
    </div>
  )
}

function SpoolSheet({
  spool,
  onScanDest,
  onPickPrinter,
  onPickBin,
}: {
  spool: Spool
  onScanDest: () => void
  onPickPrinter: () => void
  onPickBin: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-2xl bg-slate-800 p-5">
        <span
          className="h-12 w-12 shrink-0 rounded-full border-2 border-slate-600"
          style={{ backgroundColor: spool.color_hex ? `#${spool.color_hex}` : '#64748b' }}
        />
        <div>
          <div className="text-xl font-semibold">{spool.filament_name}</div>
          <div className="text-slate-400">
            {[spool.vendor, spool.material].filter(Boolean).join(' · ')}
            {spool.remaining_weight != null && ` · ${Math.round(spool.remaining_weight)}g`}
          </div>
          {spool.location && (
            <div className={isAmsLocation(spool.location) ? 'text-sky-400' : 'text-slate-500'}>
              Now: {spool.location}
            </div>
          )}
        </div>
      </div>
      <PickerOption onClick={onScanDest}>Scan a bin to check in</PickerOption>
      <PickerOption onClick={onPickPrinter}>Assign to printer / AMS slot</PickerOption>
      <PickerOption onClick={onPickBin}>Choose bin from list</PickerOption>
    </div>
  )
}

function BinSheet({
  name,
  spools,
  onPick,
}: {
  name: string
  spools: Spool[]
  onPick: (spool: Spool) => void
}) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      <h3 className="text-lg font-semibold text-slate-300">
        {name} — {spools.length} spool{spools.length === 1 ? '' : 's'}
      </h3>
      {spools.length === 0 && <p className="text-slate-400">This bin is empty.</p>}
      {spools.map((s) => (
        <PickerOption key={s.id} onClick={() => onPick(s)}>
          <span className="flex items-center gap-3">
            <span
              className="h-6 w-6 shrink-0 rounded-full border border-slate-500"
              style={{ backgroundColor: s.color_hex ? `#${s.color_hex}` : '#64748b' }}
            />
            {s.filament_name}
            {s.remaining_weight != null && (
              <span className="text-sm font-normal text-slate-400">
                {Math.round(s.remaining_weight)}g
              </span>
            )}
          </span>
        </PickerOption>
      ))}
    </div>
  )
}
