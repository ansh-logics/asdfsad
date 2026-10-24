"""Thin client for the two Elexon datasets. Returns tidy DataFrames with UTC timestamps."""
import pandas as pd
import requests

from app import config


def fetch_actuals(start, end, fuel_type=config.FUEL_TYPE):
    """Half-hourly actual generation (MW) for one fuel type, for settlement dates start..end inclusive."""
    response = requests.get(
        f"{config.BASE_URL}/datasets/FUELHH/stream",
        params={
            "settlementDateFrom": start,
            "settlementDateTo": end,
            "fuelType": fuel_type,
        },
        timeout=config.REQUEST_TIMEOUT_S,
    )
    response.raise_for_status()

    df = pd.DataFrame(response.json())[["startTime", "generation"]]
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    return df.sort_values("startTime").reset_index(drop=True)


def fetch_forecasts(publish_from, publish_to):
    """All WINDFOR forecasts published between publish_from and publish_to (UTC ISO strings)."""
    response = requests.get(
        f"{config.BASE_URL}/datasets/WINDFOR/stream",
        params={
            "publishDateTimeFrom": publish_from,
            "publishDateTimeTo": publish_to,
        },
        timeout=config.REQUEST_TIMEOUT_S,
    )
    response.raise_for_status()

    df = pd.DataFrame(response.json())[["publishTime", "startTime", "generation"]]
    for col in ["publishTime", "startTime"]:
        df[col] = pd.to_datetime(df[col], utc=True)
    return df.sort_values(["startTime", "publishTime"]).reset_index(drop=True)


def fetch_scope_data():
    """Fetch everything needed for SCOPE_START..SCOPE_END. Returns (actuals, forecasts)."""
    # Settlement dates follow UK local time, so pad by a day either side and let the
    # selection step trim to the exact UTC scope.
    first_day = (config.SCOPE_START - pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    last_day = config.SCOPE_END.strftime("%Y-%m-%d")
    actuals = fetch_actuals(first_day, last_day)

    forecasts = fetch_forecasts(
        (config.SCOPE_START - config.FORECAST_LOOKBACK).isoformat(),
        config.SCOPE_END.isoformat(),
    )
    return actuals, forecasts
