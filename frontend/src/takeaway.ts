import type { Accuracy, HourAccuracy } from './api'
import { formatGW } from './format'

const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`

/** The 3-hour window (wrapping past midnight) with the largest average bias in the given direction. */
export function peakWindow(byHour: HourAccuracy[], over: boolean, width = 3) {
  if (byHour.length < 24) return null
  const bias = new Map(byHour.map((h) => [h.hour, h.bias_mw]))
  let best = { start: 0, score: -Infinity }
  for (let start = 0; start < 24; start++) {
    let sum = 0
    for (let i = 0; i < width; i++) sum += bias.get((start + i) % 24) ?? 0
    const score = over ? sum : -sum
    if (score > best.score) best = { start, score }
  }
  const hours = Array.from({ length: width }, (_, i) => (best.start + i) % 24)
  const overnight = hours.every((h) => h >= 22 || h < 7)
  return { label: `${pad(best.start)}–${pad(best.start + width)}`, overnight }
}

/** The one or two sentences a trader should take away, derived from the numbers, never hardcoded. */
export function takeaway(gateTime: string, acc: Accuracy, byHour: HourAccuracy[]) {
  if (acc.bias_mw === null || acc.p90_shortfall_mw === null) return null
  const over = acc.bias_mw >= 0
  const peak = peakWindow(byHour, over)
  const where = peak ? (peak.overnight ? `, most overnight (${peak.label})` : `, most around ${peak.label}`) : ''

  const headline = `The ${gateTime} forecast ${over ? 'over-states' : 'under-states'} wind by about ${formatGW(
    Math.abs(acc.bias_mw),
  )} on average${where}.`

  const margin =
    acc.p90_shortfall_mw > 0
      ? `To be covered 9 hours in 10, plan for up to ${formatGW(acc.p90_shortfall_mw)} less wind than forecast.`
      : 'In 9 hours out of 10, actual wind was at or above the forecast.'

  return { headline, margin }
}
