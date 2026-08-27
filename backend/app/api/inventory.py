from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

from app.services import inventory
from app.services.labels import render_bin_label, render_spool_label

router = APIRouter()


def spoolman_or_503(request: Request):
    client = getattr(request.app.state, "spoolman", None)
    if client is None:
        raise HTTPException(status_code=503, detail="Spoolman is not configured")
    return client


class BinCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        if "/" in v:
            raise ValueError("bin names must not contain '/' (reserved for AMS locations)")
        return v


class CheckIn(BaseModel):
    bin: str


class CheckOut(BaseModel):
    printer_name: str = Field(min_length=1)
    ams_slot: int = Field(ge=1, le=4)


@router.get("/api/bins")
async def get_bins(request: Request) -> list[dict]:
    return await inventory.list_bins(spoolman_or_503(request))


@router.post("/api/bins", status_code=201)
async def post_bin(body: BinCreate, request: Request) -> dict:
    await inventory.create_bin(spoolman_or_503(request), body.name)
    return {"name": body.name}


@router.post("/api/spools/{spool_id}/check-in")
async def post_check_in(spool_id: int, body: CheckIn, request: Request) -> dict:
    try:
        await inventory.check_in(spoolman_or_503(request), spool_id, body.bin)
    except inventory.UnknownBinError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"spool_id": spool_id, "location": body.bin}


@router.post("/api/spools/{spool_id}/check-out")
async def post_check_out(spool_id: int, body: CheckOut, request: Request) -> dict:
    location = await inventory.check_out(
        spoolman_or_503(request), spool_id, body.printer_name, body.ams_slot
    )
    return {"spool_id": spool_id, "location": location}


@router.get("/api/labels/spool/{spool_id}")
async def spool_label(spool_id: int, request: Request) -> Response:
    spool = await spoolman_or_503(request).get_spool(spool_id)
    return Response(
        content=render_spool_label(spool),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="spool-{spool_id}.pdf"'},
    )


@router.get("/api/labels/bin/{name}")
async def bin_label(name: str) -> Response:
    return Response(
        content=render_bin_label(name),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="bin-{name}.pdf"'},
    )
