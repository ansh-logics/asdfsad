"""Pick the decision-time forecast for each hour and line it up with hourly actuals."""
import pandas as pd

from app import config


def select_decision_forecast(
    forecasts, gate_time=config.GATE_TIME, days_before=config.DAYS_BEFORE, tz=config.LOCAL_TZ
):
    """For each startTime, pick the latest forecast published at or before the decision cutoff.

    Cutoff = gate_time local time, days_before days before the startTime's local delivery date,
    converted to UTC. E.g. a 2026-01-15 18:00 UTC slot -> cutoff 2026-01-14 11:00 GMT = 11:00 UTC;
    a 2025-07-15 18:00 UTC slot -> cutoff 2025-07-14 11:00 BST = 10:00 UTC.
    startTimes with no forecast published before their cutoff are dropped.
    """
    df = forecasts.copy()
    # Build the cutoff on naive local wall-clock time, then attach the zone: this keeps "11:00"
    # meaning 11:00 local on both sides of a clock change (11:00 is never ambiguous or skipped).
    local_date = df["startTime"].dt.tz_convert(tz).dt.tz_localize(None).dt.normalize()
    cutoff_local = local_date - pd.Timedelta(days=days_before) + pd.Timedelta(gate_time + ":00")
    df["cutoff"] = cutoff_local.dt.tz_localize(tz).dt.tz_convert("UTC")

    eligible = df[df["publishTime"] <= df["cutoff"]]
    # sort + drop_duplicates instead of idxmax + .loc: it never looks at the index, so a
    # non-unique index (e.g. from pd.concat of chunks) can't silently produce extra rows.
    return (
        eligible.sort_values(["startTime", "publishTime"])
        .drop_duplicates(subset="startTime", keep="last")
        .reset_index(drop=True)
    )


def hourly_actuals(actuals):
    """Average half-hourly MW into hourly MW (MW is average power, so the mean is exact).

    Hours missing one of their two half-hours are dropped rather than half-averaged.
    """
    hourly = (
        actuals.groupby(actuals["startTime"].dt.floor("h"))["generation"]
        .agg(["mean", "size"])
        .rename_axis("startTime")
        .reset_index()
    )
    return hourly[hourly["size"] == 2].rename(columns={"mean": "actual"})[["startTime", "actual"]]


def build_comparison(forecasts, actuals, start=config.SCOPE_START, end=config.SCOPE_END):
    """One row per hour in [start, end): startTime, forecast, actual, publishTime, horizon_h."""
    decision = select_decision_forecast(forecasts)
    joined = decision.rename(columns={"generation": "forecast"}).merge(
        hourly_actuals(actuals), on="startTime", how="inner", validate="one_to_one"
    )
    joined["horizon_h"] = (joined["startTime"] - joined["publishTime"]).dt.total_seconds() / 3600
    columns = ["startTime", "forecast", "actual", "publishTime", "horizon_h"]
    return filter_range(joined, start, end)[columns]


def filter_range(comparison, start=None, end=None):
    """Rows with start <= startTime < end. Naive datetimes are treated as UTC; None means unbounded."""
    mask = pd.Series(True, index=comparison.index)
    if start is not None:
        mask &= comparison["startTime"] >= _as_utc(start)
    if end is not None:
        mask &= comparison["startTime"] < _as_utc(end)
    return comparison[mask].reset_index(drop=True)


def to_records(comparison):
    """Plain-Python rows (datetime, float) so callers never need to know about pandas."""
    return [
        {
            "startTime": row.startTime.to_pydatetime(),
            "forecast": float(row.forecast),
            "actual": float(row.actual),
            "publishTime": row.publishTime.to_pydatetime(),
            "horizon_h": float(row.horizon_h),
        }
        for row in comparison.itertuples(index=False)
    ]


def _as_utc(ts):
    ts = pd.Timestamp(ts)
    return ts.tz_localize("UTC") if ts.tzinfo is None else ts.tz_convert("UTC")
