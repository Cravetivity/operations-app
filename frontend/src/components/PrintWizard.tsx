import { useEffect, useMemo, useState } from 'react'
import { PickerOption } from './PickerModal'
import type { Archive, Dashboard, Order, OrderItemT, PrinterStatus } from '../types'

/** Guided start-print flow for an order item (docs/orders.md):
 *  variance → plate → printer → printer-ready confirm → AMS confirm → start.
 *  An archive-pick step is prepended when the item has no mapping yet. */
export default function PrintWizard({
  item,
  order,
  data,
  onDone,
  onClose,
}: {
  item: OrderItemT
  order: Order
  data: Dashboard
  onDone: (updated: Order) => void
  onClose: () => void
}) {
  const [archives, setArchives] = useState<Archive[] | null>(null)
  const [archive, setArchive] = useState<Archive | null>(null)
  const [variance, setVariance] = useState(item.variant ?? '')
  const [plate, setPlate] = useState<number | null>(null)
  const [printer, setPrinter] = useState<PrinterStatus | null>(null)
  const [step, setStep] = useState<
    'archive' | 'variance' | 'plate' | 'printer' | 'ready' | 'ams' | 'start'
  >('archive')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/archives')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((list: Archive[]) => {
        setArchives(list)
        const mapped = list.find((a) => a.id === item.bambuddy_archive_id)
        if (mapped) {
          setArchive(mapped)
          setStep('variance')
        }
      })
      .catch(() => setError('Could not load archives from BamBuddy.'))
  }, [item.bambuddy_archive_id])

  const amsSpools = useMemo(
    () =>
      printer
        ? data.spools.filter((s) => s.location?.startsWith(`${printer.name} / AMS `))
        : [],
    [printer, data.spools],
  )

  const start = async () => {
    if (!archive || !printer) return
    setBusy(true)
    setError(null)
    try {
      const resp = await fetch(`/api/order-items/${item.id}/dispatch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          archive_id: archive.id,
          printer_id: String(printer.id),
          printer_name: printer.name,
          plate,
          variance_note: variance.trim() || null,
          printer_ready_confirmed: true,
          ams_confirmed: true,
        }),
      })
      if (!resp.ok) throw new Error()
      onDone(await resp.json())
    } catch {
      setError('Dispatch failed — check BamBuddy and try again.')
      setBusy(false)
    }
  }

  const stepTitle: Record<typeof step, string> = {
    archive: 'What should this print?',
    variance: 'Variances from default',
    plate: 'Pick plate',
    printer: 'Pick printer',
    ready: 'Printer ready?',
    ams: 'Filament loaded?',
    start: 'Start print',
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col gap-4 bg-slate-900 p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{stepTitle[step]}</h2>
          <p className="text-slate-400">
            {item.title}
            {item.quantity > 1 && ` ×${item.quantity}`} — {order.buyer_name}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl bg-slate-800 px-5 py-3 text-lg font-semibold hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/20 px-4 py-3 font-semibold text-red-300">{error}</p>
      )}

      {step === 'archive' && (
        <div className="flex flex-col gap-2">
          {archives === null && !error && <p className="text-slate-400">Loading archives…</p>}
          {archives?.map((a) => (
            <PickerOption
              key={a.id}
              onClick={() => {
                setArchive(a)
                setStep('variance')
              }}
            >
              {a.name}{' '}
              <span className="text-sm font-normal text-slate-400">
                {a.plates.length} plate{a.plates.length === 1 ? '' : 's'}
              </span>
            </PickerOption>
          ))}
        </div>
      )}

      {step === 'variance' && (
        <div className="flex flex-col gap-4 max-w-xl">
          {item.personalization && (
            <p className="rounded-xl bg-sky-500/15 px-4 py-3 text-sky-300">
              Personalization: {item.personalization}
            </p>
          )}
          <label className="text-slate-300">
            Anything different from the default? (color, size…) Leave as-is if standard.
          </label>
          <input
            value={variance}
            onChange={(e) => setVariance(e.target.value)}
            placeholder="e.g. Sapphire blue instead of black"
            className="rounded-xl bg-slate-800 px-5 py-4 text-lg outline outline-slate-700 placeholder:text-slate-500"
          />
          <NextButton
            onClick={() => {
              if (!archive) return
              if (archive.plates.length > 1) {
                setStep('plate')
              } else {
                setPlate(archive.plates[0]?.index ?? null)
                setStep('printer')
              }
            }}
          />
        </div>
      )}

      {step === 'plate' && archive && (
        <div className="flex flex-col gap-2">
          {archive.plates.map((p) => (
            <PickerOption
              key={p.index}
              onClick={() => {
                setPlate(p.index)
                setStep('printer')
              }}
            >
              {p.name ?? `Plate ${p.index}`}
              {p.objects != null && (
                <span className="text-sm font-normal text-slate-400"> · {p.objects} objects</span>
              )}
            </PickerOption>
          ))}
        </div>
      )}

      {step === 'printer' && (
        <div className="flex flex-col gap-2">
          {data.printers.map((p) => (
            <PickerOption
              key={p.id}
              onClick={() => {
                setPrinter(p)
                setStep('ready')
              }}
            >
              {p.name}{' '}
              <span
                className={`text-sm font-normal ${
                  p.state === 'idle' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {p.model} · {p.state}
              </span>
            </PickerOption>
          ))}
        </div>
      )}

      {step === 'ready' && printer && (
        <ConfirmStep
          text={`${printer.name} is currently “${printer.state}”. Is the plate clear and the printer ready to start?`}
          warn={printer.state !== 'idle' && printer.state !== 'finished'}
          confirmLabel="Printer is ready"
          onConfirm={() => setStep('ams')}
        />
      )}

      {step === 'ams' && printer && (
        <div className="flex flex-col gap-4 max-w-xl">
          <p className="text-lg text-slate-300">
            Confirm the AMS on <span className="font-semibold">{printer.name}</span> is loaded
            with compatible filament{variance.trim() && <> for “{variance.trim()}”</>}.
          </p>
          {amsSpools.length > 0 ? (
            <div className="flex flex-col gap-2">
              {amsSpools.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-3">
                  <span
                    className="h-6 w-6 rounded-full border border-slate-500"
                    style={{ backgroundColor: s.color_hex ? `#${s.color_hex}` : '#64748b' }}
                  />
                  <span className="font-medium">{s.filament_name}</span>
                  <span className="text-sm text-slate-400">{s.location?.split(' / ').pop()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-amber-300">
              No spools are checked out to this printer in Spoolman — verify the AMS physically.
            </p>
          )}
          <ConfirmStep
            text=""
            confirmLabel="Filament is loaded and compatible"
            onConfirm={() => setStep('start')}
          />
        </div>
      )}

      {step === 'start' && archive && printer && (
        <div className="flex flex-col gap-4 max-w-xl">
          <div className="rounded-2xl bg-slate-800 p-5 text-lg leading-relaxed">
            <div><span className="text-slate-400">Model:</span> {archive.name}</div>
            {plate != null && archive.plates.length > 1 && (
              <div><span className="text-slate-400">Plate:</span> {plate}</div>
            )}
            <div><span className="text-slate-400">Printer:</span> {printer.name}</div>
            {variance.trim() && (
              <div><span className="text-slate-400">Variance:</span> {variance.trim()}</div>
            )}
            <div className="mt-2 text-sm text-emerald-400">
              ✓ Printer confirmed ready · ✓ AMS confirmed loaded
            </div>
          </div>
          <button
            onClick={start}
            disabled={busy}
            className="rounded-2xl bg-emerald-600 px-6 py-5 text-2xl font-bold hover:bg-emerald-500 active:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? 'Starting…' : 'Start print'}
          </button>
        </div>
      )}
    </div>
  )
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="self-start rounded-xl bg-sky-600 px-6 py-4 text-lg font-bold hover:bg-sky-500"
    >
      Next
    </button>
  )
}

function ConfirmStep({
  text,
  warn,
  confirmLabel,
  onConfirm,
}: {
  text: string
  warn?: boolean
  confirmLabel: string
  onConfirm: () => void
}) {
  return (
    <div className="flex flex-col gap-4 max-w-xl">
      {text && (
        <p className={`text-lg ${warn ? 'text-amber-300' : 'text-slate-300'}`}>
          {warn && '⚠ '}
          {text}
        </p>
      )}
      <button
        onClick={onConfirm}
        className="self-start rounded-xl bg-sky-600 px-6 py-4 text-lg font-bold hover:bg-sky-500"
      >
        {confirmLabel}
      </button>
    </div>
  )
}
