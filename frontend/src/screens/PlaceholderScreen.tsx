export default function PlaceholderScreen({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex grow flex-col items-center justify-center gap-2 text-center">
      <p className="text-2xl font-semibold text-slate-300">{title}</p>
      <p className="text-slate-500">Coming in {phase} — see docs/roadmap.md</p>
    </div>
  )
}
