from fastapi.testclient import TestClient

from app.main import app

# Uses the committed snapshot (DATA_SOURCE defaults to "snapshot"), so no network.
client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_meta_reports_snapshot_and_gate():
    body = client.get("/api/meta").json()
    assert body["data_source"] == "snapshot"
    assert body["gate_time"] == "11:00"


def test_forecast_slot_matches_hand_verified_case():
    rows = client.get("/api/forecast", params={"start": "2026-01-15T18:00:00Z", "end": "2026-01-15T19:00:00Z"}).json()
    assert len(rows) == 1
    assert rows[0]["forecast"] == 9053
    assert rows[0]["publishTime"] == "2026-01-14T09:30:00Z"


def test_accuracy_full_scope():
    body = client.get("/api/accuracy").json()
    assert body["hours"] == 744
    assert round(body["bias_mw"]) == 1730


def test_reversed_range_is_rejected():
    assert client.get("/api/accuracy", params={"start": "2026-01-10", "end": "2026-01-05"}).status_code == 400
