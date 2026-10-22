import type { CSSProperties, ReactNode } from 'react'
import type { Task } from '../db/types'
import { WEEK_ORDER, WEEKDAY_LETTERS, WEEKDAY_NAMES } from '../lib/date'
import { TaskGlyph } from './TaskGlyph'

/* ---------- Icône de tâche ---------- */
export function TaskIcon({ task, size = 30 }: { task: Pick<Task, 'icon' | 'color'>; size?: number }) {
  return <TaskGlyph icon={task.icon} color={task.color} size={size} />
}

/* ---------- En-tête de page (grand titre iOS) ---------- */
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
        {eyebrow && <div className="caption">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

/* ---------- Section de liste groupée ---------- */
export function Section({
  title,
  footer,
  children,
  action,
}: {
  title?: ReactNode
  footer?: ReactNode
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="section">
      {(title || action) && (
        <div className="row spread" style={{ paddingRight: 16 }}>
          <div className="group-title">{title}</div>
          {action}
        </div>
      )}
      <div className="group">{children}</div>
      {footer && <div className="group-footer">{footer}</div>}
    </section>
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
    <div className="empty animate-in">
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
  const label = (d: number) => (d === 0 ? 'Aucun' : d < 60 ? `${d} min` : d % 60 ? `${Math.floor(d / 60)}h30` : `${d / 60} h`)
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
            {label(d)}
          </button>
        ))}
      </div>
      <label className="row small muted" style={{ '--gap': '8px' } as CSSProperties}>
        <span>Personnalisé</span>
        <input
          id={`${idPrefix}-custom`}
          className="input"
          style={{ width: 84, padding: '7px 10px', fontSize: 15 }}
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

/* ---------- Niveau de compréhension ---------- */
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
