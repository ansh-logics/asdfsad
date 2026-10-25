import { useEffect, useState } from 'react'
import type { Range } from './api'

/**
 * Fetch data for a date range. Results are tagged with the range they were fetched for, so a new
 * range shows loading without resetting state inside the effect, and a slow old response can't
 * overwrite a newer one.
 */
export function useRangeQuery<T>(range: Range, fetcher: (r: Range) => Promise<T>) {
  const [result, setResult] = useState<{ range: Range; data?: T; error?: string } | null>(null)

  useEffect(() => {
    let stale = false
    fetcher(range)
      .then((data) => !stale && setResult({ range, data }))
      .catch((e: Error) => !stale && setResult({ range, error: e.message }))
    return () => {
      stale = true
    }
  }, [range, fetcher])

  const current = result?.range === range ? result : null
  return { data: current?.data ?? null, error: current?.error ?? null }
}
