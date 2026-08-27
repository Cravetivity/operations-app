# Cravetivity Operations App

Tablet-first PWA for day-to-day 3D print farm operations. It is a **simplified
front-of-house layer**, not a replacement for the tools that already run the farm:

- **BamBuddy** (self-hosted Bambu Lab farm manager) owns printers, print queue,
  archives, and dispatch. We consume its REST API + WebSockets. Never talk MQTT
  to printers directly.
- **Spoolman** owns filament/spool inventory. We consume its REST API.
  (BamBuddy also syncs with Spoolman; treat Spoolman as the source of truth for
  spools.)
- **This app** owns the *orders* domain and the simplified operator workflows
  that tie orders → prints → filament. Order sources are abstracted as
  **channels**: documented APIs (Etsy, eBay, Shopify) get in-process connectors,
  undocumented sources (Mercari, Poshmark) feed a token-authenticated ingest
  API from external custom ingesters, and manual entry covers the rest. Never
  special-case a channel downstream of order ingestion; see docs/orders.md.

Primary device: 10" Android tablet in landscape, used by staff on the floor.
Must remain usable on any device. Optimize for large touch targets, few taps,
and glanceability over feature completeness.

## Current status

**Phase 1 printer wall working (2026-08-27):** BamBuddy client + REST-polling
status relay over `/ws/status`, dashboard aggregation endpoint, Spoolman
client with low-stock flagging, and the tablet printer-wall UI. Built against
the dev harness (`docker compose --profile dev up`: bundled Spoolman + mock
BamBuddy with simulated printers — see docs/architecture.md); endpoint shapes
still need verification against the live BamBuddy instance. Phase 2 (orders)
is next. The `docs/` directory is the source of truth for intended
architecture and scope. When you implement something, update the relevant doc
in the same change. See [docs/roadmap.md](docs/roadmap.md) for build order.

## Stack (decided)

- **Backend:** Python 3.12+, FastAPI, SQLAlchemy 2.x (async) + Alembic,
  Pydantic v2, httpx for outbound API calls. Package management with `uv`.
- **Database:** PostgreSQL (orders domain only — no mirroring of BamBuddy or
  Spoolman data beyond cached IDs/snapshots needed for linking).
- **Frontend:** Vite + React + TypeScript + Tailwind CSS, `vite-plugin-pwa`
  for the PWA shell (installable, offline app shell, but live data requires
  connectivity — no offline mutation queue in v1).
- **Realtime:** FastAPI WebSocket endpoint that relays/aggregates BamBuddy
  printer status; frontend never connects to BamBuddy directly.
- **Background jobs:** APScheduler inside the API process for marketplace
  order polling (Celery is overkill until proven otherwise).
- **Deployment:** Docker Compose (`app` + `postgres`). BamBuddy and Spoolman
  run elsewhere and are configured via environment variables.

## Layout (target)

```text
backend/            FastAPI app
  app/
    api/            route modules (thin; no business logic)
    clients/        bambuddy.py, spoolman.py (httpx wrappers)
    connectors/     OrderConnector implementations (etsy.py, ebay.py, shopify.py, …)
    models/         SQLAlchemy models (orders domain)
    schemas/        Pydantic request/response models
    services/       business logic (order sync, order↔print linking)
    ws/             websocket relay for printer status
  alembic/
  tests/
frontend/           Vite + React PWA
docs/               architecture & integration docs (keep current)
docker-compose.yml
.env.example        every config knob, documented
```

## Task tracking

We use [TODO.md](TODO.md) (sections: Backlog, In Progress, Done; one task per
line, GitHub checkbox syntax) instead of an external tracker. Protocol:

- At session start, read TODO.md before doing anything else.
- When taking on a task, move it from Backlog to In Progress and append the
  date, e.g. `- [ ] Build invoice parser (started 2026-08-27)`.
- When a task is finished, move it to Done, check the box, and append a
  one-line result, e.g. `(done 2026-08-27: parses PDF + CSV)`.
- Any bugs, follow-ups, or ideas discovered while working must be appended to
  Backlog as new tasks — never silently fixed out of scope or dropped.
- If a task is cross-cutting with another app repo, note the other repo in
  the task line rather than omitting it.
- Commit TODO.md changes together with the code changes they describe.
- Ask before deleting anything from Done; pruning is manual.

## Conventions

- All configuration via environment variables (pydantic-settings). Never
  hardcode BamBuddy/Spoolman URLs or API keys. Keep `.env.example` complete.
- External API access goes through `app/clients/*` wrappers only — routes and
  services never call httpx directly. Wrappers handle auth, timeouts, retries.
- Store external identifiers (BamBuddy archive/queue IDs, Spoolman spool IDs,
  Etsy/eBay order IDs) rather than copying whole records; fetch live data on
  demand and degrade gracefully when an upstream service is down (the UI must
  say "BamBuddy unreachable", not crash).
- Money as integer cents + currency code. Timestamps stored UTC; the UI
  renders local (America/Chicago).
- Backend: `ruff` (lint + format) and `pytest`. Frontend: `oxlint` (`npm run
  lint`; ships with the Vite template) + `prettier` (still to add).
- Touch UI: minimum 48px tap targets, no hover-dependent interactions, no
  right-click/keyboard-only affordances.
- Keep tablet screens task-focused, not data-complete (owner direction,
  2026-08-27): show the subset the current job needs (what's loaded, what's
  low, search-on-demand) — never full inventories or dense grids. Desk/setup
  tasks (bin management, label printing, full inventory) belong on the Admin
  screen; full data management belongs in the upstream UIs (Spoolman,
  BamBuddy), which we link to rather than reimplement.

## Commands (once scaffolded)

```bash
docker compose up -d          # full stack
cd backend && uv run pytest   # backend tests
cd backend && uv run ruff check .
cd frontend && npm run dev    # frontend dev server (proxies API)
cd backend && uv run alembic upgrade head
```

## Key docs

- [docs/architecture.md](docs/architecture.md) — system design, boundaries, data flow
- [docs/integrations.md](docs/integrations.md) — BamBuddy, Spoolman, Etsy, eBay API notes
- [docs/orders.md](docs/orders.md) — orders domain model (the part we own)
- [docs/roadmap.md](docs/roadmap.md) — phased build plan and open decisions
