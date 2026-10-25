const API_URL: string | undefined = import.meta.env.VITE_API_URL

export interface Meta {
  scope_start: string
  scope_end: string // exclusive
  gate_time: string
  days_before: number
  timezone: string
  data_source: string
}

export interface ForecastRow {
  startTime: string
  forecast: number
  actual: number
  publishTime: string
  horizon_h: number
}

export interface Accuracy {
  hours: number
  mae_mw: number | null
  bias_mw: number | null
  p90_shortfall_mw: number | null
  p90_shortfall_meaning: string
}

export interface HourAccuracy {
  hour: number
  hours: number
  mae_mw: number
  bias_mw: number
}

/** Half-open UTC range [start, end), as ISO strings. */
export interface Range {
  start: string
  end: string
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL is not set')
  const url = new URL(path, API_URL)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url.pathname}`)
  return res.json() as Promise<T>
}

export const fetchMeta = () => get<Meta>('/api/meta')
export const fetchForecast = (r: Range) => get<ForecastRow[]>('/api/forecast', { ...r })
export const fetchAccuracy = (r: Range) => get<Accuracy>('/api/accuracy', { ...r })
export const fetchAccuracyByHour = (r: Range) => get<HourAccuracy[]>('/api/accuracy/by-hour', { ...r })
