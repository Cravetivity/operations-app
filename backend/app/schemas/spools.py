from typing import Any

from pydantic import BaseModel


class Spool(BaseModel):
    id: int
    filament_name: str
    vendor: str | None = None
    material: str | None = None
    color_hex: str | None = None
    remaining_weight: float | None = None  # grams
    location: str | None = None
    low: bool = False

    @classmethod
    def from_spoolman(cls, raw: dict[str, Any], low_threshold_grams: float) -> "Spool":
        filament = raw.get("filament") or {}
        vendor = (filament.get("vendor") or {}).get("name")
        remaining = raw.get("remaining_weight")
        return cls(
            id=raw["id"],
            filament_name=filament.get("name") or "Unknown",
            vendor=vendor,
            material=filament.get("material"),
            color_hex=filament.get("color_hex"),
            remaining_weight=remaining,
            location=raw.get("location"),
            low=remaining is not None and remaining < low_threshold_grams,
        )
