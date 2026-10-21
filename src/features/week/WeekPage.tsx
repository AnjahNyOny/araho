import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Calendar, Repeat } from 'lucide-react'
import { PageHeader, TaskIcon } from '../../components/ui'
import { usePlan, useSessions, useTaskMap } from '../../db/hooks'
import type { PlanItem } from '../../db/types'
import {
  addDays,
  formatDayMonth,
  formatDuration,
  formatWeekday,
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

  const currentWeekStart = useMemo(() => startOfWeek(currentDate), [currentDate])
  const days = useMemo(() => weekDates(currentWeekStart), [currentWeekStart])

  const plan = usePlan(days)
  const tasks = useTaskMap()
  const sessions = useSessions({ dates: days })

  const weekStats = useMemo(() => {
    let plannedMin = 0
    let plannedSlots = 0
    let completedSlots = 0

    if (plan) {
      for (const d of days) {
        const dayItems = plan[d] || []
        for (const it of dayItems) {
          if (it.status !== 'skipped') {
            plannedMin += it.durationMin
            plannedSlots++
            if (it.status === 'done') completedSlots++
          }
        }
      }
    }

    const doneMin = (sessions ?? []).reduce((acc, s) => acc + s.durationMin, 0)
    return { plannedMin, doneMin, plannedSlots, completedSlots }
  }, [plan, days, sessions])

  const isCurrentWeek = days.includes(today())

  return (
    <>
      <PageHeader
        eyebrow="Vue hebdomadaire"
        title={
          <span>
            Semaine du {formatDayMonth(days[0])} au {formatDayMonth(days[6])}
          </span>
        }
        actions={
          <>
            <button
              className="icon-btn"
              onClick={() => setCurrentDate(addDays(currentWeekStart, -7))}
              aria-label="Semaine précédente"
              id="week-prev"
            >
              <ChevronLeft size={20} />
            </button>
            {!isCurrentWeek && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setCurrentDate(today())}
                id="week-reset"
              >
                Aujourd’hui
              </button>
            )}
            <button
              className="icon-btn"
              onClick={() => setCurrentDate(addDays(currentWeekStart, 7))}
              aria-label="Semaine suivante"
              id="week-next"
            >
              <ChevronRight size={20} />
            </button>
          </>
        }
      />

      <section className="card card-pad week-summary animate-in" style={{ marginBottom: 20 }}>
        <div className="row spread" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow">Réalisé</div>
              <div className="display tabular gradient-text" style={{ fontSize: 24, fontWeight: 700 }}>
                {formatDuration(weekStats.doneMin)}
              </div>
            </div>
            <div>
              <div className="eyebrow">Planifié</div>
              <div className="display tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {formatDuration(weekStats.plannedMin)}
              </div>
            </div>
            <div>
              <div className="eyebrow">Créneaux réalisés</div>
              <div className="display tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {weekStats.completedSlots} / {weekStats.plannedSlots}
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setAddingDate(today())}
            id="week-add-slot-btn"
          >
            <Plus size={16} /> Planifier un créneau
          </button>
        </div>
      </section>

      <div className="week-grid">
        {days.map((dayDate) => {
          const isToday = dayDate === today()
          const dayItems = plan?.[dayDate] ?? []
          const dayDoneMin = (sessions ?? [])
            .filter((s) => s.date === dayDate)
            .reduce((a, s) => a + s.durationMin, 0)

          return (
            <div
              key={dayDate}
              className={`week-day-col card ${isToday ? 'is-today' : ''}`}
              id={`week-col-${dayDate}`}
            >
              <header className="week-day-header">
                <div className="row spread">
                  <div>
                    <span className="week-day-name">{formatWeekday(dayDate)}</span>
                    <span className={`week-day-number ${isToday ? 'is-today-pill' : ''}`}>
                      {dayDate.split('-')[2]}
                    </span>
                  </div>
                  <button
                    className="icon-btn"
                    style={{ width: 28, height: 28 }}
                    onClick={() => setAddingDate(dayDate)}
                    title={`Ajouter un créneau le ${dayDate}`}
                    id={`week-add-${dayDate}`}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {dayDoneMin > 0 && (
                  <div className="tiny faint tabular" style={{ marginTop: 4 }}>
                    {formatDuration(dayDoneMin)} fait
                  </div>
                )}
              </header>

              <div className="week-day-slots">
                {dayItems.length === 0 ? (
                  <div className="week-empty-slot faint tiny">Aucun créneau</div>
                ) : (
                  dayItems.map((item) => {
                    const task = tasks?.get(item.taskId)
                    if (!task) return null
                    const done = item.status === 'done'
                    const skipped = item.status === 'skipped'

                    return (
                      <div
                        key={item.key}
                        className={`week-slot-pill ${done ? 'is-done' : ''} ${skipped ? 'is-skipped' : ''}`}
                        style={{ '--c': task.color } as React.CSSProperties}
                        onClick={() => setSelectedSlot(item)}
                        role="button"
                        tabIndex={0}
                        id={`week-slot-${item.key}`}
                        title={`${task.name} (${minutesToTime(item.startMin)} - ${formatDuration(item.durationMin)})`}
                      >
                        <div className="row" style={{ gap: 6 }}>
                          <TaskIcon task={task} size={22} />
                          <span className="truncate week-slot-title">{task.name}</span>
                        </div>
                        <div className="row spread tiny faint tabular" style={{ marginTop: 4 }}>
                          <span>{minutesToTime(item.startMin)}</span>
                          <span className="row" style={{ gap: 3 }}>
                            {item.recurrence && <Repeat size={10} />}
                            {formatDuration(item.durationMin)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <footer className="week-day-footer">
                <Link to={`/?d=${dayDate}`} className="week-day-link tiny" id={`week-view-day-${dayDate}`}>
                  <Calendar size={12} /> Vue jour
                </Link>
              </footer>
            </div>
          )
        })}
      </div>

      {addingDate && (
        <AddSlotSheet
          open={!!addingDate}
          onClose={() => setAddingDate(null)}
          date={addingDate}
        />
      )}

      {selectedSlot && (
        <SlotSheet
          item={selectedSlot}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </>
  )
}
