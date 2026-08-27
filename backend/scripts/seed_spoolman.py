"""Seed the bundled Spoolman with test inventory for development.

Idempotent: does nothing if any spools already exist.

    cd backend && uv run python scripts/seed_spoolman.py [SPOOLMAN_URL]

Default URL is the compose-published http://localhost:7912.
"""

import sys

import httpx

SEED = [
    ("Bambu Lab", "PLA Basic Black", "PLA", "1A1A1A", 812.0, "Rack A1"),
    ("Bambu Lab", "PLA Basic White", "PLA", "F5F5F0", 430.0, "Rack A2"),
    ("Bambu Lab", "PETG HF Orange", "PETG", "FF6A13", 990.0, "Rack B1"),
    ("Polymaker", "PolyTerra Sapphire", "PLA", "2D6FD2", 120.0, "Rack B2"),  # low stock
    ("Polymaker", "PolyLite Silver", "PETG", "C0C0C5", 655.0, "Rack C1"),
]


def main() -> None:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:7912"
    client = httpx.Client(base_url=base, timeout=10.0)

    if client.get("/api/v1/spool").json():
        print("Spoolman already has spools; nothing to do.")
        return

    vendor_ids = {v["name"]: v["id"] for v in client.get("/api/v1/vendor").json()}
    for vendor, name, material, color, remaining, location in SEED:
        if vendor not in vendor_ids:
            vendor_ids[vendor] = client.post("/api/v1/vendor", json={"name": vendor}).json()["id"]
        filament_resp = client.post(
            "/api/v1/filament",
            json={
                "name": name,
                "vendor_id": vendor_ids[vendor],
                "material": material,
                "color_hex": color,
                "density": 1.24,
                "weight": 1000,
                "spool_weight": 250,
                "diameter": 1.75,
            },
        )
        filament_resp.raise_for_status()
        filament = filament_resp.json()
        client.post(
            "/api/v1/spool",
            json={
                "filament_id": filament["id"],
                "remaining_weight": remaining,
                "location": location,
            },
        ).raise_for_status()
        print(f"seeded {vendor} {name} ({remaining}g @ {location})")


if __name__ == "__main__":
    main()
