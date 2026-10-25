import pandas as pd
import pytest

from app.metrics import accuracy
from app.selection import build_comparison, hourly_actuals, select_decision_forecast

SLOT = pd.Timestamp("2026-01-15 18:00", tz="UTC")


def utc(s):
    return pd.Timestamp(s, tz="UTC")


@pytest.fixture
def slot_forecasts():
    """Rows 9-12 and 22 of the real 2026-01-15 18:00 table from exploration."""
    return pd.DataFrame(
        {
            "publishTime": [
                utc("2026-01-14 04:30"),
                utc("2026-01-14 07:30"),
                utc("2026-01-14 09:30"),
                utc("2026-01-14 11:30"),
                utc("2026-01-15 18:30"),  # published after delivery started
            ],
            "startTime": [SLOT] * 5,
            "generation": [8962, 8962, 9053, 9151, 8362],
        }
    )


def test_picks_latest_forecast_at_or_before_gate(slot_forecasts):
    picked = select_decision_forecast(slot_forecasts, gate_time="11:00")
    assert len(picked) == 1
    assert picked.loc[0, "publishTime"] == utc("2026-01-14 09:30")
    assert picked.loc[0, "generation"] == 9053


def test_earlier_gate_moves_pick_back(slot_forecasts):
    picked = select_decision_forecast(slot_forecasts, gate_time="09:20")
    assert picked.loc[0, "publishTime"] == utc("2026-01-14 07:30")
    assert picked.loc[0, "generation"] == 8962


def test_publish_exactly_at_cutoff_is_eligible(slot_forecasts):
    picked = select_decision_forecast(slot_forecasts, gate_time="09:30")
    assert picked.loc[0, "generation"] == 9053


def test_non_unique_index_does_not_add_rows(slot_forecasts):
    shuffled = slot_forecasts.iloc[::-1].copy()
    shuffled.index = [0, 0, 1, 1, 0]
    picked = select_decision_forecast(shuffled, gate_time="11:00")
    assert len(picked) == 1
    assert picked.loc[0, "generation"] == 9053


def test_summer_cutoff_is_11_bst():
    forecasts = pd.DataFrame(
        {
            "publishTime": [utc("2025-07-14 09:59"), utc("2025-07-14 10:30")],
            "startTime": [utc("2025-07-15 18:00")] * 2,
            "generation": [1, 2],
        }
    )
    picked = select_decision_forecast(forecasts)
    assert picked.loc[0, "cutoff"] == utc("2025-07-14 10:00")
    assert picked.loc[0, "generation"] == 1  # 10:30 UTC is 11:30 BST, after the gate


def test_slot_with_no_forecast_before_cutoff_is_dropped(slot_forecasts):
    late_only = slot_forecasts[slot_forecasts["publishTime"] > utc("2026-01-14 11:00")]
    assert select_decision_forecast(late_only).empty


def test_hourly_actuals_averages_halves_and_drops_incomplete_hours():
    actuals = pd.DataFrame(
        {
            "startTime": [utc("2026-01-15 18:00"), utc("2026-01-15 18:30"), utc("2026-01-15 19:00")],
            "generation": [9000, 9100, 9200],
        }
    )
    hourly = hourly_actuals(actuals)
    assert hourly["startTime"].tolist() == [SLOT]
    assert hourly["actual"].tolist() == [9050]


def test_comparison_and_accuracy_for_the_slot(slot_forecasts):
    actuals = pd.DataFrame(
        {"startTime": [SLOT, SLOT + pd.Timedelta(minutes=30)], "generation": [8000, 8100]}
    )
    comparison = build_comparison(slot_forecasts, actuals, start=SLOT, end=SLOT + pd.Timedelta(hours=1))
    row = comparison.iloc[0]
    assert row["forecast"] == 9053
    assert row["actual"] == 8050
    assert row["horizon_h"] == 32.5

    result = accuracy(comparison)
    assert result["mae_mw"] == 1003
    assert result["bias_mw"] == 1003
