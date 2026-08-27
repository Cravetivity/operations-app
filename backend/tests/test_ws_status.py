from fastapi.testclient import TestClient

from app.main import create_app
from app.services.status import broker


def test_ws_sends_current_snapshot_on_connect() -> None:
    app = create_app()
    snapshot = {"bambuddy": "ok", "printers": [], "updated_at": "t"}
    broker.publish(snapshot)
    # TestClient runs the app without lifespan, so no poller interferes.
    with TestClient(app) as client, client.websocket_connect("/ws/status") as ws:
        assert ws.receive_json() == snapshot
