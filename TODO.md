# TODO

## Backlog

- [ ] Verify BamBuddy client endpoints against live instance; pin version in docs/integrations.md
- [ ] MJPEG camera proxy + camera view on printer wall
- [ ] Create orders schema + migrations (channels, orders, order_items, print_jobs, listing_map)
- [ ] Implement ChannelOrder upsert service + POST /api/ingest/{channel} with per-channel tokens
- [ ] Build manual order entry + Orders screen
- [ ] Build Etsy connector (OAuth2 setup, receipt polling)
- [ ] Build eBay connector (Fulfillment API getOrders polling)
- [ ] Build Shopify connector (custom-app token, GraphQL Admin API)
- [ ] Build start-a-print flow (archive → printer → filament check → dispatch)
- [ ] Reconcile print outcomes → order item states (webhooks + polling fallback)
- [ ] Implement listing_map for one-tap repeat prints
- [ ] Decide app auth: shared operator PIN vs per-user (see docs/roadmap.md open decisions)
- [ ] Serve the app over HTTPS on the LAN (camera scanning requires a secure context on the tablet — reverse proxy w/ local CA, or Tailscale HTTPS)
- [ ] Printer QR labels (`CRV:P:` + printer id) so check-out can be scan → scan too
- [ ] Wire BamBuddy AMS assignment API for check-out once verified against live instance
- [ ] Direct thermal printing (skip OS print dialog) if label printer supports network ZPL/ESC-POS — need printer model from owner
- [ ] Define + build Products screen (likely catalog / listing_map management; scope with owner)
- [ ] Replace placeholder SVG PWA icon with proper PNG icon set (192/512 + maskable)
- [ ] Add prettier config to frontend (CLAUDE.md names it; Vite template ships oxlint only)

## In Progress

## Done

- [x] QR scan workflow: scan spool/bin → assign to printer AMS slot or move to bin (done 2026-08-27: header Scan button; spool→scan-bin fast path, printer/slot + bin list pickers, bin→spool list; BarcodeDetector + jsQR fallback; needs HTTPS on tablet)

- [x] Slim tablet Filament screen (loaded + low + search only); move bins/full inventory to new Admin screen (done 2026-08-27: Admin sits separated at menu bottom; task-focused principle recorded in CLAUDE.md)

- [x] Filament logistics: 1x2 thermal labels (spool + bin QR), bin registry, check-in/check-out, printer/AMS-slot assignment (done 2026-08-27: bins live in Spoolman locations setting; labels via reportlab+segno PDFs; Filament screen has bin chips + To bin / To printer pickers)

- [x] Screen navigation dropdown (Dashboard / Orders / Current Prints / Filament / Products) (done 2026-08-27: header dropdown replaces title; hash URLs; Current Prints + Filament screens live, Orders/Products placeholders)

- [x] Build BamBuddy client + /ws/status relay + dashboard printer-wall screen (done 2026-08-27: REST-polling relay broadcasts snapshots; wall shows state/progress/layers/temps/errors; per-printer failures degrade to OFFLINE tile)
- [x] Build Spoolman client + spool/low-stock display (done 2026-08-27: spool strip with color/remaining/location, low-stock highlight + header count)
- [x] Dev harness: Spoolman in compose + mock BamBuddy with simulated printers (done 2026-08-27: real Spoolman service + seed script; mock BamBuddy under `--profile dev` simulates 4 printers incl. plate-clear and HMS error states)

- [x] Scaffold backend (FastAPI, uv, SQLAlchemy async, Alembic, pytest, ruff) (done 2026-08-27: backend/ with health API, config, DB session, client/connector skeletons; pytest + ruff green)
- [x] Write docker-compose.yml (app + postgres) and complete .env.example (done 2026-08-27: compose up verified — /api/health reports db ok, PWA served)
- [x] Scaffold frontend (Vite + React + TS + Tailwind + vite-plugin-pwa) (done 2026-08-27: hello dashboard with backend health check; installable manifest + service worker)
