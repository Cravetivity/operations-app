"""orders schema

Revision ID: 2a68266b8515
Revises:
Create Date: 2026-08-27
"""

import sqlalchemy as sa

from alembic import op

revision = "2a68266b8515"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "channels",
        sa.Column("key", sa.String(32), primary_key=True),
        sa.Column("display_name", sa.String(64), nullable=False),
        sa.Column("ingestion", sa.String(16), nullable=False, server_default="manual"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "orders",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("channel_key", sa.String(32), sa.ForeignKey("channels.key"), nullable=False),
        sa.Column("external_id", sa.String(128)),
        sa.Column("buyer_name", sa.String(256), nullable=False),
        sa.Column("buyer_note", sa.Text()),
        sa.Column("canceled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("external_status", sa.String(64)),
        sa.Column("ordered_at", sa.DateTime(), nullable=False),
        sa.Column("ship_by", sa.Date()),
        sa.Column("total_cents", sa.Integer()),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("label_printed_at", sa.DateTime()),
        sa.Column("packed_at", sa.DateTime()),
        sa.Column("shipped_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "uq_orders_channel_external",
        "orders",
        ["channel_key", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_id IS NOT NULL"),
    )
    op.create_table(
        "order_items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("external_id", sa.String(128)),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("variant", sa.String(256)),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("personalization", sa.Text()),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("bambuddy_archive_id", sa.String(64)),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "print_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("order_item_id", sa.Uuid(), sa.ForeignKey("order_items.id")),
        sa.Column("bambuddy_job_ref", sa.String(64)),
        sa.Column("bambuddy_printer_id", sa.String(64), nullable=False),
        sa.Column("printer_name", sa.String(128), nullable=False),
        sa.Column("archive_id", sa.String(64), nullable=False),
        sa.Column("plate", sa.Integer()),
        sa.Column("variance_note", sa.Text()),
        sa.Column(
            "printer_ready_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("ams_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("outcome", sa.String(16), nullable=False, server_default="dispatched"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    # Seed the built-in manual channel (channels are data, not enums).
    op.execute(
        "INSERT INTO channels (key, display_name, ingestion, enabled) "
        "VALUES ('manual', 'Manual', 'manual', true)"
    )


def downgrade() -> None:
    op.drop_table("print_jobs")
    op.drop_table("order_items")
    op.drop_index("uq_orders_channel_external", table_name="orders")
    op.drop_table("orders")
    op.drop_table("channels")
