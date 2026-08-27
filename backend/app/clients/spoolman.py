import httpx

from app.config import get_settings


class SpoolmanClient:
    """Thin wrapper over the Spoolman REST API v1 (docs/integrations.md).

    Read-mostly: BamBuddy owns usage decrementing; we write only for manual
    inventory actions.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._client = httpx.AsyncClient(
            base_url=settings.spoolman_url, timeout=httpx.Timeout(10.0)
        )

    async def list_spools(self) -> list[dict]:
        resp = await self._client.get("/api/v1/spool")
        resp.raise_for_status()
        return resp.json()

    async def aclose(self) -> None:
        await self._client.aclose()
