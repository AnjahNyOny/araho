import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, CalendarPlus, Play, Check, SkipForward, Repeat, Sparkles } from 'lucide-react'
import { PageHeader, EmptyState, TaskIcon } from '../../components/ui'
import { ProgressRing } from '../../components/ProgressRing'
import { useActiveSession, useDayPlan, useNow, useSessions, useTaskMap, useTasks } from '../../db/hooks'
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
import { AddSlotSheet } from '../planning/AddSlotSheet'
import { SlotSheet } from '../planning/SlotSheet'
import { TaskFormSheet } from '../tasks/TaskFormSheet'

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
  const now = useNow(active ? 1000 : 30_000)

  const [adding, setAdding] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [selected, setSelected] = useState<PlanItem | null>(null)

  const setDate = (d: string) => setParams(d === today() ? {} : { d })

  const stats = useMemo(() => {
    const items = (plan ?? []).filter((i) => i.status !== 'skipped')
    const plannedMin = items.reduce((a, i) => a + i.durationMin, 0)
    const doneMin = (sessions ?? []).reduce((a, s) => a + s.durationMin, 0)
    const doneCount = items.filter((i) => i.status === 'done').length
    return { plannedMin, doneMin, doneCount, count: items.length }
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
        eyebrow={isToday ? formatDayLong(date) : relativeDayLabel(date) === formatDayLong(date) ? 'Planning' : formatDayLong(date)}
        title={
          isToday ? (
            <>
              {greeting()} <span className="gradient-text">✦</span>
            </>
          ) : (
            relativeDayLabel(date)
          )
        }
        actions={
          <>
            <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent" id="today-prev">
              <ChevronLeft size={20} />
            </button>
            {!isToday && (
              <button className="btn btn-sm btn-secondary" onClick={() => setDate(today())} id="today-reset">
                Aujourd’hui
              </button>
            )}
            <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Jour suivant" id="today-next">
              <ChevronRight size={20} />
            </button>
            <button className="btn btn-sm btn-primary desktop-only" onClick={() => setAdding(true)} id="today-add-desktop">
              <Plus size={16} /> Créneau
            </button>
          </>
        }
      />

      {!loading && taskList.length === 0 ? (
        <Onboarding onCreate={() => setCreatingTask(true)} />
      ) : (
        <div className="today-layout">
          <section className="card summary animate-in" aria-label="Progression du jour">
            <ProgressRing value={stats.plannedMin ? stats.doneMin / stats.plannedMin : 0} size={112} stroke={10}>
              <div>
                <div className="display tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                  {stats.plannedMin ? Math.round((stats.doneMin / stats.plannedMin) * 100) : 0}%
                </div>
                <div className="tiny faint">du plan</div>
              </div>
            </ProgressRing>
            <div className="summary-stats">
              <Stat label="Réalisé" value={formatDuration(stats.doneMin)} accent />
              <Stat label="Planifié" value={formatDuration(stats.plannedMin)} />
              <Stat label="Créneaux" value={`${stats.doneCount}/${stats.count}`} />
            </div>
          </section>

          <section aria-label="Créneaux du jour">
            {loading ? null : plan.length === 0 ? (
              <EmptyState
                icon={<CalendarPlus size={28} />}
                title="Aucun créneau prévu"
                text="Alloue du temps à tes tâches pour structurer ta journée."
                action={
                  <button className="btn btn-primary" onClick={() => setAdding(true)} id="today-empty-add">
                    <Plus size={18} /> Ajouter un créneau
                  </button>
                }
              />
            ) : (
              <ol className="timeline stagger">
                {plan.map((item, idx) => (
                  <li key={item.key} style={{ display: 'contents' }}>
                    {idx === nowIndex && <NowMarker min={nowMin} />}
                    <SlotCard
                      item={item}
                      task={tasks.get(item.taskId)!}
                      isNow={isToday && item.startMin <= nowMin && nowMin < item.startMin + item.durationMin}
                      isPast={(isToday && item.startMin + item.durationMin <= nowMin) || date < today()}
                      activeMs={
                        active && item.slot && active.slotId === item.slot.id ? elapsedMs(active, now) : null
                      }
                      paused={!!active?.pausedAt}
                      onOpen={() => setSelected(item)}
                      onStart={() => quickStart(item)}
                    />
                  </li>
                ))}
                {isToday && nowIndex === -1 && <NowMarker min={nowMin} />}
              </ol>
            )}
          </section>
        </div>
      )}

      <button className="fab" onClick={() => setAdding(true)} aria-label="Ajouter un créneau" id="today-fab">
        <Plus size={26} />
      </button>

      <AddSlotSheet open={adding} onClose={() => setAdding(false)} date={date} onNeedTask={() => setCreatingTask(true)} />
      <SlotSheet item={selected} onClose={() => setSelected(null)} />
      <TaskFormSheet open={creatingTask} onClose={() => setCreatingTask(false)} />
    </>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat">
      <div className="eyebrow">{label}</div>
      <div className={`display tabular stat-value ${accent ? 'gradient-text' : ''}`}>{value}</div>
    </div>
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

interface SlotCardProps {
  item: PlanItem
  task: Task
  isNow: boolean
  isPast: boolean
  activeMs: number | null
  paused: boolean
  onOpen: () => void
  onStart: () => void
}

function SlotCard({ item, task, isNow, isPast, activeMs, paused, onOpen, onStart }: SlotCardProps) {
  const done = item.status === 'done'
  const skipped = item.status === 'skipped'
  const running = activeMs !== null
  const missed = isPast && !done && !skipped && !running
  const cls = ['slot-card', 'card', 'card-interactive', isNow && 'is-now', done && 'is-done', skipped && 'is-skipped', missed && 'is-missed', running && 'is-running']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="slot-row">
      <div className="slot-time tabular">
        <span>{minutesToTime(item.startMin)}</span>
        <span className="faint">{minutesToTime(item.startMin + item.durationMin)}</span>
      </div>
      <div
        className={cls}
        style={{ '--c': task.color } as CSSProperties}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        id={`slot-${item.key}`}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      >
        <TaskIcon task={task} size={42} />
        <div className="grow">
          <div className="slot-name truncate">{task.name}</div>
          <div className="small muted row" style={{ '--gap': '6px' } as CSSProperties}>
            {running ? (
              <>
                {paused ? <span>En pause</span> : <span className="live-dot" />}
                <span className="tabular" style={{ color: 'var(--text)' }}>{formatClock(activeMs)}</span>
                <span>/ {formatDuration(item.durationMin)}</span>
              </>
            ) : (
              <>
                <span>{formatDuration(item.durationMin)}</span>
                {item.recurrence && <Repeat size={12} className="faint" />}
                {missed && <span className="slot-flag">Non commencé</span>}
                {skipped && <span className="slot-flag">Sauté</span>}
              </>
            )}
          </div>
        </div>
        {done ? (
          <span className="slot-check" aria-label="Fait">
            <Check size={18} strokeWidth={3} />
          </span>
        ) : skipped ? (
          <SkipForward size={18} className="faint" />
        ) : (
          <button
            className={`slot-play ${isNow || running ? 'is-primary' : ''}`}
            aria-label="Démarrer"
            id={`slot-start-${item.key}`}
            onClick={(e) => {
              e.stopPropagation()
              onStart()
            }}
          >
            <Play size={16} fill="currentColor" />
          </button>
        )}
      </div>
    </div>
  )
}

function Onboarding({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="onboarding card animate-in">
      <div className="onboarding-glow" />
      <div className="empty-icon">
        <Sparkles size={28} />
      </div>
      <h2>Bienvenue sur Araho</h2>
      <p className="muted">
        Crée une tâche (ex. <strong>Apprendre le JavaScript</strong>), alloue-lui des créneaux, puis documente ce
        que tu as appris à la fin de chaque session pour suivre ta progression.
      </p>
      <ol className="onboarding-steps">
        <li><span>1</span> Crée une tâche et son objectif quotidien</li>
        <li><span>2</span> Démarre la session quand le créneau arrive</li>
        <li><span>3</span> Note ce que tu as appris en 1 minute</li>
      </ol>
      <button className="btn btn-primary btn-lg" onClick={onCreate} id="onboarding-create-task">
        <Plus size={18} /> Créer ma première tâche
      </button>
    </div>
  )
}
