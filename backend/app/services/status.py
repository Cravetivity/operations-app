import asyncio
import contextlib
import logging
from datetime import UTC, datetime
from typing import Any

from app.clients.bambuddy import BamBuddyClient
from app.config import get_settings

logger = logging.getLogger(__name__)


class StatusBroker:
    """Holds the latest printer-wall snapshot and fans it out to websocket
    subscribers. One upstream poller, many tablets."""

    def __init__(self) -> None:
        self.snapshot: dict[str, Any] | None = None
        self._subscribers: set[asyncio.Queue] = set()

    def publish(self, snapshot: dict[str, Any]) -> None:
        self.snapshot = snapshot
        for queue in list(self._subscribers):
            if queue.full():  # slow consumer: drop oldest so latest wins
                with contextlib.suppress(asyncio.QueueEmpty):
                    queue.get_nowait()
            queue.put_nowait(snapshot)

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=4)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)


broker = StatusBroker()


async def poll_bambuddy_forever(client: BamBuddyClient | None = None) -> None:
    """Poll BamBuddy REST status and publish snapshots to the broker.

    BamBuddy's own websocket message format is undocumented; REST polling is
    the reliable baseline. Revisit once verified against the live instance.
    """
    settings = get_settings()
    own_client = client is None
    client = client or BamBuddyClient()
    try:
        while True:
            try:
                wall = await client.get_wall()
                snapshot = {
                    "bambuddy": "ok",
                    "printers": [p.model_dump() for p in wall],
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            except Exception as exc:  # keep polling through outages
                logger.warning("BamBuddy poll failed: %s", exc)
                last_known = (broker.snapshot or {}).get("printers", [])
                snapshot = {
                    "bambuddy": "unreachable",
                    "printers": last_known,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            broker.publish(snapshot)
            await asyncio.sleep(settings.printer_poll_seconds)
    finally:
        if own_client:
            await client.aclose()
