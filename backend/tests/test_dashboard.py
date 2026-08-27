from httpx import ASGITransport, AsyncClient

from app.main import create_app
from app.schemas.spools import Spool
from app.services.status import broker


class StubSpoolman:
    def __init__(self, spools=None, fail=False):
        self._spools = spools or []
        self._fail = fail

    async def list_spools(self):
        if self._fail:
            raise RuntimeError("down")
        return self._spools


SNAPSHOT = {"bambuddy": "ok", "printers": [{"id": 1, "name": "X1C-01"}], "updated_at": "t"}


async def request_dashboard(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
        resp = await client.get("/api/dashboard")
    assert resp.status_code == 200
    return resp.json()


async def test_dashboard_aggregates_printers_and_spools() -> None:
    app = create_app()
    broker.publish(SNAPSHOT)
    spool = Spool(id=1, filament_name="PLA Black", remaining_weight=100.0, low=True)
    app.state.spoolman = StubSpoolman([spool])

    body = await request_dashboard(app)
    assert body["bambuddy"] == "ok"
    assert body["printers"][0]["name"] == "X1C-01"
    assert body["spoolman"] == "ok"
    assert body["low_stock_count"] == 1


async def test_dashboard_degrades_when_upstreams_missing_or_down() -> None:
    app = create_app()
    broker.snapshot = None
    app.state.spoolman = StubSpoolman(fail=True)

    body = await request_dashboard(app)
    assert body["bambuddy"] == "unconfigured"
    assert body["printers"] == []
    assert body["spoolman"] == "unreachable"
    assert body["spools"] == []
