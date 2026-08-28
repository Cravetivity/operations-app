# Roadmap

> Status as of 2026-08-27: **nothing implemented**. Docs in this directory are
> the plan of record. Check items off and note deviations here as work lands.

## Phase 0 — Scaffold

- [x] Backend skeleton (FastAPI, pydantic-settings, SQLAlchemy async, Alembic,
      pytest, ruff) under `backend/`, managed with `uv` (2026-08-27)
- [x] Frontend skeleton (Vite + React + TS + Tailwind + vite-plugin-pwa) under
      `frontend/` (2026-08-27)
- [x] `docker-compose.yml` (app + postgres) and complete `.env.example` (2026-08-27)
- [x] CI-less smoke path: `docker compose up` serves a hello dashboard (2026-08-27)

## Phase 1 — Read-only printer wall (first useful thing on the tablet)

- [x] `clients/bambuddy.py` per the published API reference (2026-08-27;
      built against the dev-harness mock — endpoint verification against the
      live instance still pending, see TODO.md)
- [x] `/ws/status` relay + Dashboard screen: printer tiles with state,
      progress, time remaining (2026-08-27; relay polls BamBuddy REST — its
      WS message format is undocumented; thumbnails + MJPEG proxy pending)
- [x] Spoolman client + spool/low-stock display (2026-08-27)

## Phase 2 — Orders (manual first)

- [x] Orders schema (channels, orders, items, print_jobs) + migrations per
      docs/orders.md (2026-08-27; revised status model — async milestones)
- [ ] Normalized `ChannelOrder` upsert service + `POST /api/ingest/{channel}`
      with per-channel tokens (unlocks external ingesters early)
- [x] Manual order entry + Orders screen (2026-08-27; milestone toggles,
      per-part status chips, ship-by urgency sort)
- [ ] Etsy connector (OAuth2 setup, receipt upsert)
- [ ] eBay connector (Fulfillment API getOrders upsert)
- [ ] Shopify connector (custom-app token, GraphQL Admin API orders query)

## Phase 3 — The core loop: order → print

- [x] Start-a-print wizard (2026-08-27: variance → plate → printer → ready
      confirm → AMS confirm → start; against mock BamBuddy — archive/print
      endpoint shapes need live verification)
- [ ] `print_jobs` linking + outcome reconciliation (BamBuddy webhooks,
      polling fallback)
- [ ] `listing_map` so repeat listings are one-tap
- [ ] Derived order statuses; ready-to-ship view

## Phase 4 — Polish / later

- [ ] Mark-shipped via marketplace APIs (Etsy createReceiptShipment, eBay
      shippingFulfillment, Shopify fulfillmentCreateV2) instead of manual
- [ ] Shopify webhooks (orders/create, orders/updated) to replace polling —
      needs a publicly reachable HTTPS endpoint
- [ ] Operator PIN / kiosk hardening; decide on per-user auth
- [ ] Push notifications (print failed / order ship-by at risk) — consider ntfy
- [ ] Mercari/Poshmark ingesters (separate service(s); start with email
      parsing — see docs/integrations.md)
- [ ] Additional order sources (new channel row + connector or ingester)

## Open decisions

- **App auth:** shared PIN vs per-user (BamBuddy has OIDC; do we care who
  tapped?). Leaning shared PIN for v1.
- **Mirror orders into BamBuddy projects?** Nice for cross-reference in
  BamBuddy's UI; skip unless it proves useful.
- **Postgres vs SQLite:** Postgres chosen for compose-friendliness and
  concurrent pollers; revisit only if ops burden appears.
- **Camera proxying** bandwidth on the tablet Wi-Fi — may need stills instead
  of live MJPEG on the wall view.
