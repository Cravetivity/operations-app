/** Location strings of the form "<printer> / AMS <slot>" are printer
 *  assignments (docs/architecture.md, Inventory & labels); anything else is
 *  a bin. */
export function isAmsLocation(location: string | null): boolean {
  return !!location && / \/ AMS \d$/.test(location)
}

/** Label QR payloads: CRV:S:<spool id> (spool) / CRV:B:<name> (bin). */
export type ScanTarget = { kind: 'spool'; id: number } | { kind: 'bin'; name: string }

export function parseScan(payload: string): ScanTarget | null {
  const spool = /^CRV:S:(\d+)$/.exec(payload)
  if (spool) return { kind: 'spool', id: Number(spool[1]) }
  const bin = /^CRV:B:(.+)$/.exec(payload)
  if (bin) return { kind: 'bin', name: bin[1] }
  return null
}
