import asyncio
import logging

import httpx

from app.config import get_settings
from app.schemas.printers import PrinterStatus

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


class BamBuddyClient:
    """Thin wrapper over the BamBuddy REST API (docs/integrations.md).

    All BamBuddy access goes through this class — routes and services never
    call httpx directly. Endpoint paths follow the published API reference;
    still to be verified against the live instance (see TODO.md).
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        settings = get_settings()
        self._client = httpx.AsyncClient(
            base_url=(base_url if base_url is not None else settings.bambuddy_url) + API_PREFIX,
            headers={"X-API-Key": api_key if api_key is not None else settings.bambuddy_api_key},
            timeout=httpx.Timeout(10.0),
            transport=transport,
        )

    async def ping(self) -> bool:
        try:
            resp = await self._client.get("/health")
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    async def list_printers(self) -> list[dict]:
        resp = await self._client.get("/printers")
        resp.raise_for_status()
        return resp.json()

    async def get_printer_status(self, printer_id: int | str) -> dict:
        resp = await self._client.get(f"/printers/{printer_id}/status")
        resp.raise_for_status()
        return resp.json()

    async def get_wall(self) -> list[PrinterStatus]:
        """Printer list merged with per-printer telemetry.

        A printer whose status call fails still appears on the wall as
        disconnected — one flaky printer must not blank the dashboard.
        """
        printers = await self.list_printers()
        statuses = await asyncio.gather(
            *(self.get_printer_status(p["id"]) for p in printers), return_exceptions=True
        )
        wall: list[PrinterStatus] = []
        for printer, status in zip(printers, statuses, strict=True):
            base = {"id": printer["id"], "name": printer.get("name", f"Printer {printer['id']}")}
            if printer.get("model"):
                base["model"] = printer["model"]
            if isinstance(status, BaseException):
                logger.warning("status fetch failed for printer %s: %s", printer["id"], status)
                wall.append(PrinterStatus(**base, connected=False, state="unreachable"))
            else:
                wall.append(PrinterStatus(**{**status, **base}))
        return wall

    async def aclose(self) -> None:
        await self._client.aclose()
