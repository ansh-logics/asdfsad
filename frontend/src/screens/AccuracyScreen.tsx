import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchAccuracy, fetchAccuracyByHour, type HourAccuracy, type Meta, type Range } from '../api'
import { formatGW, formatMW } from '../format'
import { takeaway } from '../takeaway'
import { useRangeQuery } from '../useRangeQuery'

interface Props {
  meta: Meta
  range: Range
  scopeNote: string
}

export default function AccuracyScreen({ meta, range, scopeNote }: Props) {
  const acc = useRangeQuery(range, fetchAccuracy)
  const byHour = useRangeQuery(range, fetchAccuracyByHour)
  const error = acc.error ?? byHour.error

  if (error) return <p className="error">Couldn't load accuracy: {error}</p>
  if (!acc.data || !byHour.data) return <p className="muted">Loading…</p>
  if (acc.data.hours === 0) return <p className="muted">No hours in this range.</p>

  const a = acc.data
  const message = takeaway(meta.gate_time, a, byHour.data)

  return (
    <section>
      {message && (
        <div className="takeaway">
          <p className="takeaway-headline">{message.headline}</p>
          <p className="takeaway-margin">{message.margin}</p>
          <p className="muted small">{scopeNote}</p>
        </div>
      )}

      <div className="kpis">
        <Kpi
          label="Average bias"
          value={signedGW(a.bias_mw!)}
          explain={`On average the ${meta.gate_time} forecast was this much ${
            a.bias_mw! >= 0 ? 'above' : 'below'
          } actual wind.`}
        />
        <Kpi
          label="P90 shortfall"
          value={formatGW(a.p90_shortfall_mw!)}
          explain={`In 90% of hours, actual wind was no more than ${formatGW(
            a.p90_shortfall_mw!,
          )} below the decision-time forecast.`}
        />
        <Kpi
          label="Mean absolute error"
          value={formatGW(a.mae_mw!)}
          explain="Typical size of the miss in an hour, in either direction."
        />
      </div>

      <div className="chart-card">
        <h3>Average over-forecast by hour of day</h3>
        <p className="muted small">
          Forecast minus actual, averaged across {a.hours} hours. Each bar is the hour starting at that time, UK
          time (03 = 03:00–04:00). Axis starts at 0; dashed line = overall average.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byHour.data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="hour" tickFormatter={(h: number) => `${String(h).padStart(2, '0')}`} stroke="var(--muted)" />
            {/* Baseline pinned at 0 (or below, if any hour under-forecasts) so bar heights aren't exaggerated. */}
            <YAxis
              domain={[(min: number) => Math.min(0, min), 'auto']}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(1)} GW`}
              stroke="var(--muted)"
              width={60}
            />
            <Tooltip content={<HourTooltip />} cursor={{ fill: 'var(--grid)' }} />
            <ReferenceLine y={a.bias_mw!} stroke="var(--muted)" strokeDasharray="4 4" />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Bar dataKey="bias_mw" isAnimationActive={false} radius={[3, 3, 0, 0]}>
              {byHour.data.map((h) => (
                <Cell key={h.hour} fill={h.bias_mw >= 0 ? 'var(--over)' : 'var(--under)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

const signedGW = (mw: number) => `${mw >= 0 ? '+' : '−'}${formatGW(Math.abs(mw))}`

function Kpi({ label, value, explain }: { label: string; value: string; explain: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-explain">{explain}</div>
    </div>
  )
}

function HourTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: HourAccuracy }> }) {
  if (!active || !payload?.length) return null
  const h = payload[0].payload
  const start = `${String(h.hour).padStart(2, '0')}:00`
  const end = `${String((h.hour + 1) % 24).padStart(2, '0')}:00`
  return (
    <div className="tooltip">
      <div className="tooltip-title">
        {start}–{end} UK time
      </div>
      <div className={h.bias_mw >= 0 ? 'over' : 'under'}>
        {h.bias_mw >= 0 ? 'Over' : 'Under'}-forecast by {formatMW(Math.abs(h.bias_mw))} on average
      </div>
      <div className="muted">
        Mean absolute error {formatMW(h.mae_mw)} · {h.hours} hours
      </div>
    </div>
  )
}
