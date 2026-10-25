"""The in-memory dataset every route reads from, built once per process."""
from dataclasses import dataclass
from functools import lru_cache

import pandas as pd

from app import data, selection


@dataclass(frozen=True)
class Store:
    comparison: pd.DataFrame
    data_source: str


@lru_cache(maxsize=1)
def get_store():
    """Load and join the data on first use, then reuse it for the life of the process.

    Lazy rather than tied to app startup because serverless runtimes (Vercel) don't reliably run
    ASGI lifespan events; locally the lifespan hook just calls this early to warm it.
    """
    actuals, forecasts, source = data.load_data()
    return Store(comparison=selection.build_comparison(forecasts, actuals), data_source=source)
