"""Mock BamBuddy for development (docs/architecture.md, dev harness).

Implements the small slice of the BamBuddy REST API that operations-app
consumes, with deterministic time-based simulation: two printers mid-print,
one cycling print -> finished -> plate-clear -> idle, and one that
periodically raises an HMS error. Stateless — status is a pure function of
the clock, so restarts are harmless.
"""

import os
import time

from fastapi import FastAPI, HTTPException, Request

API_KEY = os.environ.get("MOCK_API_KEY", "test-key")

app = FastAPI(title="Mock BamBuddy")

PRINTERS = [
    {"id": 1, "name": "X1C-01", "model": "X1 Carbon", "cycle_s": 1800, "offset_s": 0},
    {"id": 2, "name": "X1C-02", "model": "X1 Carbon", "cycle_s": 2700, "offset_s": 900},
    {"id": 3, "name": "P1S-01", "model": "P1S", "cycle_s": 1200, "offset_s": 300},
    {"id": 4, "name": "A1-01", "model": "A1", "cycle_s": 600, "offset_s": 0},
]

FILENAMES = ["benchy_x4.3mf", "phone_stand_plate2.3mf", "etsy_keychain_batch.3mf"]


def check_key(request: Request) -> None:
    if request.headers.get("X-API-Key") != API_KEY:
        raise HTTPException(status_code=401, detail="invalid API key")


def simulate(printer: dict) -> dict:
    phase = ((time.time() + printer["offset_s"]) % printer["cycle_s"]) / printer["cycle_s"]
    temps = {"nozzle": 220.0, "nozzle_target": 220.0, "bed": 55.0, "bed_target": 55.0, "chamber": 30.0}
    idle_temps = {"nozzle": 28.0, "nozzle_target": 0.0, "bed": 26.0, "bed_target": 0.0, "chamber": 25.0}
    status = {
        "connected": True,
        "state": "idle",
        "progress": None,
        "remaining_time": None,
        "layer_num": None,
        "total_layers": None,
        "filename": None,
        "temperatures": idle_temps,
        "awaiting_plate_clear": False,
        "hms_errors": [],
    }

    if printer["name"] == "A1-01":
        # Idle 80% of its cycle, then an HMS error to exercise the error UI.
        if phase > 0.8:
            status["state"] = "error"
            status["hms_errors"] = [
                {"code": "0300-0D00-0001-0002", "message": "Front cover fell off"}
            ]
        return status

    if printer["name"] == "P1S-01" and phase > 0.7:
        if phase < 0.9:
            status["state"] = "finished"
            status["awaiting_plate_clear"] = True
            status["temperatures"] = {**idle_temps, "bed": 40.0}
        return status

    # Printing: progress tracks the phase within the printing portion.
    printing_portion = 0.7 if printer["name"] == "P1S-01" else 1.0
    progress = min(phase / printing_portion, 1.0)
    total_layers = 300
    status.update(
        state="printing",
        progress=round(progress * 100, 1),
        remaining_time=max(1, int(printer["cycle_s"] * printing_portion * (1 - progress) / 60)),
        layer_num=int(progress * total_layers),
        total_layers=total_layers,
        filename=FILENAMES[printer["id"] % len(FILENAMES)],
        temperatures=temps,
    )
    return status


@app.get("/api/v1/health")
def health() -> dict:
    return {"status": "ok", "mock": True}


@app.get("/api/v1/printers")
def list_printers(request: Request) -> list[dict]:
    check_key(request)
    return [
        {"id": p["id"], "name": p["name"], "model": p["model"], "ip_address": f"10.0.0.{p['id']}"}
        for p in PRINTERS
    ]


@app.get("/api/v1/printers/{printer_id}/status")
def printer_status(printer_id: int, request: Request) -> dict:
    check_key(request)
    for printer in PRINTERS:
        if printer["id"] == printer_id:
            return simulate(printer)
    raise HTTPException(status_code=404, detail="printer not found")
