import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarPlus,
  Play,
  Check,
  ListChecks,
  Brain,
  FastForward,
} from 'lucide-react'
import { PageHeader, EmptyState, TaskIcon } from '../../components/ui'
import { useActiveSession, useDayPlan, useNow, useSessions, useTaskMap, useTasks, useNotes, useTrackProgress } from '../../db/hooks'
import { elapsedMs, startSession, updateOccurrence } from '../../db/repo'
import type { PlanItem, Task } from '../../db/types'
import {
  addDays,
  formatClock,
  formatDayLong,
  formatDuration,
  minutesToTime,
  nowMinutes,
  relativeDayLabel,
  today,
} from '../../lib/date'
import { getDueNotes } from '../../lib/spacedRepetition'
import { getFreeSlots, postponePlanItem, type FreeSlot } from '../../lib/scheduling'
import { AddSlotSheet } from '../planning/AddSlotSheet'
import { SlotSheet } from '../planning/SlotSheet'
import { TaskFormSheet } from '../tasks/TaskFormSheet'
import { SpacedReviewSheet } from '../journal/SpacedReviewSheet'

export function TodayPage() {
  const [params, setParams] = useSearchParams()
  const date = params.get('d') || today()
  const isToday = date === today()
  const navigate = useNavigate()

  const plan = useDayPlan(date)
  const tasks = useTaskMap()
  const taskList = useTasks()
  const active = useActiveSession()
  const sessions = useSessions({ dates: [date] })
  const allNotes = useNotes()
  const now = useNow(active ? 1000 : 30_000)

  const [addingSlotInfo, setAddingSlotInfo] = useState<{ date: string; startMin?: number } | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [selected, setSelected] = useState<PlanItem | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [draggedKey, setDraggedKey] = useState<string | null>(null)
  const [dragOverSlotStart, setDragOverSlotStart] = useState<number | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const dueNotes = useMemo(() => (allNotes ? getDueNotes(allNotes) : []), [allNotes])

  const setDate = (d: string) => setParams(d === today() ? {} : { d })

  const stats = useMemo(() => {
    const items = (plan ?? []).filter((i) => i.status !== 'skipped')
    const plannedMin = items.reduce((a, i) => a + i.durationMin, 0)
    const doneMin = (sessions ?? []).reduce((a, s) => a + s.durationMin, 0)
    return { plannedMin, doneMin }
  }, [plan, sessions])

  const nowMin = nowMinutes(new Date(now))
  const loading = !plan || !tasks || !taskList

  // Créneaux libres de plus de 20 minutes
  const freeSlots = useMemo(() => {
    if (!plan) return []
    return getFreeSlots(plan, 8 * 60, 22 * 60, 20)
  }, [plan])

  // Filtrer pour n'afficher que les créneaux futurs pour aujourd'hui
  const visibleFreeSlots = useMemo(() => {
    if (!isToday) return freeSlots
    return freeSlots.filter((s) => s.endMin > nowMin)
  }, [freeSlots, isToday, nowMin])

  // Index où insérer le repère "Maintenant"
  const nowIndex = isToday && plan ? plan.findIndex((i) => i.startMin + i.durationMin > nowMin) : -1

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const quickStart = async (item: PlanItem) => {
    if (active) {
      navigate('/session')
      return
    }
    await startSession(item.taskId, item)
    navigate('/session')
  }

  const handleQuickPostpone = async (item: PlanItem) => {
    const res = await postponePlanItem(item, plan ?? [], 'next-free', { isToday, nowMin })
    if (res.success) {
      showToast(res.message)
    } else {
      alert(res.message)
    }
  }

  const handleDropOnFreeSlot = async (e: React.DragEvent, targetSlot: FreeSlot) => {
    e.preventDefault()
    setDragOverSlotStart(null)
    setDraggedKey(null)
    const itemKey = e.dataTransfer.getData('text/plain')
    const item = plan?.find((i) => i.key === itemKey)
    if (item) {
      await updateOccurrence(item, { startMin: targetSlot.startMin })
      showToast(`Décalé à ${minutesToTime(targetSlot.startMin)}`)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="date-nav">
            <button className="date-nav-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent" id="today-prev">
              <ChevronLeft size={16} />
            </button>
            <span>{formatDayLong(date)}</span>
            <button className="date-nav-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Jour suivant" id="today-next">
              <ChevronRight size={16} />
            </button>
            {!isToday && (
              <button className="date-nav-link" onClick={() => setDate(today())} id="today-reset">
                Aujourd’hui
              </button>
            )}
          </span>
        }
        title={isToday ? "Aujourd'hui" : relativeDayLabel(date) === formatDayLong(date) ? 'Planning' : relativeDayLabel(date)}
        actions={
          <button className="icon-btn is-filled" onClick={() => setAddingSlotInfo({ date, startMin: 9 * 60 })} aria-label="Ajouter un créneau" id="today-add">
            <Plus size={22} />
          </button>
        }
      />

      {!loading && taskList.length === 0 ? (
        <Onboarding onCreate={() => setCreatingTask(true)} />
      ) : (
        <>
          {stats.plannedMin > 0 && (
            <div className="day-progress animate-in" aria-label="Progression du jour">
              <p className="small">
                <strong className="tabular">{formatDuration(stats.doneMin)}</strong>
                <span className="muted"> réalisées sur {formatDuration(stats.plannedMin)}</span>
              </p>
              <div className="bar" style={{ '--p': Math.min(1, stats.doneMin / stats.plannedMin) } as CSSProperties}>
                <span />
              </div>
            </div>
          )}

          {isToday && dueNotes.length > 0 && (
            <div className="group callout animate-in">
              <button className="cell" onClick={() => setReviewOpen(true)} id="today-spaced-card">
                <div className="settings-icon">
                  <Brain size={16} strokeWidth={2.2} />
                </div>
                <div className="cell-body">
                  <div className="cell-title">
                    {dueNotes.length} apprentissage{dueNotes.length > 1 ? 's' : ''} à réviser
                  </div>
                  <div className="cell-sub">Ancrage mémoriel · ~2 min</div>
                </div>
                <span className="chip chip-sm is-active">Réviser</span>
              </button>
            </div>
          )}

          <section aria-label="Créneaux du jour">
            {loading ? null : plan.length === 0 ? (
              <EmptyState
                icon={<CalendarPlus size={56} strokeWidth={1.4} />}
                title="Aucun créneau"
                text="Alloue du temps à tes tâches pour structurer ta journée."
                action={
                  <button className="btn btn-primary" onClick={() => setAddingSlotInfo({ date, startMin: 9 * 60 })} id="today-empty-add">
                    Ajouter un créneau
                  </button>
                }
              />
            ) : (
              <div className="group animate-in">
                {/* Créneau libre avant la première tâche */}
                {(() => {
                  const firstFree = visibleFreeSlots.find(
                    (s) => plan.length > 0 && s.endMin <= plan[0].startMin,
                  )
                  if (!firstFree) return null
                  return (
                    <TodayFreeSlot
                      key={`free-before-${firstFree.startMin}`}
                      slot={firstFree}
                      isDragOver={dragOverSlotStart === firstFree.startMin}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOverSlotStart(firstFree.startMin)
                      }}
                      onDragLeave={() => setDragOverSlotStart(null)}
                      onDrop={(e) => handleDropOnFreeSlot(e, firstFree)}
                      onAdd={() => setAddingSlotInfo({ date, startMin: firstFree.startMin })}
                    />
                  )
                })()}

                {plan.map((item, idx) => {
                  const freeAfter = visibleFreeSlots.find(
                    (s) =>
                      s.startMin >= item.startMin + item.durationMin - 5 &&
                      (idx === plan.length - 1 || s.endMin <= plan[idx + 1].startMin + 5),
                  )

                  return (
                    <Fragment key={item.key}>
                      {idx === nowIndex && <NowMarker min={nowMin} />}
                      <SlotRow
                        item={item}
                        task={tasks.get(item.taskId)!}
                        activeMs={
                          active && item.slot && active.slotId === item.slot.id ? elapsedMs(active, now) : null
                        }
                        paused={!!active?.pausedAt}
                        isDragging={draggedKey === item.key}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', item.key)
                          setDraggedKey(item.key)
                        }}
                        onDragEnd={() => {
                          setDraggedKey(null)
                          setDragOverSlotStart(null)
                        }}
                        onOpen={() => setSelected(item)}
                        onStart={() => quickStart(item)}
                        onPostpone={() => handleQuickPostpone(item)}
                      />
                      {freeAfter && (
                        <TodayFreeSlot
                          key={`free-after-${item.key}-${freeAfter.startMin}`}
                          slot={freeAfter}
                          isDragOver={dragOverSlotStart === freeAfter.startMin}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragOverSlotStart(freeAfter.startMin)
                          }}
                          onDragLeave={() => setDragOverSlotStart(null)}
                          onDrop={(e) => handleDropOnFreeSlot(e, freeAfter)}
                          onAdd={() => setAddingSlotInfo({ date, startMin: freeAfter.startMin })}
                        />
                      )}
                    </Fragment>
                  )
                })}
                {isToday && nowIndex === -1 && <NowMarker min={nowMin} />}
              </div>
            )}
          </section>
        </>
      )}

      {toastMessage && (
        <div className="toast" role="status">
          <Check size={14} strokeWidth={2.6} />
          <span>{toastMessage}</span>
        </div>
      )}

      <AddSlotSheet
        open={!!addingSlotInfo}
        onClose={() => setAddingSlotInfo(null)}
        date={addingSlotInfo?.date ?? date}
        initialStartMin={addingSlotInfo?.startMin}
        onNeedTask={() => setCreatingTask(true)}
      />
      <SlotSheet item={selected} onClose={() => setSelected(null)} />
      <TaskFormSheet open={creatingTask} onClose={() => setCreatingTask(false)} />
      {tasks && (
        <SpacedReviewSheet
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          notes={dueNotes}
          tasksMap={tasks}
        />
      )}
    </>
  )
}

function NowMarker({ min }: { min: number }) {
  return (
    <div className="now-marker" aria-label="Maintenant">
      <span className="tabular">{minutesToTime(min)}</span>
      <i />
    </div>
  )
}

interface TodayFreeSlotProps {
  slot: FreeSlot
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onAdd: () => void
}

function TodayFreeSlot({
  slot,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onAdd,
}: TodayFreeSlotProps) {
  return (
    <div
      className={`today-free-slot ${isDragOver ? 'is-drag-over' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onAdd}
      title="Cliquer pour ajouter un créneau ou glisser une tâche ici pour la reporter"
    >
      <div className="today-free-slot-info">
        <span>{isDragOver ? 'Déposer ici' : 'Libre'}</span>
        <span className="today-free-slot-badge">
          {minutesToTime(slot.startMin)} – {minutesToTime(slot.endMin)} · {formatDuration(slot.durationMin)}
        </span>
      </div>
      <button
        type="button"
        className="today-free-slot-action"
        onClick={(e) => {
          e.stopPropagation()
          onAdd()
        }}
      >
        <Plus size={13} strokeWidth={2.4} /> Créneau
      </button>
    </div>
  )
}

interface SlotRowProps {
  item: PlanItem
  task: Task
  activeMs: number | null
  paused: boolean
  isDragging?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onOpen: () => void
  onStart: () => void
  onPostpone?: () => void
}

function SlotRow({
  item,
  task,
  activeMs,
  paused,
  isDragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onStart,
  onPostpone,
}: SlotRowProps) {
  const done = item.status === 'done'
  const skipped = item.status === 'skipped'
  const running = activeMs !== null
  const track = useTrackProgress(task.id, item.date)

  const range = `${minutesToTime(item.startMin)} – ${minutesToTime(item.startMin + item.durationMin)}`
  // Prochain élément du parcours à la place de la durée, quand il y en a un
  const detail = !done && !skipped && track?.next ? track.next.label : formatDuration(item.durationMin)
  const sub = running
    ? `${paused ? 'En pause' : 'En cours'} · ${formatClock(activeMs)} / ${formatDuration(item.durationMin)}`
    : `${range} · ${detail}${skipped ? ' · Sauté' : ''}`

  return (
    <div
      className={`cell has-icon is-tappable ${done ? 'is-done' : ''} ${skipped ? 'is-skipped' : ''} ${isDragging ? 'is-placeholder' : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      id={`slot-${item.key}`}
      draggable={!running && !done && !skipped}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <TaskIcon task={task} size={34} />
      <div className="cell-body">
        <div className="cell-title truncate">
          {task.name}
        </div>
        <div className="cell-sub tabular">{sub}</div>
      </div>
      <div className="slot-actions">
        {!done && !skipped && !running && onPostpone && (
          <button
            type="button"
            className="slot-postpone-btn"
            title="Décaler au prochain créneau libre"
            aria-label="Décaler au prochain créneau libre"
            id={`slot-postpone-${item.key}`}
            onClick={(e) => {
              e.stopPropagation()
              onPostpone()
            }}
          >
            <FastForward size={16} />
          </button>
        )}
        {done ? (
          <span className="check is-done" aria-label="Fait">
            <Check size={16} strokeWidth={3} />
          </span>
        ) : skipped ? null : (
          <button
            className={`check ${running ? 'is-done' : 'is-play'}`}
            aria-label={running ? 'Reprendre' : 'Démarrer'}
            id={`slot-start-${item.key}`}
            onClick={(e) => {
              e.stopPropagation()
              onStart()
            }}
          >
            <Play size={12} fill="currentColor" />
          </button>
        )}
      </div>
    </div>
  )
}

function Onboarding({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty is-tall animate-in">
      <div className="empty-icon is-accent">
        <ListChecks size={60} strokeWidth={1.4} />
      </div>
      <h2>Bienvenue sur Araho</h2>
      <p className="muted">
        Crée une tâche (ex. <strong>Apprendre le JavaScript</strong>), alloue-lui des créneaux, puis note ce que tu
        as appris à la fin de chaque session.
      </p>
      <div className="group onboarding-steps">
        <div className="cell"><span className="step-num">1</span><span className="cell-body">Crée une tâche et son objectif</span></div>
        <div className="cell"><span className="step-num">2</span><span className="cell-body">Démarre la session à l’heure prévue</span></div>
        <div className="cell"><span className="step-num">3</span><span className="cell-body">Note ce que tu as appris</span></div>
      </div>
      <button className="btn btn-primary btn-lg" onClick={onCreate} id="onboarding-create-task">
        <Plus size={18} /> Créer ma première tâche
      </button>
    </div>
  )
}
