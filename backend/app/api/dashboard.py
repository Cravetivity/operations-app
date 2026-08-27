from fastapi import APIRouter, Request

from app.services.status import broker

router = APIRouter()


@router.get("/api/dashboard")
async def dashboard(request: Request) -> dict:
    """Single aggregated payload for the tablet: printer wall + spools.

    Degrades per-upstream: an unreachable service is reported, never a 500.
    """
    wall = broker.snapshot or {"bambuddy": "unconfigured", "printers": [], "updated_at": None}

    spoolman_client = getattr(request.app.state, "spoolman", None)
    if spoolman_client is None:
        spoolman, spools = "unconfigured", []
    else:
        try:
            spools = [s.model_dump() for s in await spoolman_client.list_spools()]
            spoolman = "ok"
        except Exception:
            spoolman, spools = "unreachable", []

    return {
        **wall,
        "spoolman": spoolman,
        "spools": spools,
        "low_stock_count": sum(1 for s in spools if s["low"]),
    }
