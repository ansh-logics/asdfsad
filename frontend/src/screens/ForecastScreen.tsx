import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchForecast, type ForecastRow, type Meta, type Range } from '../api'
import { formatAxisTick, formatDateTime, formatMW, timeTicks } from '../format'

interface ChartRow extends ForecastRow {
  t: number
}

interface Props {
  meta: Meta
  range: Range
}

export default function ForecastScreen({ meta, range }: Props) {
  // Results are tagged with the range they were fetched for, so a new range shows "Loading…"
  // without resetting state inside the effect, and a slow old response can't overwrite a newer one.
  const [result, setResult] = useState<{ range: Range; rows?: ChartRow[]; error?: string } | null>(null)

  useEffect(() => {
    let stale = false
    fetchForecast(range)
      .then((data) => {
        if (!stale) setResult({ range, rows: data.map((r) => ({ ...r, t: Date.parse(r.startTime) })) })
      })
      .catch((e: Error) => !stale && setResult({ range, error: e.message }))
    return () => {
      stale = true
    }
  }, [range])

  const current = result?.range === range ? result : null
  const rows = current?.rows ?? null
  const error = current?.error ?? null
  const ticks = useMemo(() => timeTicks(rows?.map((r) => r.t) ?? []), [rows])

  return (
    <section>
      <header className="screen-header">
        <h2>Forecast vs actual wind generation</h2>
        <p className="muted">
          Each point is the forecast a trader could actually have used: the latest one published by{' '}
          {meta.gate_time} UK time the day before delivery. Hover to see when it was published.
        </p>
      </header>

      {error && <p className="error">Couldn't load forecasts: {error}</p>}
      {!error && !rows && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted">No hours in this range.</p>}
      {rows && rows.length > 0 && (
        <div className="chart-card">
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                ticks={ticks}
                tickFormatter={formatAxisTick}
                stroke="var(--muted)"
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)} GW`}
                stroke="var(--muted)"
                width={56}
              />
              <Tooltip content={<ForecastTooltip gateTime={meta.gate_time} />} />
              <Legend />
              <Line
                name={`Forecast at ${meta.gate_time} gate`}
                dataKey="forecast"
                stroke="var(--forecast)"
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                name="Actual"
                dataKey="actual"
                stroke="var(--actual)"
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

interface TooltipProps {
  gateTime: string
  active?: boolean
  payload?: ReadonlyArray<{ payload: ChartRow }>
}

function ForecastTooltip({ gateTime, active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const diff = row.forecast - row.actual
  return (
    <div className="tooltip">
      <div className="tooltip-title">{formatDateTime(row.startTime)} delivery</div>
      <div>
        <span className="swatch" style={{ background: 'var(--forecast)' }} />
        Forecast <strong>{formatMW(row.forecast)}</strong>
      </div>
      <div>
        <span className="swatch" style={{ background: 'var(--actual)' }} />
        Actual <strong>{formatMW(row.actual)}</strong>
      </div>
      <div className={diff >= 0 ? 'over' : 'under'}>
        {diff >= 0 ? 'Over' : 'Under'}-forecast by {formatMW(Math.abs(diff))}
      </div>
      <hr />
      <div className="muted">
        Published {formatDateTime(row.publishTime)}, {row.horizon_h.toFixed(1)} h ahead.
        <br />
        Latest forecast available at the {gateTime} gate.
      </div>
    </div>
  )
}
