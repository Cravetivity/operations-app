export type Temperatures = {
  nozzle: number | null
  nozzle_target: number | null
  bed: number | null
  bed_target: number | null
  chamber: number | null
}

export type PrinterStatus = {
  id: number | string
  name: string
  model: string | null
  connected: boolean
  state: string
  progress: number | null
  remaining_time: number | null // minutes
  layer_num: number | null
  total_layers: number | null
  filename: string | null
  temperatures: Temperatures
  awaiting_plate_clear: boolean
  hms_errors: { code?: string; message?: string }[]
}

export type Spool = {
  id: number
  filament_name: string
  vendor: string | null
  material: string | null
  color_hex: string | null
  remaining_weight: number | null
  location: string | null
  low: boolean
}

export type Snapshot = {
  bambuddy: 'ok' | 'unreachable' | 'unconfigured'
  printers: PrinterStatus[]
  updated_at: string | null
}

export type Dashboard = Snapshot & {
  spoolman: 'ok' | 'unreachable' | 'unconfigured'
  spools: Spool[]
  low_stock_count: number
}

export type PrintJobT = {
  id: string
  printer_name: string
  archive_id: string
  plate: number | null
  variance_note: string | null
  outcome: string
}

export type OrderItemT = {
  id: string
  title: string
  variant: string | null
  quantity: number
  personalization: string | null
  status: 'pending' | 'queued' | 'printing' | 'printed' | 'short'
  bambuddy_archive_id: string | null
  jobs: PrintJobT[]
}

export type MilestoneKey = 'label_printed' | 'packed' | 'shipped'

export type Order = {
  id: string
  channel: string
  buyer_name: string
  buyer_note: string | null
  status: 'new' | 'in_progress' | 'ready_to_ship' | 'packed' | 'shipped' | 'canceled'
  ordered_at: string
  ship_by: string | null
  milestones: Record<MilestoneKey, string | null>
  items: OrderItemT[]
}

export type ArchivePlate = { index: number; name?: string; objects?: number }
export type Archive = { id: string; name: string; filename?: string; plates: ArchivePlate[] }
