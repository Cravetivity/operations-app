from pydantic import BaseModel


class Temperatures(BaseModel):
    nozzle: float | None = None
    nozzle_target: float | None = None
    bed: float | None = None
    bed_target: float | None = None
    chamber: float | None = None


class PrinterStatus(BaseModel):
    """One tile on the printer wall. Field names follow the BamBuddy status
    endpoint (docs/integrations.md); remaining_time is minutes."""

    id: int | str
    name: str
    model: str | None = None
    connected: bool = False
    state: str = "unknown"
    progress: float | None = None
    remaining_time: int | None = None
    layer_num: int | None = None
    total_layers: int | None = None
    filename: str | None = None
    temperatures: Temperatures = Temperatures()
    awaiting_plate_clear: bool = False
    hms_errors: list[dict] = []
