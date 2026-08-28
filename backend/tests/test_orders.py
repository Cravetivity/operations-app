async def create_order(client, **overrides):
    payload = {
        "buyer_name": "Jamie Buyer",
        "items": [
            {"title": "Dragon Keychain", "variant": "Blue", "quantity": 2},
            {"title": "Phone Stand"},
        ],
        **overrides,
    }
    resp = await client.post("/api/orders", json=payload)
    assert resp.status_code == 201
    return resp.json()


DISPATCH = {
    "archive_id": "a1",
    "printer_id": "1",
    "printer_name": "X1C-01",
    "plate": 2,
    "variance_note": "Sapphire blue instead of default",
    "printer_ready_confirmed": True,
    "ams_confirmed": True,
}


async def test_manual_order_starts_new_and_lists(orders_client) -> None:
    order = await create_order(orders_client)
    assert order["status"] == "new"
    assert [i["status"] for i in order["items"]] == ["pending", "pending"]

    listed = await orders_client.get("/api/orders")
    assert [o["id"] for o in listed.json()] == [order["id"]]


async def test_dispatch_requires_confirmations(orders_client) -> None:
    order = await create_order(orders_client)
    item_id = order["items"][0]["id"]
    resp = await orders_client.post(
        f"/api/order-items/{item_id}/dispatch", json={**DISPATCH, "ams_confirmed": False}
    )
    assert resp.status_code == 422


async def test_dispatch_records_job_and_advances_status(orders_client) -> None:
    order = await create_order(orders_client)
    item_id = order["items"][0]["id"]
    resp = await orders_client.post(f"/api/order-items/{item_id}/dispatch", json=DISPATCH)
    assert resp.status_code == 200
    updated = resp.json()
    item = next(i for i in updated["items"] if i["id"] == item_id)
    assert item["status"] == "queued"
    assert item["bambuddy_archive_id"] == "a1"
    assert item["jobs"][0]["plate"] == 2
    assert item["jobs"][0]["variance_note"] == "Sapphire blue instead of default"
    assert updated["status"] == "in_progress"
    assert orders_client.app.state.bambuddy.print_calls == [
        {"archive_id": "a1", "printer_id": "1", "plate": 2}
    ]


async def test_milestones_are_async_with_printing(orders_client) -> None:
    order = await create_order(orders_client)
    # Label printed before anything is printed — allowed by design.
    resp = await orders_client.post(
        f"/api/orders/{order['id']}/milestone", json={"milestone": "label_printed", "value": True}
    )
    body = resp.json()
    assert body["milestones"]["label_printed"] is not None
    assert body["status"] == "new"  # headline unaffected by the label milestone

    # All parts printed -> ready_to_ship even though only the label is done.
    for item in body["items"]:
        resp = await orders_client.post(
            f"/api/order-items/{item['id']}/status", json={"status": "printed"}
        )
    assert resp.json()["status"] == "ready_to_ship"

    # Shipping wins the headline and closes the order out of the open list.
    resp = await orders_client.post(
        f"/api/orders/{order['id']}/milestone", json={"milestone": "shipped", "value": True}
    )
    assert resp.json()["status"] == "shipped"
    assert (await orders_client.get("/api/orders")).json() == []


async def test_archives_proxy(orders_client) -> None:
    resp = await orders_client.get("/api/archives")
    assert resp.status_code == 200
    assert resp.json()[0]["id"] == "a1"
