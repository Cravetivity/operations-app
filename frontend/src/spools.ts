/** Location strings of the form "<printer> / AMS <slot>" are printer
 *  assignments (docs/architecture.md, Inventory & labels); anything else is
 *  a bin. */
export function isAmsLocation(location: string | null): boolean {
  return !!location && / \/ AMS \d$/.test(location)
}
