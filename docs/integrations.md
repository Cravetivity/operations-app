# External integrations

> Status: research notes as of 2026-08-27, pre-implementation. Verify endpoint
> details against live instances before coding; record actual versions here.

## BamBuddy

- Repo: <https://github.com/maziggy/bambuddy> (AGPL-3.0) · Site: <https://bambuddy.cool>
- **Upstream main line — use this repo only.** Verified 2026-08-27 via GitHub
  API: `maziggy/bambuddy` is the original (not a fork) and actively developed;
  repos like `Berkey/berkey-bambuddy` are forks of it. Do not build against or
  cite forks.
- API reference: <https://wiki.bambuddy.cool/reference/api/> (200+ REST
  endpoints, interactive browser). Backend is FastAPI, so a live OpenAPI spec
  should be available from the instance — use it to generate/verify our client.
- Auth: API keys (per-user ownership, scopable). Create a dedicated
  `operations-app` key. BamBuddy also supports JWT users/permissions and OIDC;
  we only need the API key.
- Realtime: WebSocket printer status; live camera as MJPEG streams.
- Webhooks: BamBuddy can push events — prefer webhooks over polling for
  print-finished events once wired up.

Capabilities we plan to use:

| Need | BamBuddy feature |
| --- | --- |
| Printer wall (status, progress, temps, time left) | WebSocket status + printer endpoints |
| Start a print of a known model | Archives + re-print to any printer with filament matching |
| Queueing/dispatch | Print queue endpoints (supports multi-printer dispatch) |
| Thumbnails/previews | Archive metadata (3MF thumbnails) |
| Cameras | MJPEG stream URLs (proxied by our backend) |
| Filament in AMS slots | AMS mapping + Spoolman sync data |
| Print cost preview | Per-spool cost tracking endpoints |

Explicitly out of scope for us (use BamBuddy's own UI): slicing pipelines,
printer configuration, smart plugs, notifications, timelapse editing.

**Note on BamBuddy "Projects":** BamBuddy projects group related prints with a
URL + cover photo — a curation feature, not an order-management fit (no
marketplace linkage, buyer info, fulfillment states, or multi-source
aggregation). Decision: orders live in this app; optionally we may *mirror* an
order into a BamBuddy project for cross-referencing, but that's a
nice-to-have, not the model.

## Spoolman

- Repo: <https://github.com/Donkie/Spoolman> · API docs (ReDoc):
  <https://donkie.github.io/Spoolman/>
- REST API v1: vendors / filaments / spools CRUD, spool `use` endpoint for
  consuming weight/length, CSV/JSON export. Websocket for live updates.
  FastAPI-based; OpenAPI spec available from the instance.
- No auth built in (deploy on trusted network; front with a proxy if needed).
- BamBuddy already syncs per-filament usage into Spoolman — so **we read from
  Spoolman for inventory display and low-stock warnings, and avoid writing
  usage ourselves** (BamBuddy handles decrementing). We may write when
  operators do manual inventory actions (new spool intake, corrections).

## Etsy

- Open API v3: <https://developers.etsy.com/> (repo: <https://github.com/etsy/open-api>)
- OAuth 2.0 (authorization code + refresh tokens); app must be provisioned
  with a personal access grant for the shop.
- Relevant endpoints: `getShopReceipts` (orders = "receipts"), receipt
  transactions (line items), `createReceiptShipment` (later phase: mark
  shipped with tracking).
- Polling model (no reliable webhooks for receipts) — poll every ~5 min with
  `min_last_modified` cursor.
- Client: use httpx directly. Third-party Python wrappers for v3 exist but
  are thin/stale; not worth the dependency.

## eBay

- Sell APIs: <https://developer.ebay.com/> — primarily the **Fulfillment API**
  (`getOrders`, `shippingFulfillment` for tracking upload later).
- OAuth 2.0 with refresh tokens; requires eBay developer account + user
  consent flow once.
- eBay offers Notification API / Platform Notifications, but polling
  `getOrders` with a modification-date filter is simpler and sufficient at
  farm scale.

## Shopify

- Docs: <https://shopify.dev/docs/api> — use the **GraphQL Admin API** (the
  REST Admin API is legacy for new apps). In-process `OrderConnector`, same
  as Etsy/eBay.
- Auth: since this is our own store, create a **custom app** in the store
  admin (Settings → Apps → Develop apps) and use its Admin API access token —
  no OAuth flow needed. Scopes: `read_orders` (later `write_fulfillments`
  for mark-shipped).
- Ingest: poll the `orders` GraphQL query filtered by `updated_at`, same
  cursor pattern as the other connectors. Shopify also has reliable webhooks
  (`orders/create`, `orders/updated`) — a good later upgrade to cut latency,
  but it requires a publicly reachable HTTPS endpoint, so start with polling
  from the LAN.
- Mapping notes: order line items carry variant title + custom attributes
  (personalization) cleanly; `note` maps to `buyer_note`. No native ship-by
  date — leave `ship_by` null or derive from a per-channel SLA in
  `channels.config`.
- Later phase: mark shipped via `fulfillmentCreateV2` with tracking info.

## Mercari & Poshmark (no documented seller APIs)

Neither offers a public/documented seller API, so these use the
**`ingest_api` path**: a custom ingestion solution built outside this repo
that POSTs normalized `ChannelOrder` payloads to `POST
/api/ingest/{channel_key}` (see [orders.md](orders.md)). The core app needs
zero Mercari/Poshmark-specific code — just a `channels` row and an ingest
token.

Candidate ingestion mechanisms, roughly in order of robustness:

1. **Order-notification email parsing** — forward "You made a sale" emails to
   a dedicated mailbox; a small parser service extracts order fields and
   posts them. Most stable surface these platforms offer; degrades to a
   partially-filled order the operator completes on the tablet.
2. **Manual quick-entry** with a channel preset — always available fallback;
   also the interim solution until a parser exists.
3. **Dashboard scraping / browser extension** — richest data but fragile and
   likely against platform ToS; if pursued, keep it isolated in its own
   service so breakage never affects the core app.

Whatever is built, it should mark fields it couldn't extract so the UI can
prompt the operator, rather than guessing.

## Other order sources

Fairs, direct sales, word of mouth: **manual order entry** in the app
(`channel = manual`). Any future marketplace plugs in as either an in-process
`OrderConnector` (if it has an API) or an external ingest client — the orders
schema is channel-agnostic by design ([orders.md](orders.md)).

## Open-source landscape (surveyed 2026-08)

Considered and rejected as the base for the orders layer:

- **Printago, 3DQue Direct2Print** — closest functional matches (marketplace →
  print queue) but commercial/hosted, not self-hosted OSS.
- **General OSS e-commerce/OMS (Saleor, Medusa, Odoo, ERPNext)** — heavyweight,
  wrong grain; would dwarf the actual need and fight the tablet-first UX.
- **Ship-station-style aggregators** — no self-hosted OSS option with good
  Etsy+eBay coverage.

Conclusion: a small bespoke orders schema + two pollers is less code than
integrating any of the above. Useful libraries instead: httpx, pydantic,
APScheduler, `authlib` (OAuth2 token refresh for Etsy/eBay).
