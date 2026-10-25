import pandas as pd

from app import data
from app.metrics import accuracy, accuracy_by_hour
from app.selection import build_comparison


def comparison_from_errors(errors, start="2026-01-15 00:00"):
    times = pd.date_range(start, periods=len(errors), freq="h", tz="UTC")
    return pd.DataFrame({"startTime": times, "forecast": [10000 + e for e in errors], "actual": 10000})


def test_p90_shortfall_matches_its_plain_english_meaning():
    # "In 90% of hours, actual wind was no more than X MW below the decision-time forecast."
    comparison = comparison_from_errors(list(range(-500, 1500, 20)))  # 100 hours
    x = accuracy(comparison)["p90_shortfall_mw"]
    below_by_at_most_x = (comparison["actual"] >= comparison["forecast"] - x).mean()
    assert below_by_at_most_x == 0.9


def test_bias_sign_positive_means_over_forecast():
    assert accuracy(comparison_from_errors([300, 100]))["bias_mw"] == 200
    assert accuracy(comparison_from_errors([-300, -100]))["bias_mw"] == -200


def test_accuracy_by_hour_groups_on_uk_local_hour():
    # 2025-07-15 17:00 UTC is 18:00 BST
    comparison = comparison_from_errors([100, 300], start="2025-07-15 17:00")
    rows = accuracy_by_hour(comparison)
    assert [r["hour"] for r in rows] == [18, 19]
    assert rows[0]["bias_mw"] == 100


def test_snapshot_round_trip(tmp_path):
    actuals = pd.DataFrame({"startTime": [pd.Timestamp("2026-01-15 18:00", tz="UTC")], "generation": [9000]})
    forecasts = pd.DataFrame(
        {
            "publishTime": [pd.Timestamp("2026-01-14 09:30", tz="UTC")],
            "startTime": [pd.Timestamp("2026-01-15 18:00", tz="UTC")],
            "generation": [9053],
        }
    )
    data.save_snapshot(actuals, forecasts, directory=tmp_path)
    loaded_actuals, loaded_forecasts = data.load_snapshot(tmp_path)
    pd.testing.assert_frame_equal(loaded_actuals, actuals, check_dtype=False)
    pd.testing.assert_frame_equal(loaded_forecasts, forecasts, check_dtype=False)


def test_missing_snapshot_falls_back_to_live(tmp_path, monkeypatch):
    sentinel = (pd.DataFrame(), pd.DataFrame())
    monkeypatch.setattr(data.elexon, "fetch_scope_data", lambda: sentinel)
    *_, source = data.load_data("snapshot", directory=tmp_path / "missing")
    assert source == "live"


def test_committed_snapshot_reproduces_notebook_numbers():
    actuals, forecasts, source = data.load_data("snapshot")
    assert source == "snapshot"
    comparison = build_comparison(forecasts, actuals)
    result = accuracy(comparison)
    assert result["hours"] == 744
    assert round(result["mae_mw"]) == 2013
    assert round(result["bias_mw"]) == 1730
