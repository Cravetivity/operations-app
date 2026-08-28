# Orders domain

> Status: design document, pre-implementation (2026-08-27). This is the one
> domain this app owns. Keep this file in sync with the SQLAlchemy models and
> Alembic migrations once they exist.

## Design principle: channel abstraction

Order sources vary in how orders can be ingested: some have documented APIs
(Etsy, eBay), some have none (Mercari, Poshmark — custom ingestion to be
built), and some are ad-hoc (fairs, direct sales — manual entry). The core
schema and all workflows are therefore **channel-agnostic**:

- `channel` is **data, not a DB enum** — adding a source is an insert plus
  (optionally) a connector, never a migration.
- All ingestion paths converge on one normalized order shape
  (`ChannelOrder`, below) and one idempotent upsert service. Nothing
  downstream of the upsert ever special-cases a channel.

## Model

```text
channels             -- one row per order source
  key               text pk            -- 'etsy', 'ebay', 'shopify', 'mercari', 'poshmark', 'manual', …
  display_name      text
  ingestion         enum: api_poll | ingest_api | manual
  config            jsonb              -- connector-specific (poll interval, credential refs)
  enabled           bool

orders
  id                uuid pk
  channel_key       text fk -> channels
  external_id       text nullable      -- the source's order id (Etsy receipt_id, eBay orderId, …)
  (channel_key, external_id) unique when external_id not null
  buyer_name        text
  buyer_note        text nullable      -- personalization requests live here
  canceled          bool default false
  external_status   text nullable      -- source's own status string, display only
  label_printed_at / packed_at / shipped_at   timestamptz nullable  -- async milestones
  (headline status is derived at read time — see Status model)
  ordered_at        timestamptz
  ship_by           date nullable      -- drives urgency sorting
  total_cents       int, currency char(3)
  raw_payload       jsonb nullable     -- last marketplace payload, for debugging
  created_at / updated_at

order_items
  id                uuid pk
  order_id          fk -> orders
  external_id       text nullable      -- transaction/lineItem id
  title             text
  variant           text nullable      -- color/size from listing options
  quantity          int
  personalization   text nullable
  status            enum: pending | queued | printing | printed | short  (per-part)
  bambuddy_archive_id  text nullable   -- default archive to print for this item
  created_at / updated_at

print_jobs           -- the order↔print link; one row per dispatched print
  id                uuid pk
  order_item_id     fk -> order_items nullable  (stock prints allowed)
  bambuddy_job_ref  text nullable      -- queue entry / print id from BamBuddy
  bambuddy_printer_id text, printer_name text
  archive_id        text, plate int nullable
  variance_note     text nullable      -- operator's variance from default (e.g. color)
  printer_ready_confirmed / ams_confirmed   bool  -- wizard confirmations
  quantity          int default 1      -- items satisfied by this plate
  outcome           enum: dispatched | printing | success | failed | canceled
  created_at / updated_at

listing_map          -- teaches the app what to print for a listing
  id                uuid pk
  channel_key       text fk -> channels
  listing_external_id text, variant_pattern text null
  bambuddy_archive_id text
  note              text nullable
```

`listing_map` is what makes the workflow fast over time: once an Etsy/eBay
listing (+ variant) is mapped to a BamBuddy archive, new orders for it come in
pre-resolved to "tap to print".

## Status model (revised 2026-08-27, owner direction)

Two independent tracks per order, because fulfillment steps are
**asynchronous** with printing (a shipping label can be printed before the
parts finish):

1. **Part (order_item) print status** — consecutive:
   `pending → queued → printing → printed`, with `short` for a failed print
   needing a re-run. Transitions come from the print wizard (dispatch →
   `queued`), the reconciler once BamBuddy outcomes are wired (`printing`,
   `printed`), and operator taps (mark printed / short).
2. **Fulfillment milestones** — independent nullable timestamps on the
   order, toggled any time: `label_printed_at`, `packed_at`, `shipped_at`.

The order's **headline status is derived at read time**, never stored:
`shipped` (shipped_at set) ▸ `packed` ▸ `ready_to_ship` (all parts printed)
▸ `in_progress` (any part past pending) ▸ `new`; `canceled` overrides.
Milestones show as badges alongside the headline regardless of print state.

## Print wizard (per part)

Operator flow to start a print for an order item:
variance from default (e.g. color) → plate (multi-plate 3MF) → printer →
confirm printer ready/plate clear → confirm AMS holds compatible filament →
start. Dispatch creates a `print_jobs` row recording every choice and both
confirmations, then calls BamBuddy's print endpoint.

## Ingestion paths

Three ways orders arrive, all producing the same normalized `ChannelOrder`
payload and flowing through the same upsert service:

1. **`api_poll` — in-process connectors** (Etsy, eBay, Shopify). Each implements the
   `OrderConnector` protocol in `backend/app/connectors/`:

   ```python
   class OrderConnector(Protocol):
       key: str                                        # matches channels.key
       async def fetch_orders(self, since: datetime) -> list[ChannelOrder]: ...
   ```

   Registered in a connector registry; APScheduler polls every enabled
   `api_poll` channel on its configured interval.

2. **`ingest_api` — out-of-process ingestion** (Mercari, Poshmark, anything
   without a documented API). The backend exposes
   `POST /api/ingest/{channel_key}` accepting one or more `ChannelOrder`
   payloads, authenticated with a per-channel ingest token. The custom
   solution (email parser, scraper, browser extension, script — see
   [integrations.md](integrations.md)) lives *outside* this repo and only
   needs to speak this one endpoint. This keeps fragile scraping code
   deployable/restartable independently of the core app.

3. **`manual` — operator entry** in the tablet UI, which internally submits
   the same normalized shape.

### `ChannelOrder` (normalized shape, Pydantic)

```text
external_id, buyer_name, buyer_note?, ordered_at, ship_by?,
total_cents, currency, external_status?,
items: [ { external_id?, title, variant?, quantity, personalization? } ],
raw: object   -- source payload verbatim, stored for debugging
```

## Sync rules

- Upsert by `(channel_key, external_id)`, idempotent — re-posting the same
  order updates it. Never delete; source-canceled orders become `canceled`.
- The source is authoritative for buyer/pricing/line-item fields; this app is
  authoritative for `status`, item states, and print links. A sync must never
  clobber operator-entered state.
- Store the raw payload on each sync for debugging mapping issues —
  especially valuable for scraped/parsed channels where mapping bugs are
  likely.

## Non-goals (v1)

- No pricing/accounting, no shipping-label purchase, no customer messaging.
- No inventory of *finished goods* (print-to-order assumed); if stock-ahead
  becomes real, add a `stock_items` table rather than faking orders.
