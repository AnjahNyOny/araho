import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, CalendarPlus, Play, Check, ListChecks, Brain } from 'lucide-react'
import { PageHeader, EmptyState, TaskIcon } from '../../components/ui'
import { useActiveSession, useDayPlan, useNow, useSessions, useTaskMap, useTasks, useNotes } from '../../db/hooks'
import { elapsedMs, startSession } from '../../db/repo'
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

  const [adding, setAdding] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [selected, setSelected] = useState<PlanItem | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

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

  // Index où insérer le repère "Maintenant"
  const nowIndex = isToday && plan ? plan.findIndex((i) => i.startMin + i.durationMin > nowMin) : -1

  const quickStart = async (item: PlanItem) => {
    if (active) {
      navigate('/session')
      return
    }
    await startSession(item.taskId, item)
    navigate('/session')
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
          <button className="icon-btn is-filled" onClick={() => setAdding(true)} aria-label="Ajouter un créneau" id="today-add">
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
            <div
              className="cell animate-in"
              style={{
                background: 'var(--bg-cell)',
                borderRadius: 'var(--r-cell)',
                padding: '12px 16px',
                marginBottom: 16,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                cursor: 'pointer',
              }}
              onClick={() => setReviewOpen(true)}
              id="today-spaced-card"
            >
              <div className="settings-icon" style={{ background: 'var(--sys-purple)' }}>
                <Brain size={16} strokeWidth={2.4} />
              </div>
              <div className="cell-body">
                <div className="cell-title">
                  {dueNotes.length} apprentissage{dueNotes.length > 1 ? 's' : ''} à réviser
                </div>
                <div className="cell-sub">
                  Ancrage mémoriel · ~2 min
                </div>
              </div>
              <span className="chip chip-sm is-active" style={{ fontSize: 13 }}>
                Réviser
              </span>
            </div>
          )}

          <section aria-label="Créneaux du jour">
            {loading ? null : plan.length === 0 ? (
              <EmptyState
                icon={<CalendarPlus size={56} strokeWidth={1.4} />}
                title="Aucun créneau"
                text="Alloue du temps à tes tâches pour structurer ta journée."
                action={
                  <button className="btn btn-primary" onClick={() => setAdding(true)} id="today-empty-add">
                    Ajouter un créneau
                  </button>
                }
              />
            ) : (
              <div className="group animate-in">
                {plan.map((item, idx) => (
                  <Fragment key={item.key}>
                    {idx === nowIndex && <NowMarker min={nowMin} />}
                    <SlotRow
                      item={item}
                      task={tasks.get(item.taskId)!}
                      activeMs={
                        active && item.slot && active.slotId === item.slot.id ? elapsedMs(active, now) : null
                      }
                      paused={!!active?.pausedAt}
                      onOpen={() => setSelected(item)}
                      onStart={() => quickStart(item)}
                    />
                  </Fragment>
                ))}
                {isToday && nowIndex === -1 && <NowMarker min={nowMin} />}
              </div>
            )}
          </section>
        </>
      )}

      <AddSlotSheet open={adding} onClose={() => setAdding(false)} date={date} onNeedTask={() => setCreatingTask(true)} />
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

interface SlotRowProps {
  item: PlanItem
  task: Task
  activeMs: number | null
  paused: boolean
  onOpen: () => void
  onStart: () => void
}

function SlotRow({ item, task, activeMs, paused, onOpen, onStart }: SlotRowProps) {
  const done = item.status === 'done'
  const skipped = item.status === 'skipped'
  const running = activeMs !== null

  const range = `${minutesToTime(item.startMin)} – ${minutesToTime(item.startMin + item.durationMin)}`
  const sub = running
    ? `${paused ? 'En pause' : 'En cours'} · ${formatClock(activeMs)} / ${formatDuration(item.durationMin)}`
    : `${range} · ${formatDuration(item.durationMin)}${skipped ? ' · Sauté' : ''}`

  return (
    <div
      className={`cell has-icon is-tappable ${skipped ? 'is-skipped' : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      id={`slot-${item.key}`}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <TaskIcon task={task} size={34} />
      <div className="cell-body">
        <div className="cell-title truncate" style={skipped || done ? { color: 'var(--label-2)' } : undefined}>
          {task.name}
        </div>
        <div className="cell-sub tabular">{sub}</div>
      </div>
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
          <Play size={12} fill="currentColor" style={{ marginLeft: 1 }} />
        </button>
      )}
    </div>
  )
}

function Onboarding({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty animate-in" style={{ paddingTop: 72 }}>
      <div className="empty-icon" style={{ color: 'var(--accent)' }}>
        <ListChecks size={60} strokeWidth={1.4} />
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 700 }}>Bienvenue sur Araho</h2>
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
