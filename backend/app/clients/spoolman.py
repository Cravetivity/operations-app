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

    async def aclose(self) -> None:
        await self._client.aclose()
