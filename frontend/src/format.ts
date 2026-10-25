// All display times are UK local time: that's the clock the trader and the gate live on.
const UK = 'Europe/London'

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const dayMonth = new Intl.DateTimeFormat('en-GB', { timeZone: UK, day: 'numeric', month: 'short' })
const hourMinute = new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const mw = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

export const formatDateTime = (t: string | number | Date) => dateTime.format(new Date(t))
export const formatDay = (t: string | number | Date) => dayMonth.format(new Date(t))
export const formatHourMinute = (t: string | number | Date) => hourMinute.format(new Date(t))
export const ukHour = (t: string | number | Date) => Number(formatHourMinute(t).slice(0, 2))

/** Axis label: the date at UK midnight, otherwise the time of day. */
export const formatAxisTick = (t: number) => (ukHour(t) === 0 ? formatDay(t) : formatHourMinute(t))

/** Tick positions at UK midnights, plus every 6 h when the range is short enough to read them. */
export function timeTicks(times: number[]) {
  if (times.length === 0) return []
  const spanDays = (times[times.length - 1] - times[0]) / 86_400_000
  const step = spanDays <= 4 ? 6 : 24
  return times.filter((t) => ukHour(t) % step === 0 && new Date(t).getUTCMinutes() === 0)
}

export const formatMW =(v: number) => `${mw.format(v)} MW`
export const formatGW = (v: number) => `${(v / 1000).toFixed(1)} GW`

/** "2026-01-02T00:00:00Z" -> "2026-01-02" (UTC date, used by <input type="date">). */
export const toDateInput = (iso: string) => iso.slice(0, 10)

/** Inclusive date inputs -> half-open UTC range [start 00:00, day after end 00:00). */
export function dateInputsToRange(startDate: string, endDate: string) {
  const end = new Date(`${endDate}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start: `${startDate}T00:00:00Z`, end: end.toISOString() }
}

/** Last inclusive date of a half-open range ending at `endExclusive`. */
export function lastDay(endExclusive: string) {
  const d = new Date(endExclusive)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
