# Cravetivity Operations App

Tablet-first PWA for running day-to-day 3D print farm operations: a
simplified, fast interface over [BamBuddy](https://github.com/maziggy/bambuddy)
(printer/farm control) and [Spoolman](https://github.com/Donkie/Spoolman)
(filament inventory), plus its own order tracking for Etsy, eBay, and other
sales channels.

**Status: greenfield.** No application code yet — see
[docs/roadmap.md](docs/roadmap.md) for the build plan.

- Python (FastAPI) backend · PostgreSQL · React/Vite PWA frontend
- Runs via Docker Compose; BamBuddy and Spoolman are external services
- Primary target: 10" Android tablet, but responsive everywhere

## Documentation

| Doc | Contents |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Conventions and guardrails for humans & agents |
| [docs/architecture.md](docs/architecture.md) | System design, boundaries, data flow |
| [docs/integrations.md](docs/integrations.md) | BamBuddy / Spoolman / Etsy / eBay notes |
| [docs/orders.md](docs/orders.md) | Orders domain model |
| [docs/roadmap.md](docs/roadmap.md) | Phased plan and open decisions |
