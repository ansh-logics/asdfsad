interface Props {
  start: string
  end: string
  min: string
  max: string
  onChange: (start: string, end: string) => void
}

/** Inclusive start/end delivery dates, limited to the analysis scope. */
export default function DateRangePicker({ start, end, min, max, onChange }: Props) {
  const isFullScope = start === min && end === max
  return (
    <div className="date-range">
      <label>
        From
        <input
          type="date"
          value={start}
          min={min}
          max={end}
          onChange={(e) => e.target.value && onChange(e.target.value, end)}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={end}
          min={start}
          max={max}
          onChange={(e) => e.target.value && onChange(start, e.target.value)}
        />
      </label>
      <button type="button" disabled={isFullScope} onClick={() => onChange(min, max)}>
        Full scope
      </button>
    </div>
  )
}
