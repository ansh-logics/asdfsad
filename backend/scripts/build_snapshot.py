"""Re-fetch the scope's data from Elexon and overwrite backend/data/. Run from backend/:

    python -m scripts.build_snapshot
"""
from app import config, data, elexon


def main():
    actuals, forecasts = elexon.fetch_scope_data()
    data.save_snapshot(actuals, forecasts)
    print(f"Wrote {len(actuals)} actual rows and {len(forecasts)} forecast rows to {config.SNAPSHOT_DIR}")


if __name__ == "__main__":
    main()
