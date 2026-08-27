import json

import httpx

from app.config import get_settings
from app.schemas.spools import Spool


class SpoolmanClient:
    """Thin wrapper over the Spoolman REST API v1 (docs/integrations.md).

    Read-mostly: BamBuddy owns usage decrementing; we write only for manual
    inventory actions.
    """

    def __init__(self, base_url: str | None = None) -> None:
        settings = get_settings()
        self._low_threshold = settings.spool_low_stock_grams
        self._client = httpx.AsyncClient(
            base_url=base_url if base_url is not None else settings.spoolman_url,
            timeout=httpx.Timeout(10.0),
        )

    async def list_spools(self) -> list[Spool]:
        resp = await self._client.get("/api/v1/spool", params={"allow_archived": "false"})
        resp.raise_for_status()
        return [Spool.from_spoolman(raw, self._low_threshold) for raw in resp.json()]

    async def get_spool(self, spool_id: int) -> dict:
        resp = await self._client.get(f"/api/v1/spool/{spool_id}")
        resp.raise_for_status()
        return resp.json()

    async def set_spool_location(self, spool_id: int, location: str) -> None:
        resp = await self._client.patch(f"/api/v1/spool/{spool_id}", json={"location": location})
        resp.raise_for_status()

    async def list_used_locations(self) -> list[str]:
        """Distinct location strings currently on spools."""
        resp = await self._client.get("/api/v1/location")
        resp.raise_for_status()
        return resp.json()

    async def get_location_registry(self) -> list[str]:
        """Spoolman's `locations` setting — its UI's persisted lane list.
        This is where bins live (docs/architecture.md, Inventory & labels)."""
        resp = await self._client.get("/api/v1/setting/locations")
        resp.raise_for_status()
        return json.loads(resp.json()["value"] or "[]")

    async def set_location_registry(self, locations: list[str]) -> None:
        resp = await self._client.post("/api/v1/setting/locations", json=json.dumps(locations))
        resp.raise_for_status()

    async def aclose(self) -> None:
        await self._client.aclose()
