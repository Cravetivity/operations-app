import httpx

from app.config import get_settings


class BamBuddyClient:
    """Thin wrapper over the BamBuddy REST API (docs/integrations.md).

    All BamBuddy access goes through this class — routes and services never
    call httpx directly. Endpoints are filled in during Phase 1 against a
    live instance.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._client = httpx.AsyncClient(
            base_url=settings.bambuddy_url,
            headers={"X-API-Key": settings.bambuddy_api_key},
            timeout=httpx.Timeout(10.0),
        )

    async def ping(self) -> bool:
        try:
            resp = await self._client.get("/api/v1/health")
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    async def aclose(self) -> None:
        await self._client.aclose()
