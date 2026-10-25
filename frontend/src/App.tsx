import { useEffect, useMemo, useState } from 'react'
import { fetchMeta, type Meta } from './api'
import DateRangePicker from './components/DateRangePicker'
import { dateInputsToRange, lastDay, toDateInput } from './format'
import ForecastScreen from './screens/ForecastScreen'

type Screen = 'forecast' | 'accuracy'

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('forecast')
  const [dates, setDates] = useState<{ start: string; end: string } | null>(null)

  useEffect(() => {
    fetchMeta()
      .then((m) => {
        setMeta(m)
        setDates({ start: toDateInput(m.scope_start), end: lastDay(m.scope_end) })
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const range = useMemo(() => dates && dateInputsToRange(dates.start, dates.end), [dates])

  if (error) return <main className="app"><p className="error">Couldn't reach the API: {error}</p></main>
  if (!meta || !dates || !range) return <main className="app"><p className="muted">Loading…</p></main>

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>UK wind: was the day-ahead forecast right?</h1>
          <p className="gate">
            Decision gate: <strong>{meta.gate_time} UK time</strong>, the day before delivery
          </p>
        </div>
        <nav className="tabs">
          <button className={screen === 'forecast' ? 'active' : ''} onClick={() => setScreen('forecast')}>
            Forecast
          </button>
          <button className={screen === 'accuracy' ? 'active' : ''} onClick={() => setScreen('accuracy')}>
            Accuracy
          </button>
        </nav>
      </header>

      <div className="controls">
        <DateRangePicker
          start={dates.start}
          end={dates.end}
          min={toDateInput(meta.scope_start)}
          max={lastDay(meta.scope_end)}
          onChange={(start, end) => setDates({ start, end })}
        />
        <span className="muted small">Delivery dates · times shown in UK time</span>
      </div>

      {screen === 'forecast' ? (
        <ForecastScreen meta={meta} range={range} />
      ) : (
        <p className="muted">Accuracy screen coming next.</p>
      )}

      <footer className="muted small">
        Data: Elexon BMRS, WINDFOR (forecast) and FUELHH wind (actual), {meta.data_source}.
      </footer>
    </main>
  )
}
