"""Bin registry and spool check-in/check-out on top of Spoolman.

Decision (see docs/architecture.md, Inventory & labels): Spoolman is the
source of truth. Bins are entries in Spoolman's `locations` setting — the
same list its own UI shows as lanes — and a spool's assignment is just its
`location` string. Printer/AMS assignments use the parseable convention
"<printer name> / AMS <slot>", which shows up as a per-printer lane in
Spoolman's UI. No inventory state lives in our database.
"""

import re

from app.clients.spoolman import SpoolmanClient

AMS_LOCATION_RE = re.compile(r"^(?P<printer>.+) / AMS (?P<slot>\d)$")


def ams_location(printer_name: str, slot: int) -> str:
    return f"{printer_name} / AMS {slot}"


def is_bin(location: str) -> bool:
    return not AMS_LOCATION_RE.match(location)


async def list_bins(spoolman: SpoolmanClient) -> list[dict]:
    """Registry bins plus any bin-shaped location that spools already use,
    with per-bin spool counts."""
    registry = await spoolman.get_location_registry()
    spools = await spoolman.list_spools()
    counts: dict[str, int] = {}
    for spool in spools:
        if spool.location and is_bin(spool.location):
            counts[spool.location] = counts.get(spool.location, 0) + 1
    names = list(dict.fromkeys([*registry, *counts]))
    return [{"name": n, "spool_count": counts.get(n, 0)} for n in names if is_bin(n)]


async def create_bin(spoolman: SpoolmanClient, name: str) -> None:
    registry = await spoolman.get_location_registry()
    if name not in registry:
        await spoolman.set_location_registry([*registry, name])


async def check_in(spoolman: SpoolmanClient, spool_id: int, bin_name: str) -> None:
    """Return a spool to a bin. The bin must already exist."""
    bins = {b["name"] for b in await list_bins(spoolman)}
    if bin_name not in bins:
        raise UnknownBinError(bin_name)
    await spoolman.set_spool_location(spool_id, bin_name)


async def check_out(spoolman: SpoolmanClient, spool_id: int, printer_name: str, slot: int) -> str:
    """Take a spool out of its bin and assign it to a printer AMS slot."""
    location = ams_location(printer_name, slot)
    await spoolman.set_spool_location(spool_id, location)
    return location


class UnknownBinError(Exception):
    def __init__(self, name: str) -> None:
        super().__init__(f"unknown bin: {name}")
        self.name = name
