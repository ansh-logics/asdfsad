"""FastAPI app: routes only. All data logic lives in data / selection / metrics / store."""
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import config, metrics, selection
from app.store import get_store


class ForecastRow(BaseModel):
    startTime: datetime
    forecast: float
    actual: float
    publishTime: datetime
    horizon_h: float


class Accuracy(BaseModel):
    hours: int
    mae_mw: float | None = Field(description="Mean absolute error (MW).")
    bias_mw: float | None = Field(description="Mean of forecast - actual (MW). Positive = over-forecast.")
    p90_shortfall_mw: float | None = Field(description=metrics.P90_SHORTFALL_MEANING)
    p90_shortfall_meaning: str = metrics.P90_SHORTFALL_MEANING


class HourAccuracy(BaseModel):
    hour: int = Field(description="Hour of day, UK local time (0-23).")
    hours: int
    mae_mw: float
    bias_mw: float


class Meta(BaseModel):
    scope_start: datetime
    scope_end: datetime
    gate_time: str
    days_before: int
    timezone: str
    data_source: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Historical, fixed data: load once (committed snapshot by default), serve every request from memory.
    get_store()  # warm the cache at startup where the runtime supports it
    yield


app = FastAPI(title="UK wind forecast vs actual", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET"])


def _comparison(start: datetime | None, end: datetime | None):
    if start is not None and end is not None and start >= end:
        raise HTTPException(status_code=400, detail="start must be before end")
    return selection.filter_range(get_store().comparison, start, end)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta", response_model=Meta)
def meta():
    """The assumptions behind every number: scope, decision gate and data source."""
    return {
        "scope_start": config.SCOPE_START.to_pydatetime(),
        "scope_end": config.SCOPE_END.to_pydatetime(),
        "gate_time": config.GATE_TIME,
        "days_before": config.DAYS_BEFORE,
        "timezone": config.LOCAL_TZ,
        "data_source": get_store().data_source,
    }


@app.get("/api/forecast", response_model=list[ForecastRow])
def forecast(start: datetime | None = None, end: datetime | None = None):
    """Decision-time forecast and hourly actual for each hour in [start, end). Naive times are UTC."""
    return selection.to_records(_comparison(start, end))


@app.get("/api/accuracy", response_model=Accuracy)
def accuracy(start: datetime | None = None, end: datetime | None = None):
    """MAE, bias and P90 shortfall over [start, end). Naive times are UTC."""
    return metrics.accuracy(_comparison(start, end))


@app.get("/api/accuracy/by-hour", response_model=list[HourAccuracy])
def accuracy_by_hour(start: datetime | None = None, end: datetime | None = None):
    """MAE and bias per UK hour of day over [start, end). Naive times are UTC."""
    return metrics.accuracy_by_hour(_comparison(start, end))
