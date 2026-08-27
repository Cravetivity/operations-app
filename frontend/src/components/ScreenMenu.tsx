import { useEffect, useRef, useState } from 'react'
import { SCREENS, type ScreenKey } from '../navigation'

export default function ScreenMenu({
  screen,
  onSelect,
}: {
  screen: ScreenKey
  onSelect: (key: ScreenKey) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const current = SCREENS.find((s) => s.key === screen)!

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-xl px-4 py-3 -mx-4 -my-3 text-2xl font-bold tracking-tight hover:bg-slate-800 active:bg-slate-700"
      >
        {current.label}
        <svg viewBox="0 0 20 20" className={`h-6 w-6 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M5 7.5 L10 12.5 L15 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-2xl bg-slate-800 shadow-xl shadow-black/40 outline outline-slate-700"
        >
          {SCREENS.map((s) => (
            <button
              key={s.key}
              role="menuitem"
              onClick={() => {
                onSelect(s.key)
                setOpen(false)
              }}
              className={`block w-full px-5 py-4 text-left text-xl font-semibold hover:bg-slate-700 active:bg-slate-600 ${
                s.key === screen ? 'text-sky-400' : ''
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
