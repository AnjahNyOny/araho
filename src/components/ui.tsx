import type { CSSProperties, ReactNode } from 'react'
import type { Task } from '../db/types'
import { WEEK_ORDER, WEEKDAY_LETTERS, WEEKDAY_NAMES } from '../lib/date'

/* ---------- Icône de tâche (pastille colorée + emoji) ---------- */
export function TaskIcon({ task, size = 40 }: { task: Pick<Task, 'icon' | 'color'>; size?: number }) {
  return (
    <span
      className="task-icon"
      style={{ '--c': task.color, width: size, height: size, fontSize: size * 0.5 } as CSSProperties}
    >
      {task.icon}
    </span>
  )
}

/* ---------- En-tête de page ---------- */
export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="grow">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
      </div>
      {actions && <div className="row" style={{ '--gap': '6px' } as CSSProperties}>{actions}</div>}
    </header>
  )
}

/* ---------- État vide ---------- */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="empty card animate-in">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  )
}

/* ---------- Sélecteur de durée ---------- */
const DURATIONS = [15, 25, 30, 45, 60, 90, 120]

export function DurationPicker({
  value,
  onChange,
  idPrefix,
  allowNone = false,
}: {
  value: number
  onChange: (v: number) => void
  idPrefix: string
  allowNone?: boolean
}) {
  const options = allowNone ? [0, ...DURATIONS] : DURATIONS
  const isCustom = !options.includes(value)
  return (
    <div className="stack" style={{ '--gap': '10px' } as CSSProperties}>
      <div className="chips">
        {options.map((d) => (
          <button
            key={d}
            type="button"
            id={`${idPrefix}-${d}`}
            className="chip"
            aria-pressed={value === d}
            onClick={() => onChange(d)}
          >
            {d === 0 ? 'Aucun' : d < 60 ? `${d} min` : `${d / 60}h`.replace('.5h', 'h30')}
          </button>
        ))}
      </div>
      <label className="row small muted" style={{ '--gap': '8px' } as CSSProperties}>
        <span>Personnalisé</span>
        <input
          id={`${idPrefix}-custom`}
          className="input"
          style={{ width: 90, padding: '8px 10px' }}
          type="number"
          inputMode="numeric"
          min={allowNone ? 0 : 5}
          max={600}
          step={5}
          value={isCustom ? value : ''}
          placeholder={String(value)}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isNaN(n)) onChange(n)
          }}
        />
        <span>min</span>
      </label>
    </div>
  )
}

/* ---------- Sélecteur de jours ---------- */
export function DaysPicker({
  value,
  onChange,
  idPrefix,
}: {
  value: number[]
  onChange: (v: number[]) => void
  idPrefix: string
}) {
  const set = new Set(value)
  const toggle = (d: number) => {
    const next = new Set(set)
    if (next.has(d)) next.delete(d)
    else next.add(d)
    onChange([...next].sort())
  }
  const presets: { label: string; days: number[] }[] = [
    { label: 'Tous les jours', days: [0, 1, 2, 3, 4, 5, 6] },
    { label: 'En semaine', days: [1, 2, 3, 4, 5] },
    { label: 'Aucun', days: [] },
  ]
  return (
    <div className="stack" style={{ '--gap': '10px' } as CSSProperties}>
      <div className="days-picker">
        {WEEK_ORDER.map((d) => (
          <button
            key={d}
            type="button"
            id={`${idPrefix}-day-${d}`}
            className="day-toggle"
            aria-pressed={set.has(d)}
            aria-label={WEEKDAY_NAMES[d]}
            onClick={() => toggle(d)}
          >
            {WEEKDAY_LETTERS[d]}
          </button>
        ))}
      </div>
      <div className="chips">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className="chip chip-sm"
            id={`${idPrefix}-preset-${p.days.length}`}
            onClick={() => onChange(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- Note de confiance ---------- */
export const CONFIDENCE_LABELS = ['', 'Flou', 'Hésitant', 'Correct', 'À l’aise', 'Maîtrisé']

export function ConfidenceDots({ value }: { value: number }) {
  if (!value) return null
  return (
    <span className="conf-dots" title={CONFIDENCE_LABELS[value]}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? 'on' : ''} />
      ))}
    </span>
  )
}
