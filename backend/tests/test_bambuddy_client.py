import httpx

from app.clients.bambuddy import BamBuddyClient

PRINTERS = [
    {"id": 1, "name": "X1C-01", "model": "X1 Carbon"},
    {"id": 2, "name": "P1S-01", "model": "P1S"},
]

STATUS_OK = {
    "connected": True,
    "state": "printing",
    "progress": 42.5,
    "remaining_time": 73,
    "layer_num": 120,
    "total_layers": 300,
    "filename": "benchy.3mf",
    "temperatures": {"nozzle": 220.0, "bed": 55.0},
}


def fake_bambuddy(request: httpx.Request) -> httpx.Response:
    assert request.headers["X-API-Key"] == "k"
    match request.url.path:
        case "/api/v1/printers":
            return httpx.Response(200, json=PRINTERS)
        case "/api/v1/printers/1/status":
            return httpx.Response(200, json=STATUS_OK)
        case "/api/v1/printers/2/status":
            return httpx.Response(500)
    return httpx.Response(404)


async def test_get_wall_merges_status_and_survives_per_printer_failure() -> None:
    client = BamBuddyClient(
        base_url="http://bb", api_key="k", transport=httpx.MockTransport(fake_bambuddy)
    )
    wall = await client.get_wall()
    await client.aclose()

    assert [p.id for p in wall] == [1, 2]
    ok = wall[0]
    assert ok.state == "printing"
    assert ok.progress == 42.5
    assert ok.remaining_time == 73
    assert ok.temperatures.nozzle == 220.0
    # Printer 2's status endpoint failed: still on the wall, marked unreachable.
    failed = wall[1]
    assert failed.name == "P1S-01"
    assert failed.state == "unreachable"
    assert failed.connected is False
