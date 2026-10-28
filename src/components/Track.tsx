import { Check } from 'lucide-react'
import type { ChecklistItem, TrackProgress } from '../db/types'
import * as repo from '../db/repo'
import { formatWeekday, parseISODate, type ISODate } from '../lib/date'

/** « Lun 2 » */
function shortDay(d: ISODate): string {
  return `${formatWeekday(d)} ${parseISODate(d).getDate()}`
}

/** « +2 d'avance », « 1 en retard » ou « À jour ». */
function paceLabel(p: Pick<TrackProgress, 'ahead' | 'late'>): string {
  if (p.late > 0) return `${p.late} en retard`
  if (p.ahead > 0) return `+${p.ahead} d’avance`
  return 'À jour'
}

export function PaceTag({ progress }: { progress: Pick<TrackProgress, 'ahead' | 'late'> }) {
  const tone = progress.late > 0 ? 'is-late' : progress.ahead > 0 ? 'is-ahead' : ''
  return <span className={`pace ${tone}`}>{paceLabel(progress)}</span>
}

/** Liste d'éléments cochables ; `today` sert à signaler le retard et l'avance. */
export function TrackItems({ items, today, idPrefix }: { items: ChecklistItem[]; today: ISODate; idPrefix: string }) {
  return (
    <>
      {items.map((it) => {
        const late = !it.checked && !!it.dueDate && it.dueDate < today
        const early = !!it.checked && !!it.dueDate && it.dueDate > today
        return (
          <button
            key={it.id}
            type="button"
            className={`cell track-item ${it.checked ? 'is-checked' : ''}`}
            id={`${idPrefix}-${it.id}`}
            aria-pressed={!!it.checked}
            onClick={() => repo.setChecklistItemChecked(it.id, !it.checked)}
          >
            <span className={`check is-box ${it.checked ? 'is-done' : ''}`}>
              <Check size={16} strokeWidth={3} />
            </span>
            <span className="cell-body">{it.label}</span>
            {it.dueDate && (
              <span className={`track-day ${late ? 'is-late' : early ? 'is-ahead' : ''}`}>{shortDay(it.dueDate)}</span>
            )}
          </button>
        )
      })}
    </>
  )
}
