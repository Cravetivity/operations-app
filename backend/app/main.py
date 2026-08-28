import asyncio
import contextlib
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import dashboard, health, inventory, orders
from app.clients.bambuddy import BamBuddyClient
from app.clients.spoolman import SpoolmanClient
from app.config import get_settings
from app.services.status import poll_bambuddy_forever
from app.ws import status as ws_status

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    poll_task: asyncio.Task | None = None
    if settings.bambuddy_url:
        poll_task = asyncio.create_task(poll_bambuddy_forever())
    app.state.bambuddy = BamBuddyClient() if settings.bambuddy_url else None
    app.state.spoolman = SpoolmanClient() if settings.spoolman_url else None
    try:
        yield
    finally:
        if poll_task is not None:
            poll_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await poll_task
        for client in (app.state.bambuddy, app.state.spoolman):
            if client is not None:
                await client.aclose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Cravetivity Operations",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.include_router(health.router)
    app.include_router(dashboard.router)
    app.include_router(inventory.router)
    app.include_router(orders.router)
    app.include_router(ws_status.router)

    # In the Docker image the built PWA is copied to backend/static and served
    # from the same origin; in development the Vite dev server proxies /api.
    if STATIC_DIR.is_dir():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="pwa")

    return app


app = create_app()
