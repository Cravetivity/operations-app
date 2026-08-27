import type { ReactNode } from 'react'

/** Full-screen touch picker: large tappable rows, backdrop tap to cancel. */
export default function PickerModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-slate-800 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-slate-400 hover:bg-slate-700 active:bg-slate-600"
          >
            Cancel
          </button>
        </div>
        <div className="flex flex-col gap-2">{children}</div>
      </div>
    </div>
  )
}

export function PickerOption({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl bg-slate-700 px-5 py-4 text-left text-lg font-semibold hover:bg-slate-600 active:bg-slate-500"
    >
      {children}
    </button>
  )
}
