import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

/** Camera QR scanner. Uses the native BarcodeDetector where available
 *  (Chrome on the Android tablet), falling back to jsQR on canvas frames.
 *  Camera access needs a secure context — plain LAN http will not work. */
export default function Scanner({
  hint,
  onScan,
}: {
  hint: string
  onScan: (payload: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  })
  const [error, setError] = useState<string | null>(() =>
    typeof navigator.mediaDevices?.getUserMedia === 'function'
      ? null
      : 'Camera unavailable. The app must be served over HTTPS (or localhost) for camera access.',
  )

  useEffect(() => {
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') return

    let stream: MediaStream | null = null
    let stopped = false
    let raf = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> }
    const BD = (window as { BarcodeDetector?: new (o: { formats: string[] }) => Detector })
      .BarcodeDetector
    const detector = BD ? new BD({ formats: ['qr_code'] }) : null

    const tick = async () => {
      if (stopped) return
      const video = videoRef.current
      if (video && video.readyState >= 2) {
        let payload: string | null = null
        if (detector) {
          try {
            const codes = await detector.detect(video)
            payload = codes[0]?.rawValue ?? null
          } catch {
            /* detector can throw while the stream warms up */
          }
        } else if (ctx) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
          payload = jsQR(img.data, img.width, img.height)?.data ?? null
        }
        if (payload && !stopped) {
          onScanRef.current(payload)
          return // caller decides whether to remount/resume
        }
      }
      raf = requestAnimationFrame(() => void tick())
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current
        if (video) {
          video.srcObject = s
          void video.play()
        }
        raf = requestAnimationFrame(() => void tick())
      })
      .catch(() => setError('Camera permission denied or no camera found.'))

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="relative flex grow items-center justify-center overflow-hidden rounded-2xl bg-black">
      {error ? (
        <p className="max-w-sm p-6 text-center text-amber-400">{error}</p>
      ) : (
        <>
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-2xl border-4 border-sky-400/70" />
          </div>
          <p className="absolute bottom-4 left-0 right-0 text-center text-lg font-semibold text-white drop-shadow">
            {hint}
          </p>
        </>
      )}
    </div>
  )
}
