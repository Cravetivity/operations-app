from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.status import broker

router = APIRouter()


@router.websocket("/ws/status")
async def status_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    queue = broker.subscribe()
    try:
        if broker.snapshot is not None:
            await websocket.send_json(broker.snapshot)
        while True:
            await websocket.send_json(await queue.get())
    except WebSocketDisconnect:
        pass
    finally:
        broker.unsubscribe(queue)
