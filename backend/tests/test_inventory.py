import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app
from app.schemas.spools import Spool
from app.services import inventory


class StubSpoolman:
    """In-memory stand-in for SpoolmanClient covering the inventory surface."""

    def __init__(self) -> None:
        self.registry: list[str] = ["Rack A1"]
        self.spools: dict[int, dict] = {
            1: {
                "id": 1,
                "location": "Rack A1",
                "filament": {
                    "name": "PLA Basic Black",
                    "material": "PLA",
                    "color_hex": "1A1A1A",
                    "vendor": {"name": "Bambu Lab"},
                },
            },
            2: {"id": 2, "location": "X1C-01 / AMS 2", "filament": {"name": "PETG"}},
        }

    async def get_location_registry(self):
        return list(self.registry)

    async def set_location_registry(self, locations):
        self.registry = list(locations)

    async def list_spools(self):
        return [Spool.from_spoolman(raw, 150.0) for raw in self.spools.values()]

    async def get_spool(self, spool_id):
        return self.spools[spool_id]

    async def set_spool_location(self, spool_id, location):
        self.spools[spool_id]["location"] = location


@pytest.fixture
def stub() -> StubSpoolman:
    return StubSpoolman()


def make_client(stub: StubSpoolman) -> AsyncClient:
    app = create_app()
    app.state.spoolman = stub
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def test_bins_exclude_ams_locations_and_count_spools(stub: StubSpoolman) -> None:
    bins = await inventory.list_bins(stub)
    assert bins == [{"name": "Rack A1", "spool_count": 1}]


async def test_check_in_requires_known_bin_and_sets_location(stub: StubSpoolman) -> None:
    async with make_client(stub) as client:
        missing = await client.post("/api/spools/2/check-in", json={"bin": "Nope"})
        assert missing.status_code == 404

        ok = await client.post("/api/spools/2/check-in", json={"bin": "Rack A1"})
        assert ok.status_code == 200
    assert stub.spools[2]["location"] == "Rack A1"


async def test_check_out_assigns_ams_location(stub: StubSpoolman) -> None:
    async with make_client(stub) as client:
        resp = await client.post(
            "/api/spools/1/check-out", json={"printer_name": "X1C-02", "ams_slot": 3}
        )
    assert resp.status_code == 200
    assert stub.spools[1]["location"] == "X1C-02 / AMS 3"
    assert not inventory.is_bin("X1C-02 / AMS 3")


async def test_create_bin_rejects_slash_and_appends_registry(stub: StubSpoolman) -> None:
    async with make_client(stub) as client:
        bad = await client.post("/api/bins", json={"name": "a/b"})
        assert bad.status_code == 422
        ok = await client.post("/api/bins", json={"name": "Rack Z9"})
        assert ok.status_code == 201
    assert stub.registry == ["Rack A1", "Rack Z9"]


async def test_labels_render_pdf(stub: StubSpoolman) -> None:
    async with make_client(stub) as client:
        spool = await client.get("/api/labels/spool/1")
        bin_ = await client.get("/api/labels/bin/Rack A1")
    for resp in (spool, bin_):
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content.startswith(b"%PDF")


async def test_inventory_endpoints_503_without_spoolman() -> None:
    app = create_app()
    app.state.spoolman = None
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
        resp = await client.get("/api/bins")
    assert resp.status_code == 503
