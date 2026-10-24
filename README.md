# UK wind forecast vs actual

Compares Elexon's day-ahead wind forecast (WINDFOR) with actual wind generation (FUELHH, `fuelType=WIND`).

## Scope

The brief says: *"consider data relevant only for purchase decisions to be made in January 2026."*

- **Decisions made in January 2026.** With a day-ahead gate at 11:00 UK time on D−1, that covers **deliveries 2 Jan – 1 Feb 2026** (`startTime` 2026-01-02 00:00 UTC up to but not including 2026-02-02 00:00 UTC, 744 hours).
- **Decision forecast:** for each delivery hour, the latest WINDFOR forecast published at or before 11:00 UK time on the day before delivery. The cutoff is computed in `Europe/London` time and converted to UTC.
- **Granularity:** comparisons are hourly. Half-hourly actuals (average MW) are averaged into hourly values to match the hourly forecasts.

## Findings (January 2026 decisions, 744 hours)

| Metric | Value |
|---|---|
| MAE | 2,013 MW |
| Bias (forecast − actual) | **+1,730 MW** |
| P90 shortfall | 4,144 MW |
| Mean actual | 11,284 MW |

**P90 shortfall:** in 90% of hours, actual wind was no more than this many MW below the decision-time forecast. It's the 90th percentile of `forecast − actual`, so positive means over-forecast.

- **For a trader:** the decision-time forecast over-stated wind by about **1.7 GW** on average. Don't take it at face value; plan to buy more.
- **Worst overnight:** the over-forecast averages about 2.3 GW from 03:00 to 05:00 UK time and about 1.2 GW in mid-afternoon.
- **Not an alignment artefact:** shifting the actuals by ±30 min moves the bias by less than 10 MW (1,721–1,739 MW).
- **Hypothesis, not proven:** FUELHH is metered output after wind farms are turned down for grid constraints. WINDFOR appears to forecast what the wind could produce before any turn-down. Curtailment data is outside this project's scope (FUELHH and WINDFOR only), so this can't be confirmed here.

## Data snapshot

The backend doesn't call Elexon on each request. It loads a committed snapshot of the January data from `backend/data/` (about 105 KB).

- **Files:** `actuals.csv.gz` (half-hourly FUELHH wind) and `forecasts.csv.gz` (every WINDFOR publish in the window), plus `meta.json` with the fetch time.
  - They're raw inputs, so the selection rule still runs at startup.
  - They're `.csv.gz` because the root `.gitignore` excludes `*.csv`.
- **Regenerate:** run `cd backend && ../.venv/bin/python -m scripts.build_snapshot`.
- **If the files are missing:** the app logs a warning and fetches live from Elexon. If that also fails, the app won't start.
- **Force a live fetch:** set `DATA_SOURCE=live`.

## Running locally

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt

cd backend
../.venv/bin/python -m pytest              # tests, no network
../.venv/bin/uvicorn app.main:app          # API on :8000, docs at /docs

cd ../frontend
cp .env.example .env.development           # git-ignored; points VITE_API_URL at localhost:8000
npm install
npm run dev                                # UI on :5173
```

If the UI runs on another origin, set `CORS_ORIGINS` (comma-separated) for the backend.

## Deployment

- **Backend:** Heroku (Docker), with `CORS_ORIGINS` set to the Vercel URL.
- **Frontend:** Vercel, with `VITE_API_URL` set to the Heroku URL.

Exploration is in `notebooks/01_explore.ipynb`.
