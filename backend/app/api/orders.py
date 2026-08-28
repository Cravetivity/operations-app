import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.services import orders as svc

SessionDep = Annotated[AsyncSession, Depends(get_session)]

router = APIRouter()


def bambuddy_or_503(request: Request):
    client = getattr(request.app.state, "bambuddy", None)
    if client is None:
        raise HTTPException(status_code=503, detail="BamBuddy is not configured")
    return client


class NewItem(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    variant: str | None = None
    quantity: int = Field(default=1, ge=1, le=999)
    personalization: str | None = None


class NewOrder(BaseModel):
    buyer_name: str = Field(min_length=1, max_length=256)
    buyer_note: str | None = None
    ship_by: date | None = None
    items: list[NewItem] = Field(min_length=1)


class Milestone(BaseModel):
    milestone: str
    value: bool


class ItemStatus(BaseModel):
    status: str


class Dispatch(BaseModel):
    archive_id: str
    printer_id: str
    printer_name: str
    plate: int | None = None
    variance_note: str | None = None
    printer_ready_confirmed: bool
    ams_confirmed: bool


@router.get("/api/orders")
async def get_orders(session: SessionDep) -> list[dict]:
    return await svc.list_open_orders(session)


@router.post("/api/orders", status_code=201)
async def post_order(body: NewOrder, session: SessionDep) -> dict:
    return await svc.create_manual_order(
        session,
        buyer_name=body.buyer_name,
        buyer_note=body.buyer_note,
        ship_by=body.ship_by,
        items=[i.model_dump() for i in body.items],
    )


@router.post("/api/orders/{order_id}/milestone")
async def post_milestone(order_id: uuid.UUID, body: Milestone, session: SessionDep) -> dict:
    try:
        return await svc.set_milestone(session, order_id, body.milestone, body.value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/api/order-items/{item_id}/status")
async def post_item_status(item_id: uuid.UUID, body: ItemStatus, session: SessionDep) -> dict:
    try:
        return await svc.set_item_status(session, item_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/api/order-items/{item_id}/dispatch")
async def post_dispatch(
    item_id: uuid.UUID,
    body: Dispatch,
    request: Request,
    session: SessionDep,
) -> dict:
    try:
        return await svc.dispatch_item(
            session,
            bambuddy_or_503(request),
            item_id,
            archive_id=body.archive_id,
            printer_id=body.printer_id,
            printer_name=body.printer_name,
            plate=body.plate,
            variance_note=body.variance_note,
            printer_ready_confirmed=body.printer_ready_confirmed,
            ams_confirmed=body.ams_confirmed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/archives")
async def get_archives(request: Request) -> list[dict]:
    return await bambuddy_or_503(request).list_archives()
