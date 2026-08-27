from httpx import ASGITransport, AsyncClient

from app.main import create_app


async def test_health_endpoint() -> None:
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    # No database in unit tests; the endpoint must degrade, not fail.
    assert body["database"] in ("ok", "unreachable")
