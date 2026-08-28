import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.clients.bambuddy import BamBuddyClient
from app.models.orders import MILESTONES, PART_STATUSES, Order, OrderItem, PrintJob


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)  # DB columns are naive UTC


def serialize_order(order: Order) -> dict:
    return {
        "id": str(order.id),
        "channel": order.channel_key,
        "buyer_name": order.buyer_name,
        "buyer_note": order.buyer_note,
        "status": order.derived_status(),
        "ordered_at": order.ordered_at.isoformat(),
        "ship_by": order.ship_by.isoformat() if order.ship_by else None,
        "milestones": {
            m: getattr(order, f"{m}_at").isoformat() if getattr(order, f"{m}_at") else None
            for m in MILESTONES
        },
        "items": [
            {
                "id": str(item.id),
                "title": item.title,
                "variant": item.variant,
                "quantity": item.quantity,
                "personalization": item.personalization,
                "status": item.status,
                "bambuddy_archive_id": item.bambuddy_archive_id,
                "jobs": [
                    {
                        "id": str(job.id),
                        "printer_name": job.printer_name,
                        "archive_id": job.archive_id,
                        "plate": job.plate,
                        "variance_note": job.variance_note,
                        "outcome": job.outcome,
                    }
                    for job in item.jobs
                ],
            }
            for item in order.items
        ],
    }


_ORDER_LOAD = (selectinload(Order.items).selectinload(OrderItem.jobs),)


async def list_open_orders(session: AsyncSession) -> list[dict]:
    result = await session.scalars(
        select(Order)
        .options(*_ORDER_LOAD)
        .where(Order.canceled.is_(False), Order.shipped_at.is_(None))
        .order_by(Order.ship_by.is_(None), Order.ship_by, Order.ordered_at)
    )
    return [serialize_order(o) for o in result.unique()]


async def create_manual_order(
    session: AsyncSession,
    buyer_name: str,
    items: list[dict],
    buyer_note: str | None = None,
    ship_by: date | None = None,
) -> dict:
    order = Order(
        channel_key="manual",
        buyer_name=buyer_name,
        buyer_note=buyer_note,
        ordered_at=_now(),
        ship_by=ship_by,
        items=[
            OrderItem(
                title=i["title"],
                variant=i.get("variant"),
                quantity=i.get("quantity", 1),
                personalization=i.get("personalization"),
            )
            for i in items
        ],
    )
    session.add(order)
    await session.commit()
    return await get_order(session, order.id)


async def get_order(session: AsyncSession, order_id: uuid.UUID) -> dict:
    order = await session.scalar(select(Order).options(*_ORDER_LOAD).where(Order.id == order_id))
    if order is None:
        raise LookupError("order not found")
    return serialize_order(order)


async def set_milestone(
    session: AsyncSession, order_id: uuid.UUID, milestone: str, value: bool
) -> dict:
    if milestone not in MILESTONES:
        raise ValueError(f"unknown milestone: {milestone}")
    order = await session.get(Order, order_id)
    if order is None:
        raise LookupError("order not found")
    setattr(order, f"{milestone}_at", _now() if value else None)
    await session.commit()
    return await get_order(session, order_id)


async def set_item_status(session: AsyncSession, item_id: uuid.UUID, status: str) -> dict:
    if status not in PART_STATUSES:
        raise ValueError(f"unknown status: {status}")
    item = await session.get(OrderItem, item_id)
    if item is None:
        raise LookupError("order item not found")
    item.status = status
    await session.commit()
    return await get_order(session, item.order_id)


async def dispatch_item(
    session: AsyncSession,
    bambuddy: BamBuddyClient,
    item_id: uuid.UUID,
    *,
    archive_id: str,
    printer_id: str,
    printer_name: str,
    plate: int | None,
    variance_note: str | None,
    printer_ready_confirmed: bool,
    ams_confirmed: bool,
) -> dict:
    """Final wizard step: both confirmations are hard requirements."""
    if not (printer_ready_confirmed and ams_confirmed):
        raise ValueError("printer-ready and AMS confirmations are required before dispatch")
    item = await session.get(OrderItem, item_id)
    if item is None:
        raise LookupError("order item not found")

    result = await bambuddy.print_archive(archive_id, printer_id, plate)

    session.add(
        PrintJob(
            order_item_id=item.id,
            bambuddy_job_ref=str(result.get("job_id", "")) or None,
            bambuddy_printer_id=str(printer_id),
            printer_name=printer_name,
            archive_id=archive_id,
            plate=plate,
            variance_note=variance_note,
            printer_ready_confirmed=True,
            ams_confirmed=True,
        )
    )
    item.status = "queued"
    item.bambuddy_archive_id = archive_id  # remember the mapping for next time
    await session.commit()
    return await get_order(session, item.order_id)
