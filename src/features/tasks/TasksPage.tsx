import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Flame, Archive, LayoutGrid } from 'lucide-react'
import { PageHeader, EmptyState, TaskIcon } from '../../components/ui'
import { useSessions, useTasks } from '../../db/hooks'
import { computeStreak, minutesByDate } from '../../db/stats'
import type { Session, Task } from '../../db/types'
import { formatDuration, today } from '../../lib/date'
import { TaskFormSheet } from './TaskFormSheet'

export function TasksPage() {
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const tasks = useTasks(showArchived)
  const sessions = useSessions()

  const byTask = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const s of sessions ?? []) map.set(s.taskId, [...(map.get(s.taskId) ?? []), s])
    return map
  }, [sessions])

  return (
    <>
      <PageHeader
        eyebrow="Tes objectifs"
        title="Tâches"
        actions={
          <>
            <button
              className={`btn btn-sm ${showArchived ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setShowArchived(!showArchived)}
              id="tasks-toggle-archived"
            >
              <Archive size={15} /> Archivées
            </button>
            <button className="btn btn-sm btn-primary desktop-only" onClick={() => setCreating(true)} id="tasks-add-desktop">
              <Plus size={16} /> Nouvelle tâche
            </button>
          </>
        }
      />

      {tasks && tasks.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={28} />}
          title="Aucune tâche"
          text="Une tâche = un objectif sur lequel tu veux progresser (ex. Apprendre le JavaScript, Sport, Lecture…)."
          action={
            <button className="btn btn-primary" onClick={() => setCreating(true)} id="tasks-empty-add">
              <Plus size={18} /> Créer une tâche
            </button>
          }
        />
      ) : (
        <div className="task-grid stagger">
          {tasks?.map((t) => <TaskCard key={t.id} task={t} sessions={byTask.get(t.id) ?? []} />)}
        </div>
      )}

      <button className="fab" onClick={() => setCreating(true)} aria-label="Nouvelle tâche" id="tasks-fab">
        <Plus size={26} />
      </button>
      <TaskFormSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function TaskCard({ task, sessions }: { task: Task; sessions: Session[] }) {
  const t = today()
  const byDate = minutesByDate(sessions)
  const todayMin = byDate.get(t) ?? 0
  const total = sessions.reduce((a, s) => a + s.durationMin, 0)
  const streak = computeStreak(new Set(byDate.keys()), t)
  const pct = task.dailyGoalMin ? Math.min(1, todayMin / task.dailyGoalMin) : 0

  return (
    <Link
      to={`/tasks/${task.id}`}
      className={`card card-interactive task-card ${task.archived ? 'is-archived' : ''}`}
      style={{ '--c': task.color, '--p': pct } as CSSProperties}
      id={`task-card-${task.id}`}
    >
      <div className="task-card-glow" />
      <div className="row spread">
        <TaskIcon task={task} size={46} />
        {streak > 0 && (
          <span className="streak" title="Jours consécutifs">
            <Flame size={14} /> {streak}
          </span>
        )}
      </div>
      <div>
        <h3 className="task-card-name">{task.name}</h3>
        <p className="small muted truncate">{task.description || (task.dailyGoalMin ? `${formatDuration(task.dailyGoalMin)} par jour` : 'Sans objectif quotidien')}</p>
      </div>
      {task.dailyGoalMin > 0 && (
        <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
          <div className="row spread tiny">
            <span className="muted">Aujourd’hui</span>
            <span className="tabular">
              {formatDuration(todayMin)} / {formatDuration(task.dailyGoalMin)}
            </span>
          </div>
          <div className="bar">
            <span />
          </div>
        </div>
      )}
      <div className="row spread tiny faint">
        <span>Total : {formatDuration(total)}</span>
        <span>{sessions.length} session{sessions.length > 1 ? 's' : ''}</span>
      </div>
    </Link>
  )
}
