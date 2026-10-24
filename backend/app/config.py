"""Every assumption the analysis depends on, in one place."""
import os
from pathlib import Path

import pandas as pd

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
REQUEST_TIMEOUT_S = 60

# Brief: "consider data relevant only for purchase decisions to be made in January 2026."
# With a D-1 gate, decisions on 1-31 Jan are for deliveries 2 Jan - 1 Feb.
SCOPE_START = pd.Timestamp("2026-01-02 00:00", tz="UTC")
SCOPE_END = pd.Timestamp("2026-02-02 00:00", tz="UTC")  # exclusive

# Decision cutoff: GATE_TIME UK local time, DAYS_BEFORE days before the delivery date.
GATE_TIME = "11:00"
DAYS_BEFORE = 1
LOCAL_TZ = "Europe/London"

# Longest WINDFOR horizon measured in exploration is 66.5 h; 3 days of lookback covers it.
FORECAST_LOOKBACK = pd.Timedelta(days=3)

FUEL_TYPE = "WIND"

# Committed snapshot of the Elexon data for the scope above (regenerate: python -m scripts.build_snapshot).
# .csv.gz, not .csv: the repo's .gitignore excludes *.csv, and gzip keeps the files small.
SNAPSHOT_DIR = Path(__file__).resolve().parent.parent / "data"

# DATA_SOURCE=snapshot (default) loads the committed files; DATA_SOURCE=live re-fetches from Elexon.
DATA_SOURCE = os.environ.get("DATA_SOURCE", "snapshot")

# Comma-separated origins allowed to call the API (the Vercel URL in production).
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
