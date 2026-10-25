import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Play, Pencil, Archive, ArchiveRestore, Trash2, Repeat, Plus, BookOpen, FileDown } from 'lucide-react'
import { NoteCard } from '../journal/NoteCard'
import { TaskIcon, EmptyState, Section } from '../../components/ui'
import { useActiveSession, useNotes, useRecurrences, useSessions, useTask } from '../../db/hooks'
import { exportNotesToMarkdown } from '../../lib/exportMarkdown'
import * as repo from '../../db/repo'
import { computeTaskStats } from '../../db/stats'
import { daysBetween, describeDays, formatDayMonth, formatDuration, formatWeekday, minutesToTime, today } from '../../lib/date'
import { TaskFormSheet } from './TaskFormSheet'
import { AddSlotSheet } from '../planning/AddSlotSheet'

export function TaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const task = useTask(taskId)
  const sessions = useSessions({ taskId })
  const notes = useNotes(taskId)
  const recurrences = useRecurrences(taskId)
  const active = useActiveSession()
  const [editing, setEditing] = useState(false)
  const [planning, setPlanning] = useState(false)

  const stats = useMemo(
    () => (sessions && notes ? computeTaskStats(sessions, notes, today(), 21) : null),
    [sessions, notes],
  )
  const sessionMap = useMemo(() => new Map((sessions ?? []).map((s) => [s.id, s])), [sessions])

  if (task === undefined) return null
  if (task === null) {
    return <EmptyState icon={<BookOpen size={56} strokeWidth={1.4} />} title="Tâche introuvable" action={<Link className="btn btn-secondary" to="/tasks">Retour</Link>} />
  }

  const start = async () => {
    if (active) return navigate('/session')
    await repo.startSession(task.id)
    navigate('/session')
  }

  const recordedMax = Math.max(...(stats?.history.map((h) => h.min) ?? [0]), 1)
  const maxBar = Math.max(task.dailyGoalMin > 0 ? task.dailyGoalMin * 1.3 : 0, recordedMax, 30)
  const since = daysBetween(task.startDate, today())

  return (
    <div style={{ '--c': task.color } as CSSProperties}>
      <header className="row spread" style={{ marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={() => navigate('/tasks')} id="task-back" style={{ paddingLeft: 0 }}>
          <ChevronLeft size={24} style={{ marginRight: -4 }} /> Tâches
        </button>
        <button className="btn btn-ghost" onClick={() => setEditing(true)} id="task-edit">
          <Pencil size={16} /> Modifier
        </button>
      </header>

      <div className="task-hero">
        <div className="task-hero-badge">
          <TaskIcon task={task} size={52} />
        </div>
        <div className="caption">
          {task.dailyGoalMin ? `${formatDuration(task.dailyGoalMin)} / jour · ` : ''}
          {since === 0 ? 'depuis aujourd’hui' : `depuis ${since} jour${since > 1 ? 's' : ''}`}
        </div>
        <h1 className="task-hero-title">{task.name}</h1>
        {task.description && <p className="task-hero-desc">{task.description}</p>}
      </div>

      <div className="section" style={{ marginBottom: 28 }}>
        <button className="btn btn-primary btn-lg btn-block" onClick={start} id="task-start">
          <Play size={17} fill="currentColor" /> {active?.taskId === task.id ? 'Reprendre la session' : 'Démarrer une session'}
        </button>
      </div>

      {stats && (
        <Section title="Progression">
          <div className="cell">
            <span className="cell-body">Temps total</span>
            <span className="cell-value tabular">{formatDuration(stats.totalMin)}</span>
          </div>
          <div className="cell">
            <span className="cell-body">Série en cours</span>
            <span className="cell-value tabular">{stats.streak} j <span className="faint">· record {stats.bestStreak} j</span></span>
          </div>
          <div className="cell">
            <span className="cell-body">Sessions</span>
            <span className="cell-value tabular">{stats.sessionsCount} <span className="faint">· {stats.activeDays} jours actifs</span></span>
          </div>
          <div className="cell">
            <span className="cell-body">Compréhension moyenne</span>
            <span className="cell-value tabular">{stats.avgConfidence ? `${stats.avgConfidence.toFixed(1)} / 5` : '—'}</span>
          </div>
        </Section>
      )}

      {stats && (
        <Section title="3 dernières semaines" footer={task.dailyGoalMin > 0 ? `Trait pointillé : objectif de ${formatDuration(task.dailyGoalMin)}` : undefined}>
          <div className="pad">
            <div className="history" style={{ '--goal': task.dailyGoalMin / maxBar } as CSSProperties}>
              {task.dailyGoalMin > 0 && <div className="history-goal" />}
              {stats.history.map((h) => (
                <div key={h.date} className="history-col" title={`${formatDayMonth(h.date)} : ${formatDuration(h.min)}`}>
                  <div className="history-bar-wrap">
                    <div
                      className={`history-bar ${h.min > 0 ? 'is-active' : ''}`}
                      style={{ height: h.min > 0 ? `${Math.max(6, (h.min / maxBar) * 100)}%` : '2px' }}
                    />
                  </div>
                  <span className={`history-label ${h.date === today() ? 'is-today' : ''}`}>
                    {formatWeekday(h.date).charAt(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section
        title="Créneaux réguliers"
        action={
          <button className="btn btn-ghost btn-sm" onClick={() => setPlanning(true)} id="task-add-slot">
            <Plus size={15} /> Planifier
          </button>
        }
        footer={recurrences && recurrences.length === 0 ? 'Planifie un horaire fixe pour en faire une habitude.' : undefined}
      >
        {recurrences?.map((r) => (
          <div key={r.id} className="cell">
            <Repeat size={18} className="muted" />
            <div className="cell-body">
              <div className="cell-title">{describeDays(r.daysOfWeek)}</div>
              <div className="cell-sub tabular">
                {minutesToTime(r.startMin)} – {minutesToTime(r.startMin + r.durationMin)} · {formatDuration(r.durationMin)}
              </div>
            </div>
            <button
              className="icon-btn"
              style={{ color: 'var(--danger)' }}
              aria-label="Supprimer la série"
              id={`rec-delete-${r.id}`}
              onClick={async () => {
                if (confirm('Supprimer cette série de créneaux ? L’historique est conservé.')) await repo.deleteRecurrence(r.id)
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {recurrences && recurrences.length === 0 && (
          <div className="cell"><span className="cell-body muted">Aucun créneau récurrent</span></div>
        )}
      </Section>

      <section style={{ marginTop: 8 }} aria-label="Ce que j'ai appris">
        <div className="row spread" style={{ alignItems: 'baseline', marginBottom: 6 }}>
          <div className="group-title" style={{ margin: 0 }}>Ce que j’ai appris · {notes?.length ?? 0}</div>
          {notes && notes.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => exportNotesToMarkdown(notes, new Map([[task.id, task]]), `Journal — ${task.name}`)}
              style={{ fontSize: 13 }}
              id="task-export-md"
            >
              <FileDown size={14} /> Exporter .md
            </button>
          )}
        </div>
        {notes && notes.length === 0 ? (
          <div className="group"><div className="cell"><span className="cell-body muted small">Tes notes de fin de session apparaîtront ici, comme un journal de ta progression.</span></div></div>
        ) : (
          <div className="notes-list">
            {notes?.map((n) => (
              <NoteCard key={n.id} note={n} session={sessionMap.get(n.sessionId)} />
            ))}
          </div>
        )}
      </section>

      <div className="section" style={{ marginTop: 28 }}>
        <div className="group">
          <button
            className="cell is-accent"
            id="task-archive"
            onClick={() => repo.setTaskArchived(task.id, !task.archived)}
          >
            {task.archived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
            <span className="cell-body">{task.archived ? 'Désarchiver' : 'Archiver la tâche'}</span>
          </button>
          <button
            className="cell is-danger"
            id="task-delete"
            onClick={async () => {
              if (!confirm(`Supprimer « ${task.name} » ? Les créneaux futurs seront retirés.`)) return
              await repo.deleteTask(task.id)
              navigate('/tasks', { replace: true })
            }}
          >
            <Trash2 size={20} />
            <span className="cell-body">Supprimer la tâche</span>
          </button>
        </div>
      </div>

      <TaskFormSheet open={editing} onClose={() => setEditing(false)} task={task} />
      <AddSlotSheet open={planning} onClose={() => setPlanning(false)} date={today()} taskId={task.id} />
    </div>
  )
}
