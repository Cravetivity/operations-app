from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import health

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


def create_app() -> FastAPI:
    app = FastAPI(
        title="Cravetivity Operations", docs_url="/api/docs", openapi_url="/api/openapi.json"
    )
    app.include_router(health.router)

    # In the Docker image the built PWA is copied to backend/static and served
    # from the same origin; in development the Vite dev server proxies /api.
    if STATIC_DIR.is_dir():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="pwa")

    return app


app = create_app()
