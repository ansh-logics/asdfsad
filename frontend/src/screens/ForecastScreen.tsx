import { useMemo } from 'react'
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
import { fetchAccuracy, fetchForecast, type ForecastRow, type Meta, type Range } from '../api'
import { formatAxisTick, formatDateTime, formatGW, formatMW, timeTicks } from '../format'
import { useRangeQuery } from '../useRangeQuery'

interface ChartRow extends ForecastRow {
  t: number
  plan: number | null
}

interface Props {
  meta: Meta
  range: Range
}

export default function ForecastScreen({ meta, range }: Props) {
  const { data, error } = useRangeQuery(range, fetchForecast)
  const accuracy = useRangeQuery(range, fetchAccuracy)
  const p90 = accuracy.data?.p90_shortfall_mw ?? null
  const showPlan = p90 !== null && p90 > 0
  // Plan level = forecast minus the P90 shortfall: the wind a trader plans against to be covered
  // 9 hours in 10. Clamped at 0 because generation can't be negative.
  const rows = useMemo<ChartRow[] | null>(
    () =>
      data &&
      data.map((r) => ({
        ...r,
        t: Date.parse(r.startTime),
        plan: showPlan ? Math.max(0, r.forecast - p90) : null,
      })),
    [data, p90, showPlan],
  )
  const ticks = useMemo(() => timeTicks(rows?.map((r) => r.t) ?? []), [rows])

  return (
    <section>
      <header className="screen-header">
        <h2>Forecast vs actual wind generation</h2>
        <p className="muted">
          Each point is the forecast a trader could actually have used: the latest one published by{' '}
          {meta.gate_time} UK time the day before delivery. Hover to see when it was published.
        </p>
        {showPlan && (
          <p className="muted small">
            Dashed grey line = plan level, forecast − {formatGW(p90)} (the P90 shortfall for the selected
            period). Actual wind stayed above it in 9 hours out of 10. It's measured on the same period, so it
            looks back; it isn't a forecast.
          </p>
        )}
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
              <Tooltip content={<ForecastTooltip gateTime={meta.gate_time} p90={showPlan ? p90 : null} />} />
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
              {showPlan && (
                <Line
                  name={`Plan level (forecast − ${formatGW(p90)}, P90)`}
                  dataKey="plan"
                  stroke="var(--plan)"
                  strokeWidth={1.25}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

interface TooltipProps {
  gateTime: string
  p90: number | null
  active?: boolean
  payload?: ReadonlyArray<{ payload: ChartRow }>
}

function ForecastTooltip({ gateTime, p90, active, payload }: TooltipProps) {
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
      {p90 !== null && row.plan !== null && (
        <div>
          <span className="swatch" style={{ background: 'var(--plan)' }} />
          Plan level <strong>{formatMW(row.plan)}</strong>
        </div>
      )}
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
