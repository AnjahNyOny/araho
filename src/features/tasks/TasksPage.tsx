import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, ListChecks } from 'lucide-react'
import { PageHeader, EmptyState, TaskIcon } from '../../components/ui'
import { useSessions, useTasks } from '../../db/hooks'
import { minutesByDate } from '../../db/stats'
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
          <button className="icon-btn is-filled" onClick={() => setCreating(true)} aria-label="Nouvelle tâche" id="tasks-add">
            <Plus size={22} />
          </button>
        }
      />

      {tasks && tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={56} strokeWidth={1.4} />}
          title="Aucune tâche"
          text="Une tâche est un objectif sur lequel tu veux progresser (Apprendre le JavaScript, Sport, Lecture…)."
          action={
            <button className="btn btn-primary" onClick={() => setCreating(true)} id="tasks-empty-add">
              Créer une tâche
            </button>
          }
        />
      ) : (
        <div className="group animate-in">
          {tasks?.map((t) => <TaskRow key={t.id} task={t} sessions={byTask.get(t.id) ?? []} />)}
        </div>
      )}

      <div className="section" style={{ marginTop: 24 }}>
        <div className="group">
          <label className="cell" htmlFor="tasks-toggle-archived" style={{ cursor: 'pointer' }}>
            <span className="cell-body">Afficher les tâches archivées</span>
            <input
              id="tasks-toggle-archived"
              type="checkbox"
              className="switch"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
          </label>
        </div>
      </div>

      <TaskFormSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function TaskRow({ task, sessions }: { task: Task; sessions: Session[] }) {
  const t = today()
  const byDate = minutesByDate(sessions)
  const todayMin = byDate.get(t) ?? 0

  return (
    <Link
      to={`/tasks/${task.id}`}
      className={`cell has-icon ${task.archived ? 'is-skipped' : ''}`}
      id={`task-card-${task.id}`}
    >
      <TaskIcon task={task} size={34} />
      <div className="cell-body">
        <div className="cell-title truncate">{task.name}</div>
        <div className="cell-sub truncate">
          {task.dailyGoalMin
            ? `${formatDuration(todayMin)} / ${formatDuration(task.dailyGoalMin)} aujourd’hui`
            : task.description || 'Sans objectif quotidien'}
        </div>
      </div>
      <ChevronRight size={18} className="cell-chevron" />
    </Link>
  )
}
