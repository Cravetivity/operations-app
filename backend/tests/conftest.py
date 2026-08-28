import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db import get_session
from app.main import create_app
from app.models import Base
from app.models.orders import Channel


class StubBamBuddy:
    def __init__(self) -> None:
        self.print_calls: list[dict] = []

    async def list_archives(self):
        return [
            {"id": "a1", "name": "Dragon Keychain", "plates": [{"index": 1}, {"index": 2}]},
        ]

    async def print_archive(self, archive_id, printer_id, plate):
        self.print_calls.append(
            {"archive_id": archive_id, "printer_id": printer_id, "plate": plate}
        )
        return {"job_id": "job-test-1", "status": "queued"}


@pytest.fixture
async def db_sessionmaker():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as session:
        session.add(Channel(key="manual", display_name="Manual"))
        await session.commit()
    yield maker
    await engine.dispose()


@pytest.fixture
async def orders_client(db_sessionmaker):
    app = create_app()
    app.state.bambuddy = StubBamBuddy()
    app.state.spoolman = None

    async def override_session():
        async with db_sessionmaker() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
        client.app = app  # type: ignore[attr-defined]
        yield client
