from datetime import date, datetime
from typing import Any, Protocol

from pydantic import BaseModel


class ChannelOrderItem(BaseModel):
    external_id: str | None = None
    title: str
    variant: str | None = None
    quantity: int = 1
    personalization: str | None = None


class ChannelOrder(BaseModel):
    """Normalized order shape every ingestion path produces (see docs/orders.md)."""

    external_id: str
    buyer_name: str
    buyer_note: str | None = None
    ordered_at: datetime
    ship_by: date | None = None
    total_cents: int
    currency: str = "USD"
    external_status: str | None = None
    items: list[ChannelOrderItem]
    raw: dict[str, Any] = {}


class OrderConnector(Protocol):
    """In-process connector for a channel with a documented API (api_poll)."""

    key: str

    async def fetch_orders(self, since: datetime) -> list[ChannelOrder]: ...
