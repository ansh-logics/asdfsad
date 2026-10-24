"""Accuracy metrics. Pure functions: comparison DataFrame in, plain dict out.

Sign convention everywhere: error = forecast - actual, so positive = wind was over-forecast.
"""
from app import config

P90_SHORTFALL_MEANING = (
    "In 90% of hours, actual wind was no more than this many MW below the decision-time forecast."
)


def accuracy(comparison):
    """MAE, bias and P90 shortfall.

    p90_shortfall_mw is the 90th percentile of (forecast - actual): actual >= forecast - p90 in 90%
    of hours, so it's the extra cover a trader holds against wind under-delivering.
    """
    error = comparison["forecast"] - comparison["actual"]
    if error.empty:
        return {"hours": 0, "mae_mw": None, "bias_mw": None, "p90_shortfall_mw": None}
    return {
        "hours": int(error.size),
        "mae_mw": round(float(error.abs().mean()), 1),
        "bias_mw": round(float(error.mean()), 1),
        "p90_shortfall_mw": round(float(error.quantile(0.9)), 1),
    }


def accuracy_by_hour(comparison, tz=config.LOCAL_TZ):
    """MAE and bias per local hour of day (0-23), for hours present in the data."""
    error = comparison["forecast"] - comparison["actual"]
    hour = comparison["startTime"].dt.tz_convert(tz).dt.hour
    grouped = error.groupby(hour)
    return [
        {
            "hour": int(h),
            "hours": int(e.size),
            "mae_mw": round(float(e.abs().mean()), 1),
            "bias_mw": round(float(e.mean()), 1),
        }
        for h, e in grouped
    ]
