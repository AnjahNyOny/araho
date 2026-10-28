import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  List,
  CalendarDays,
  Search,
  BarChart3,
  GripVertical,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { useNow, usePlan, useSessions, useTaskMap } from '../../db/hooks'
import { updateOccurrence } from '../../db/repo'
import type { PlanItem } from '../../db/types'
import {
  addDays,
  formatCalendarHeader,
  formatDuration,
  formatMonthName,
  minutesToTime,
  nowMinutes,
  today,
  weekDatesSunday,
  type ISODate,
} from '../../lib/date'
import { checkCollision, getFreeSlots } from '../../lib/scheduling'
import { AddSlotSheet } from '../planning/AddSlotSheet'
import { SlotSheet } from '../planning/SlotSheet'
import { WeeklyReviewSheet } from './WeeklyReviewSheet'
import { TaskIcon } from '../../components/ui'

const TIMELINE_START_HOUR = 5
const TIMELINE_END_HOUR = 23
const HOUR_HEIGHT = 64 // 64px par heure = 32px pour 30min
const TIMELINE_TOP_PAD = 10

const HOURS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
  (_, i) => TIMELINE_START_HOUR + i,
)

interface DragState {
  item: PlanItem
  pointerId: number
  startY: number
  currentY: number
  initialStartMin: number
  currentStartMin: number
  collision: boolean
  collidingItem?: PlanItem
  hasMoved: boolean
}

export function WeekPage() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<ISODate>(today())
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline')
  const [addingSlot, setAddingSlot] = useState<{ date: ISODate; startMin?: number } | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<PlanItem | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [dragState, setDragState] = useState<DragState | null>(null)

  const timelineWrapRef = useRef<HTMLDivElement>(null)

  // 7 jours du dimanche au samedi comme sur le Calendrier iOS
  const weekDays = useMemo(() => weekDatesSunday(selectedDate), [selectedDate])

  const plan = usePlan(weekDays)
  const tasks = useTaskMap()
  const sessions = useSessions({ dates: weekDays })
  const now = useNow(10_000)

  const nowMin = nowMinutes(new Date(now))
  const isToday = selectedDate === today()

  // Items du jour sélectionné
  const currentDayItems = useMemo(() => {
    const list = plan?.[selectedDate] ?? []
    return [...list].sort((a, b) => a.startMin - b.startMin)
  }, [plan, selectedDate])

  // Créneaux libres pour la journée sélectionnée
  const freeSlots = useMemo(() => {
    const dayStartMin = TIMELINE_START_HOUR * 60
    const dayEndMin = (TIMELINE_END_HOUR + 1) * 60
    const activeItems = dragState?.hasMoved
      ? currentDayItems.filter((i) => i.key !== dragState.item.key)
      : currentDayItems
    return getFreeSlots(activeItems, dayStartMin, dayEndMin, 15)
  }, [currentDayItems, dragState?.hasMoved, dragState?.item.key])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, item: PlanItem) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (item.status === 'skipped') return

    const target = e.currentTarget
    try {
      target.setPointerCapture(e.pointerId)
    } catch {}

    setDragState({
      item,
      pointerId: e.pointerId,
      startY: e.clientY,
      currentY: e.clientY,
      initialStartMin: item.startMin,
      currentStartMin: item.startMin,
      collision: false,
      hasMoved: false,
    })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== e.pointerId) return

    const dy = e.clientY - dragState.startY
    const hasMoved = dragState.hasMoved || Math.abs(dy) > 5
    if (!hasMoved) return

    const pxPerMin = HOUR_HEIGHT / 60
    const deltaMin = Math.round((dy / pxPerMin) / 15) * 15
    let targetMin = dragState.initialStartMin + deltaMin

    const minBound = TIMELINE_START_HOUR * 60
    const maxBound = (TIMELINE_END_HOUR + 1) * 60 - dragState.item.durationMin
    targetMin = Math.max(minBound, Math.min(maxBound, targetMin))

    const { collision, collidingItem } = checkCollision(
      targetMin,
      dragState.item.durationMin,
      currentDayItems,
      dragState.item.key,
    )

    if (timelineWrapRef.current) {
      const rect = timelineWrapRef.current.getBoundingClientRect()
      if (e.clientY < rect.top + 70) {
        timelineWrapRef.current.scrollTop -= 10
      } else if (e.clientY > rect.bottom - 70) {
        timelineWrapRef.current.scrollTop += 10
      }
    }

    setDragState((prev) =>
      prev
        ? {
            ...prev,
            currentY: e.clientY,
            currentStartMin: targetMin,
            collision,
            collidingItem,
            hasMoved: true,
          }
        : null,
    )
  }

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== e.pointerId) return

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}

    const drag = dragState
    setDragState(null)

    if (drag.hasMoved) {
      if (drag.currentStartMin !== drag.item.startMin) {
        await updateOccurrence(drag.item, { startMin: drag.currentStartMin })
      }
    } else {
      setSelectedSlot(drag.item)
    }
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
    setDragState(null)
  }

  // Défilement automatique vers l'heure courante au chargement
  useEffect(() => {
    if (viewMode !== 'timeline' || !timelineWrapRef.current) return
    const targetMin = isToday ? nowMin : (currentDayItems[0]?.startMin ?? 8 * 60)
    const targetPx = TIMELINE_TOP_PAD + (targetMin - TIMELINE_START_HOUR * 60) * (HOUR_HEIGHT / 60)
    timelineWrapRef.current.scrollTo({
      top: Math.max(0, targetPx - 100),
      behavior: 'smooth',
    })
  }, [selectedDate, viewMode])

  // Heure actuelle sur la timeline
  const nowTopPx = TIMELINE_TOP_PAD + (nowMin - TIMELINE_START_HOUR * 60) * (HOUR_HEIGHT / 60)
  const showNowLine =
    isToday &&
    nowMin >= TIMELINE_START_HOUR * 60 &&
    nowMin <= (TIMELINE_END_HOUR + 1) * 60

  return (
    <div className="cal-container">
      {/* 1. Barre de navigation supérieure style Apple Calendar */}
      <header className="cal-header">
        <div className="cal-nav">
          <button
            type="button"
            className="cal-month-btn"
            onClick={() => setSelectedDate(addDays(selectedDate, -7))}
            aria-label="Semaine précédente"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
            <span>{formatMonthName(selectedDate)}</span>
          </button>
          <button
            type="button"
            className="cal-action-btn is-sm"
            onClick={() => setSelectedDate(addDays(selectedDate, 7))}
            aria-label="Semaine suivante"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="cal-actions">
          <button
            type="button"
            className={`cal-action-btn ${viewMode === 'list' ? 'is-active' : ''}`}
            onClick={() => setViewMode(viewMode === 'timeline' ? 'list' : 'timeline')}
            aria-label={viewMode === 'timeline' ? 'Vue liste' : 'Vue calendrier'}
            title={viewMode === 'timeline' ? 'Vue liste' : 'Vue calendrier'}
          >
            {viewMode === 'timeline' ? <List size={22} /> : <CalendarDays size={22} />}
          </button>
          <button
            type="button"
            className="cal-action-btn"
            onClick={() => setReviewOpen(true)}
            aria-label="Bilan hebdomadaire"
            title="Bilan de la semaine"
            id="cal-review-btn"
          >
            <BarChart3 size={21} />
          </button>
          <button
            type="button"
            className="cal-action-btn"
            onClick={() => navigate('/journal')}
            aria-label="Rechercher dans le journal"
            title="Rechercher"
          >
            <Search size={21} />
          </button>
          <button
            type="button"
            className="cal-action-btn"
            onClick={() => setAddingSlot({ date: selectedDate, startMin: 9 * 60 })}
            aria-label="Ajouter une tâche"
            id="cal-add-btn"
            title="Ajouter un créneau"
          >
            <Plus size={24} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {/* 2. Bandeau 7 jours de la semaine (D L M M J V S) */}
      <div className="cal-week-strip" role="tablist" aria-label="Jours de la semaine">
        {weekDays.map((dStr, idx) => {
          const isSelected = dStr === selectedDate
          const dayDate = new Date(dStr + 'T12:00:00')
          const dayLetter = ['D', 'L', 'M', 'M', 'J', 'V', 'S'][idx]
          const dayNum = dayDate.getDate()
          const dayItems = plan?.[dStr] ?? []
          const hasSessions = (sessions ?? []).some((s) => s.date === dStr)
          const hasEvents = dayItems.length > 0 || hasSessions

          return (
            <button
              key={dStr}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`cal-day-cell ${isSelected ? 'is-selected' : ''} ${dStr === today() ? 'is-today' : ''}`}
              onClick={() => setSelectedDate(dStr)}
              id={`cal-day-${dStr}`}
            >
              <span className="cal-day-letter">{dayLetter}</span>
              <span className="cal-day-num">{dayNum}</span>
              <span className={`cal-day-dot ${hasEvents ? 'has-events' : ''}`} />
            </button>
          )
        })}
      </div>

      {/* 3. Titre centré du jour sélectionné */}
      <div className="cal-day-title">
        {formatCalendarHeader(selectedDate)}
      </div>

      {/* 4. Vue Timeline horaire ou Vue Liste */}
      {viewMode === 'timeline' ? (
        <div className="cal-timeline-wrap" ref={timelineWrapRef}>
          <div
            className="cal-timeline"
            style={{ height: TIMELINE_TOP_PAD + (TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1) * HOUR_HEIGHT + 40 }}
          >
            {/* Lignes d'heures */}
            {HOURS.map((h) => {
              const startMinutes = h * 60
              return (
                <div
                  key={h}
                  className="cal-hour-row"
                  style={{ top: TIMELINE_TOP_PAD + (h - TIMELINE_START_HOUR) * HOUR_HEIGHT }}
                  onClick={() => setAddingSlot({ date: selectedDate, startMin: startMinutes })}
                  title={`Cliquer pour ajouter à ${String(h).padStart(2, '0')}:00`}
                >
                  <span className="cal-hour-label">{String(h).padStart(2, '0')}:00</span>
                  <div className="cal-hour-line" />
                </div>
              )
            })}

            {/* Ligne rouge temps réel Apple si aujourd'hui */}
            {showNowLine && (
              <div className="cal-now-line" style={{ top: nowTopPx }}>
                <span className="cal-now-badge">{minutesToTime(nowMin)}</span>
              </div>
            )}

            {/* Zones de créneaux libres visibles pendant le déplacement */}
            {dragState?.hasMoved &&
              freeSlots.map((slot, sIdx) => {
                const sTop = TIMELINE_TOP_PAD + (slot.startMin - TIMELINE_START_HOUR * 60) * (HOUR_HEIGHT / 60)
                const sHeight = slot.durationMin * (HOUR_HEIGHT / 60)
                const canFit = slot.durationMin >= (dragState?.item.durationMin ?? 0)
                if (sHeight < 14) return null
                return (
                  <div
                    key={`free-zone-${sIdx}`}
                    className={`cal-free-slot-zone ${canFit ? 'can-fit' : ''}`}
                    style={{ top: sTop, height: sHeight }}
                  >
                    {sHeight >= 24 && (
                      <span className="cal-free-slot-label">
                        Créneau libre ({formatDuration(slot.durationMin)})
                      </span>
                    )}
                  </div>
                )
              })}

            {/* Blocs d'événements positionnés */}
            {currentDayItems.map((item) => {
              const task = tasks?.get(item.taskId)
              if (!task) return null

              const isDraggingThis = dragState?.hasMoved && dragState.item.key === item.key
              const top = TIMELINE_TOP_PAD + (item.startMin - TIMELINE_START_HOUR * 60) * (HOUR_HEIGHT / 60)
              const isCompact = item.durationMin <= 35
              const height = Math.max(isCompact ? 28 : 46, item.durationMin * (HOUR_HEIGHT / 60) - 2)
              const done = item.status === 'done'
              const skipped = item.status === 'skipped'

              return (
                <Fragment key={item.key}>
                  {/* Si l'élément est en train d'être déplacé, afficher un fantôme à sa place originale */}
                  {isDraggingThis && (
                    <div
                      className={`cal-event is-placeholder ${isCompact ? 'is-compact' : 'is-standard'}`}
                      style={
                        {
                          '--c': task.color,
                          top,
                          height,
                        } as CSSProperties
                      }
                    />
                  )}

                  {/* L'élément lui-même (en position normale ou en cours de drag) */}
                  <div
                    className={`cal-event ${isDraggingThis ? 'is-dragging' : ''} ${
                      isCompact ? 'is-compact' : 'is-standard'
                    } ${skipped ? 'is-skipped' : ''}`}
                    style={
                      {
                        '--c': task.color,
                        top: isDraggingThis
                          ? TIMELINE_TOP_PAD +
                            (dragState.currentStartMin - TIMELINE_START_HOUR * 60) * (HOUR_HEIGHT / 60)
                          : top,
                        height,
                      } as CSSProperties
                    }
                    onPointerDown={(e) => handlePointerDown(e, item)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    id={`cal-slot-${item.key}`}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Badge flottant indiquant si le créneau visé est libre ou en collision */}
                    {isDraggingThis && (
                      <div className={`cal-drag-badge ${dragState.collision ? 'is-collision' : 'is-free'}`}>
                        {dragState.collision ? (
                          <>
                            <AlertCircle size={12} strokeWidth={2.5} />
                            <span>
                              {minutesToTime(dragState.currentStartMin)} –{' '}
                              {minutesToTime(dragState.currentStartMin + item.durationMin)} · Chevauchement
                            </span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} strokeWidth={2.5} />
                            <span>
                              {minutesToTime(dragState.currentStartMin)} –{' '}
                              {minutesToTime(dragState.currentStartMin + item.durationMin)} · Créneau libre
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {isCompact ? (
                      <div className="cal-event-row">
                        <span className="cal-event-title truncate">{task.name}</span>
                        <span className="cal-event-bullet">·</span>
                        <span className="cal-event-time">
                          {minutesToTime(
                            isDraggingThis ? dragState.currentStartMin : item.startMin,
                          )}{' '}
                          –{' '}
                          {minutesToTime(
                            (isDraggingThis ? dragState.currentStartMin : item.startMin) +
                              item.durationMin,
                          )}
                        </span>
                        {done && (
                          <span className="cal-event-check">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        )}
                        {!skipped && (
                          <span className="cal-drag-handle" title="Glisser pour déplacer">
                            <GripVertical size={13} />
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="cal-event-stack">
                        <div className="row spread items-start">
                          <span className="cal-event-title truncate">{task.name}</span>
                          <div className="row gap-1">
                            {done && (
                              <span className="cal-event-check">
                                <Check size={14} strokeWidth={3} />
                              </span>
                            )}
                            {!skipped && (
                              <span className="cal-drag-handle" title="Glisser pour déplacer">
                                <GripVertical size={14} />
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="cal-event-time">
                          {minutesToTime(
                            isDraggingThis ? dragState.currentStartMin : item.startMin,
                          )}{' '}
                          –{' '}
                          {minutesToTime(
                            (isDraggingThis ? dragState.currentStartMin : item.startMin) +
                              item.durationMin,
                          )}
                          {skipped ? ' · Sauté' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </Fragment>
              )
            })}
          </div>
        </div>
      ) : (
        /* Vue Liste chronologique */
        <div className="cal-list">
          {currentDayItems.length === 0 ? (
            <div className="empty">
              <p className="muted">Aucune tâche planifiée pour ce jour</p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setAddingSlot({ date: selectedDate, startMin: 9 * 60 })}
              >
                <Plus size={15} /> Ajouter un créneau
              </button>
            </div>
          ) : (
            <div className="group animate-in">
              {currentDayItems.map((item) => {
                const task = tasks?.get(item.taskId)
                if (!task) return null
                const done = item.status === 'done'
                const skipped = item.status === 'skipped'
                return (
                  <div
                    key={item.key}
                    className={`cell has-icon is-tappable ${done ? 'is-done' : ''} ${skipped ? 'is-skipped' : ''}`}
                    onClick={() => setSelectedSlot(item)}
                    role="button"
                    tabIndex={0}
                  >
                    <TaskIcon task={task} size={34} />
                    <div className="cell-body">
                      <div className="cell-title truncate">
                        {task.name}
                      </div>
                      <div className="cell-sub tabular">
                        {minutesToTime(item.startMin)} – {minutesToTime(item.startMin + item.durationMin)} · {formatDuration(item.durationMin)}
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
          )}
        </div>
      )}

      {/* 5. Bouton flottant Aujourd'hui */}
      {!isToday && (
        <button
          type="button"
          className="cal-today-pill"
          onClick={() => setSelectedDate(today())}
          id="cal-today-btn"
        >
          Aujourd’hui
        </button>
      )}

      {/* Modales d'ajout et de détail */}
      {addingSlot && (
        <AddSlotSheet
          open
          onClose={() => setAddingSlot(null)}
          date={addingSlot.date}
          initialStartMin={addingSlot.startMin}
        />
      )}
      {selectedSlot && (
        <SlotSheet
          item={selectedSlot}
          onClose={() => setSelectedSlot(null)}
        />
      )}
      <WeeklyReviewSheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        weekDays={weekDays}
      />
    </div>
  )
}
