import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react'
import { PageHeader, TaskIcon } from '../../components/ui'
import { usePlan, useSessions, useTaskMap } from '../../db/hooks'
import type { PlanItem } from '../../db/types'
import {
  addDays,
  formatDayLong,
  formatDayMonth,
  formatDuration,
  minutesToTime,
  startOfWeek,
  today,
  weekDates,
  type ISODate,
} from '../../lib/date'
import { AddSlotSheet } from '../planning/AddSlotSheet'
import { SlotSheet } from '../planning/SlotSheet'

export function WeekPage() {
  const [currentDate, setCurrentDate] = useState<ISODate>(today())
  const [addingDate, setAddingDate] = useState<ISODate | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<PlanItem | null>(null)

  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate])
  const days = useMemo(() => weekDates(weekStart), [weekStart])

  const plan = usePlan(days)
  const tasks = useTaskMap()
  const sessions = useSessions({ dates: days })

  const stats = useMemo(() => {
    let plannedMin = 0
    if (plan) {
      for (const d of days) {
        for (const it of plan[d] ?? []) if (it.status !== 'skipped') plannedMin += it.durationMin
      }
    }
    const doneMin = (sessions ?? []).reduce((acc, s) => acc + s.durationMin, 0)
    return { plannedMin, doneMin }
  }, [plan, days, sessions])

  const isCurrentWeek = days.includes(today())

  return (
    <>
      <PageHeader
        eyebrow={`${formatDayMonth(days[0])} – ${formatDayMonth(days[6])}`}
        title="Semaine"
        actions={
          <>
            <button className="icon-btn" onClick={() => setCurrentDate(addDays(weekStart, -7))} aria-label="Semaine précédente" id="week-prev">
              <ChevronLeft size={24} />
            </button>
            {!isCurrentWeek && (
              <button className="btn btn-sm btn-secondary" onClick={() => setCurrentDate(today())} id="week-reset">
                Cette semaine
              </button>
            )}
            <button className="icon-btn" onClick={() => setCurrentDate(addDays(weekStart, 7))} aria-label="Semaine suivante" id="week-next">
              <ChevronRight size={24} />
            </button>
          </>
        }
      />

      <div className="day-progress">
        <span className="small">
          <strong className="tabular">{formatDuration(stats.doneMin)}</strong>
          <span className="muted"> réalisées sur {formatDuration(stats.plannedMin)} planifiées</span>
        </span>
        <div className="bar" style={{ '--p': stats.plannedMin ? Math.min(1, stats.doneMin / stats.plannedMin) : 0 } as CSSProperties}>
          <span />
        </div>
      </div>

      {days.map((dayDate) => {
        const isToday = dayDate === today()
        const items = plan?.[dayDate] ?? []
        const doneMin = (sessions ?? []).filter((s) => s.date === dayDate).reduce((a, s) => a + s.durationMin, 0)

        return (
          <section className="section" key={dayDate} id={`week-col-${dayDate}`}>
            <div className="row spread" style={{ paddingRight: 4 }}>
              <div className="group-title" style={isToday ? { color: 'var(--accent)', fontWeight: 600 } : undefined}>
                {formatDayLong(dayDate)}
                {doneMin > 0 && <span className="tabular"> · {formatDuration(doneMin)} fait</span>}
              </div>
              <button
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                onClick={() => setAddingDate(dayDate)}
                aria-label={`Ajouter un créneau le ${dayDate}`}
                id={`week-add-${dayDate}`}
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="group">
              {items.length === 0 && (
                <div className="cell">
                  <span className="cell-body muted">Aucun créneau</span>
                </div>
              )}
              {items.map((item) => {
                const task = tasks?.get(item.taskId)
                if (!task) return null
                const done = item.status === 'done'
                const skipped = item.status === 'skipped'
                return (
                  <div
                    key={item.key}
                    className={`cell has-icon is-tappable ${skipped ? 'is-skipped' : ''}`}
                    onClick={() => setSelectedSlot(item)}
                    role="button"
                    tabIndex={0}
                    id={`week-slot-${item.key}`}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedSlot(item)}
                  >
                    <TaskIcon task={task} size={34} />
                    <div className="cell-body">
                      <div className="cell-title truncate" style={done || skipped ? { color: 'var(--label-2)' } : undefined}>
                        {task.name}
                      </div>
                      <div className="cell-sub tabular">
                        {minutesToTime(item.startMin)} – {minutesToTime(item.startMin + item.durationMin)} · {formatDuration(item.durationMin)}
                        {skipped ? ' · Sauté' : ''}
                      </div>
                    </div>
                    {done && (
                      <span className="check is-done">
                        <Check size={16} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {addingDate && <AddSlotSheet open onClose={() => setAddingDate(null)} date={addingDate} />}
      {selectedSlot && <SlotSheet item={selectedSlot} onClose={() => setSelectedSlot(null)} />}
    </>
  )
}
