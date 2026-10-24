"""Where the raw data comes from: the committed snapshot, or a live Elexon fetch."""
import json
import logging
from datetime import datetime, timezone

import pandas as pd

from app import config, elexon

log = logging.getLogger(__name__)

ACTUALS_FILE = "actuals.csv.gz"
FORECASTS_FILE = "forecasts.csv.gz"
META_FILE = "meta.json"


def save_snapshot(actuals, forecasts, directory=config.SNAPSHOT_DIR):
    directory.mkdir(parents=True, exist_ok=True)
    actuals.to_csv(directory / ACTUALS_FILE, index=False)
    forecasts.to_csv(directory / FORECASTS_FILE, index=False)
    meta = {
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "scope_start": config.SCOPE_START.isoformat(),
        "scope_end": config.SCOPE_END.isoformat(),
        "actual_rows": len(actuals),
        "forecast_rows": len(forecasts),
    }
    (directory / META_FILE).write_text(json.dumps(meta, indent=2) + "\n")


def load_snapshot(directory=config.SNAPSHOT_DIR):
    """Returns (actuals, forecasts) with UTC timestamps, same shape as the elexon fetchers."""
    actuals = pd.read_csv(directory / ACTUALS_FILE)
    forecasts = pd.read_csv(directory / FORECASTS_FILE)
    actuals["startTime"] = pd.to_datetime(actuals["startTime"], utc=True)
    for col in ["publishTime", "startTime"]:
        forecasts[col] = pd.to_datetime(forecasts[col], utc=True)
    return actuals, forecasts


def load_data(source=config.DATA_SOURCE, directory=config.SNAPSHOT_DIR):
    """Returns (actuals, forecasts, source_used).

    snapshot: read the committed files; if they're missing, fall back to a live fetch with a warning.
    live: always fetch from Elexon. If a live fetch fails, the error propagates and the app won't start,
    which is louder and safer than serving an empty dashboard.
    """
    if source == "snapshot":
        try:
            return (*load_snapshot(directory), "snapshot")
        except FileNotFoundError:
            log.warning("Snapshot not found in %s; fetching live from Elexon", directory)
    elif source != "live":
        raise ValueError(f"DATA_SOURCE must be 'snapshot' or 'live', got {source!r}")

    actuals, forecasts = elexon.fetch_scope_data()
    return actuals, forecasts, "live"
