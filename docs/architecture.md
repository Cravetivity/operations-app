# Architecture

> Status: design document. No code exists yet (2026-08-27). Update this file as
> the implementation lands.

## Purpose

A tablet-first PWA that gives operators (owner + staff) a fast, simplified
interface for the daily print-farm loop:

1. See what orders came in (Etsy, eBay, Shopify, Mercari, Poshmark,
   manual/other).
2. Decide what to print, on which printer, with which filament.
3. Start/monitor/clear prints with minimal taps.
4. Mark orders fulfilled and keep filament inventory honest.

BamBuddy's full UI remains available for anything advanced (slicing pipelines,
scheduling, printer configuration, notifications, etc.). This app deliberately
covers a *subset* of workflows, tuned for speed.

## System context

```text
                          ┌───────────────────────────────┐
  Etsy / eBay /     ──────►                               │
  Shopify APIs            │   operations-app (this repo)  │
  (polled connectors)     │                               │
  Mercari/Poshmark  ──────►   FastAPI + PostgreSQL        │
  ingesters (external,    │   serves the PWA              │
  POST /api/ingest)       └───────┬───────────────┬───────┘
                                  │ REST + WS     │ REST
                                  ▼               ▼
                          ┌──────────────┐  ┌──────────────┐
                          │   BamBuddy   │  │   Spoolman   │
                          │ (printers,   │  │ (spools,     │
                          │  queue,      │◄─┤  filaments)  │
                          │  archives)   │  │              │
                          └──────┬───────┘  └──────────────┘
                                 │ MQTT/FTPS (not our concern)
                                 ▼
                            Bambu Lab printers
```

Ownership boundaries:

| Domain | Owner | Our access |
| --- | --- | --- |
| Printers, print queue, dispatch, archives, cameras | BamBuddy | REST API + WebSocket, API key |
| Spools, filament types, usage | Spoolman (BamBuddy syncs with it too) | REST API |
| Orders, order items, order↔print links, fulfillment state | **This app** | Own PostgreSQL schema |

We never store authoritative copies of BamBuddy/Spoolman data — only external
IDs plus small display snapshots (e.g. archive name, spool color) so lists
render fast and still make sense if an upstream is briefly down.

## Backend

FastAPI application, three layers:

- `api/` — HTTP routes and the WebSocket endpoint. Thin: validate, call a
  service, serialize.
- `services/` — business logic: order sync, order↔print linking, fulfillment
  transitions, dashboard aggregation.
- `clients/` — one httpx-based wrapper per external system (`bambuddy.py`,
  `spoolman.py`, `etsy.py`, `ebay.py`). All auth, base URLs, timeouts, and
  retry policy live here.

The backend is also a **facade/aggregator**: the tablet makes one call to
`/api/dashboard` and gets printers + active jobs + pending orders in a single
payload, instead of the frontend juggling three upstream APIs. This keeps the
frontend simple and puts caching and failure handling in one place.

### Realtime

BamBuddy exposes WebSocket printer status. The backend maintains one upstream
connection and fans out a simplified, aggregated status stream to connected
tablets over `/ws/status`. Camera views embed BamBuddy's MJPEG streams
directly (proxied through the backend so the tablet only ever talks to one
origin — also simplifies PWA scope and CORS).

### Order ingestion (channel-agnostic)

Orders arrive through three paths that converge on one normalized
`ChannelOrder` shape and one idempotent upsert service (details in
[orders.md](orders.md)):

- **In-process connectors** for sources with documented APIs (Etsy, eBay,
  Shopify), polled by APScheduler.
- **Ingest API** (`POST /api/ingest/{channel_key}`, token-authenticated) for
  sources without documented APIs (Mercari, Poshmark) — custom
  parsers/scrapers live outside this repo and just POST here.
- **Manual entry** in the UI.

Channels are rows in a `channels` table, not code enums — adding a source is
data plus (optionally) a connector, never a schema migration.

### Background jobs (APScheduler, in-process)

- Run `api_poll` connectors for new/updated orders (interval per channel,
  ~5 min default).
- Refresh cached upstream snapshots.
- Reconcile order↔print links against BamBuddy print outcomes (a linked print
  finishing successfully prompts the "mark printed" flow).

## Frontend (PWA)

Vite + React + TS + Tailwind, `vite-plugin-pwa` (Workbox) for installability
and offline app shell. Served as static files by FastAPI (single origin — no
CORS in production).

Design constraints:

- 10" Android tablet, landscape, Chrome, likely mounted or handled with
  gloves: ≥48px touch targets, high contrast, big type, minimal chrome.
- Navigation: a dropdown in the top-left (no app title — the screen name IS
  the header) switches between screens; hash-based URLs (`#/orders`) so
  refresh and bookmarks keep the screen. Screens:
  1. **Dashboard** — printer wall (status, progress, time left) + spool
     strip + low-stock/health indicators. The default idle screen.
  2. **Orders** — queue of open orders, grouped by status; tap into an order
     to see items and linked prints (Phase 2).
  3. **Current Prints** — active prints only, sorted by time remaining,
     including attention states (clear plate, errors).
  4. **Filament** — task-focused, not data-complete (owner direction): what's
     loaded in printers, what's low, and search-on-demand. Check-in/out and
     labels act on those subsets. (Start-a-print flow will pick filament in
     context — Phase 3.)
  5. **Products** — catalog view (scope TBD with owner; likely listing_map
     management — what we sell mapped to what we print).
  6. **Admin** (bottom of menu, visually separated) — desk/setup tasks kept
     off the tablet workflows: bin management, label printing, full spool
     inventory. Full data management stays in the upstream Spoolman/BamBuddy
     UIs.
- Every action reachable in ≤3 taps from the dashboard.
- Escape hatch: deep links into the full BamBuddy UI for anything advanced.

## Data flow examples

**New Etsy order** → poller fetches via Etsy API → upserted into `orders` +
`order_items` → appears on tablet Orders screen → operator taps item → picks
matching BamBuddy archive → app calls BamBuddy queue/dispatch API → link row
created (`print_jobs`) → status relayed live → print completes → operator
confirms → item marked printed; when all items printed, order moves to
`ready_to_ship` → shipped/fulfilled (v1: manually, marking fulfilled in the
marketplace by hand; API-side fulfillment is a later phase).

**Filament check** → dashboard shows AMS slot assignments (BamBuddy) and
remaining weight (Spoolman) → low-spool warning before dispatching a long
print.

## Inventory & labels

Decision (2026-08-27): filament location tracking lives in **Spoolman**, not
our database — our app adds workflows and labels on top.

- **Bins** are entries in Spoolman's `locations` setting (the same list its
  UI shows as lanes), so both UIs always agree and no schema drift is
  possible. Bins have no numeric id; the **name is the identity** — renaming
  a bin means reprinting its label.
- **Check-in/check-out** just updates `spool.location` via PATCH. A spool
  assigned to a printer uses the parseable convention
  `"<printer name> / AMS <slot>"` (bin names may not contain `/`), which
  appears as a per-printer lane in Spoolman's own UI. Wiring BamBuddy's AMS
  assignment API on top is pending live verification (TODO.md).
- **Labels** are 2x1 in monochrome PDFs (`GET /api/labels/spool/{id}`,
  `/api/labels/bin/{name}`) rendered with reportlab + segno, printed at 100%
  scale through any OS thermal driver. QR payloads are compact for reliable
  small-format scans: `CRV:S:<spool id>` and `CRV:B:<bin name>`. These codes
  are the hook for the future scan-driven print workflow (scan spool → scan
  printer/bin) on the tablet camera.

## Development harness

Phase 1 was built without live credentials, against services in the compose
stack:

- **Spoolman runs in compose for real** (service `spoolman`, host port 7912)
  — it can graduate into the production Spoolman instance. Seed test
  inventory with `cd backend && uv run python scripts/seed_spoolman.py`
  (idempotent).
- **BamBuddy is mocked** ([dev/mock-bambuddy/](../dev/mock-bambuddy/)),
  started only with `docker compose --profile dev up`. It implements the
  slice of the API we consume (`/api/v1/printers`, `/printers/{id}/status`,
  `/health`, `X-API-Key` auth) and simulates four printers deterministically
  from the clock: two mid-print, one cycling print → plate-clear → idle, one
  that periodically raises an HMS error. Point `BAMBUDDY_URL` at the real
  instance to switch; the mock's response shapes follow the published API
  reference and must be corrected if live verification disagrees.

The status relay polls BamBuddy REST every `PRINTER_POLL_SECONDS` (default
3s) and fans out over `/ws/status`; BamBuddy's own websocket format is
undocumented, so polling is the baseline until verified against a live
instance.

## Deployment

Docker Compose, two services in this repo:

- `app` — single image: FastAPI + built frontend static files.
- `postgres` — orders database, named volume.

BamBuddy and Spoolman are **external**, reachable on the LAN/Tailnet, and
configured via `.env`:

```text
BAMBUDDY_URL=…        BAMBUDDY_API_KEY=…
SPOOLMAN_URL=…
ETSY_API_KEY=…        ETSY_… (OAuth2 tokens)
EBAY_… (OAuth2 tokens)
DATABASE_URL=postgresql+asyncpg://…
```

Auth for the app itself: v1 is LAN-only with a single shared operator PIN
(staff-friendly on a tablet); per-user auth is an open decision — see
[roadmap.md](roadmap.md).
