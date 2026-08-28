import uuid
from datetime import date, datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

PART_STATUSES = ("pending", "queued", "printing", "printed", "short")
JOB_OUTCOMES = ("dispatched", "printing", "success", "failed", "canceled")
MILESTONES = ("label_printed", "packed", "shipped")


class Channel(Base):
    __tablename__ = "channels"

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(64))
    ingestion: Mapped[str] = mapped_column(String(16), default="manual")
    enabled: Mapped[bool] = mapped_column(default=True)


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    channel_key: Mapped[str] = mapped_column(ForeignKey("channels.key"))
    external_id: Mapped[str | None] = mapped_column(String(128))
    buyer_name: Mapped[str] = mapped_column(String(256))
    buyer_note: Mapped[str | None] = mapped_column(Text)
    canceled: Mapped[bool] = mapped_column(default=False)
    external_status: Mapped[str | None] = mapped_column(String(64))
    ordered_at: Mapped[datetime]
    ship_by: Mapped[date | None]
    total_cents: Mapped[int | None]
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    # Async fulfillment milestones — independent of print progress.
    label_printed_at: Mapped[datetime | None]
    packed_at: Mapped[datetime | None]
    shipped_at: Mapped[datetime | None]

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.created_at"
    )

    def derived_status(self) -> str:
        """Headline status — derived, never stored (docs/orders.md)."""
        if self.canceled:
            return "canceled"
        if self.shipped_at:
            return "shipped"
        if self.packed_at:
            return "packed"
        if self.items and all(i.status == "printed" for i in self.items):
            return "ready_to_ship"
        if any(i.status != "pending" for i in self.items):
            return "in_progress"
        return "new"


class OrderItem(Base, TimestampMixin):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"))
    external_id: Mapped[str | None] = mapped_column(String(128))
    title: Mapped[str] = mapped_column(String(256))
    variant: Mapped[str | None] = mapped_column(String(256))
    quantity: Mapped[int] = mapped_column(default=1)
    personalization: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    bambuddy_archive_id: Mapped[str | None] = mapped_column(String(64))

    order: Mapped[Order] = relationship(back_populates="items")
    jobs: Mapped[list["PrintJob"]] = relationship(
        back_populates="item", order_by="PrintJob.created_at"
    )


class PrintJob(Base, TimestampMixin):
    __tablename__ = "print_jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("order_items.id"))
    bambuddy_job_ref: Mapped[str | None] = mapped_column(String(64))
    bambuddy_printer_id: Mapped[str] = mapped_column(String(64))
    printer_name: Mapped[str] = mapped_column(String(128))
    archive_id: Mapped[str] = mapped_column(String(64))
    plate: Mapped[int | None]
    variance_note: Mapped[str | None] = mapped_column(Text)
    printer_ready_confirmed: Mapped[bool] = mapped_column(default=False)
    ams_confirmed: Mapped[bool] = mapped_column(default=False)
    quantity: Mapped[int] = mapped_column(default=1)
    outcome: Mapped[str] = mapped_column(String(16), default="dispatched")

    item: Mapped[OrderItem | None] = relationship(back_populates="jobs")
