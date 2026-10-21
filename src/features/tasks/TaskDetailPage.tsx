import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Flame,
  Clock,
  CalendarCheck,
  Gauge,
  Repeat,
  Plus,
  BookOpen,
} from 'lucide-react'
import { NoteCard } from '../journal/NoteCard'
import { TaskIcon, EmptyState } from '../../components/ui'
import { useActiveSession, useNotes, useRecurrences, useSessions, useTask } from '../../db/hooks'
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
    return <EmptyState icon={<BookOpen size={28} />} title="Tâche introuvable" action={<Link className="btn btn-secondary" to="/tasks">Retour</Link>} />
  }

  const start = async () => {
    if (active) return navigate('/session')
    await repo.startSession(task.id)
    navigate('/session')
  }

  const maxBar = Math.max(task.dailyGoalMin, ...(stats?.history.map((h) => h.min) ?? [0]), 1)
  const since = daysBetween(task.startDate, today())

  return (
    <div style={{ '--c': task.color } as CSSProperties}>
      <header className="row spread" style={{ marginBottom: 14 }}>
        <button className="icon-btn" onClick={() => navigate('/tasks')} aria-label="Retour" id="task-back">
          <ArrowLeft size={22} />
        </button>
        <div className="row" style={{ '--gap': '4px' } as CSSProperties}>
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Modifier" id="task-edit">
            <Pencil size={18} />
          </button>
          <button
            className="icon-btn"
            aria-label={task.archived ? 'Désarchiver' : 'Archiver'}
            id="task-archive"
            onClick={() => repo.setTaskArchived(task.id, !task.archived)}
          >
            {task.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
          </button>
          <button
            className="icon-btn"
            aria-label="Supprimer"
            id="task-delete"
            onClick={async () => {
              if (!confirm(`Supprimer « ${task.name} » ? Les créneaux futurs seront retirés.`)) return
              await repo.deleteTask(task.id)
              navigate('/tasks', { replace: true })
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      <section className="task-hero card animate-in">
        <div className="task-hero-glow" />
        <TaskIcon task={task} size={68} />
        <div className="grow">
          <h1 className="display task-hero-title">{task.name}</h1>
          {task.description && <p className="muted">{task.description}</p>}
          <p className="small faint" style={{ marginTop: 4 }}>
            {task.dailyGoalMin ? `Objectif : ${formatDuration(task.dailyGoalMin)} / jour · ` : ''}
            Commencé {since === 0 ? 'aujourd’hui' : `il y a ${since} jour${since > 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn btn-primary btn-lg task-hero-start" onClick={start} id="task-start">
          <Play size={18} fill="currentColor" /> {active?.taskId === task.id ? 'Reprendre' : 'Démarrer'}
        </button>
      </section>

      {stats && (
        <section className="kpis stagger" aria-label="Statistiques">
          <Kpi icon={<Clock size={16} />} label="Temps total" value={formatDuration(stats.totalMin)} />
          <Kpi icon={<Flame size={16} />} label="Série en cours" value={`${stats.streak} j`} sub={`Record ${stats.bestStreak} j`} />
          <Kpi icon={<CalendarCheck size={16} />} label="Sessions" value={String(stats.sessionsCount)} sub={`${stats.activeDays} jours actifs`} />
          <Kpi
            icon={<Gauge size={16} />}
            label="Compréhension"
            value={stats.avgConfidence ? `${stats.avgConfidence.toFixed(1)}/5` : '—'}
          />
        </section>
      )}

      {stats && (
        <section className="card card-pad animate-in" style={{ marginTop: 16 }} aria-label="Historique">
          <div className="row spread" style={{ marginBottom: 14 }}>
            <h2 className="section-title">3 dernières semaines</h2>
            {task.dailyGoalMin > 0 && <span className="tiny faint">— objectif {formatDuration(task.dailyGoalMin)}</span>}
          </div>
          <div className="history" style={{ '--goal': task.dailyGoalMin / maxBar } as CSSProperties}>
            {task.dailyGoalMin > 0 && <div className="history-goal" />}
            {stats.history.map((h) => (
              <div key={h.date} className="history-col" title={`${formatDayMonth(h.date)} : ${formatDuration(h.min)}`}>
                <div className="history-bar-wrap">
                  <div
                    className={`history-bar ${task.dailyGoalMin && h.min >= task.dailyGoalMin ? 'is-goal' : ''}`}
                    style={{ height: `${(h.min / maxBar) * 100}%` }}
                  />
                </div>
                <span className={`history-label ${h.date === today() ? 'is-today' : ''}`}>
                  {formatWeekday(h.date).charAt(0)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card card-pad animate-in" style={{ marginTop: 16 }} aria-label="Créneaux récurrents">
        <div className="row spread" style={{ marginBottom: 10 }}>
          <h2 className="section-title">Créneaux réguliers</h2>
          <button className="btn btn-sm btn-secondary" onClick={() => setPlanning(true)} id="task-add-slot">
            <Plus size={15} /> Planifier
          </button>
        </div>
        {recurrences && recurrences.length === 0 && (
          <p className="small muted">Aucun créneau récurrent. Planifie un horaire fixe pour en faire une habitude.</p>
        )}
        <ul className="rec-list">
          {recurrences?.map((r) => (
            <li key={r.id} className="rec-item">
              <Repeat size={16} className="faint" />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{describeDays(r.daysOfWeek)}</div>
                <div className="small muted tabular">
                  {minutesToTime(r.startMin)} – {minutesToTime(r.startMin + r.durationMin)} · {formatDuration(r.durationMin)}
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label="Supprimer la série"
                id={`rec-delete-${r.id}`}
                onClick={async () => {
                  if (confirm('Supprimer cette série de créneaux ? L’historique est conservé.')) await repo.deleteRecurrence(r.id)
                }}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 28 }} aria-label="Ce que j'ai appris">
        <div className="row spread" style={{ marginBottom: 14 }}>
          <h2 className="section-title">Ce que j’ai appris</h2>
          <span className="small faint">{notes?.length ?? 0} note{(notes?.length ?? 0) > 1 ? 's' : ''}</span>
        </div>
        {notes && notes.length === 0 ? (
          <div className="card card-pad muted small" style={{ textAlign: 'center' }}>
            Tes notes de fin de session apparaîtront ici, comme un journal de ta progression.
          </div>
        ) : (
          <div className="notes-timeline stagger">
            {notes?.map((n) => (
              <NoteCard key={n.id} note={n} session={sessionMap.get(n.sessionId)} />
            ))}
          </div>
        )}
      </section>

      <TaskFormSheet open={editing} onClose={() => setEditing(false)} task={task} />
      <AddSlotSheet open={planning} onClose={() => setPlanning(false)} date={today()} taskId={task.id} />
    </div>
  )
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-icon">{icon}</div>
      <div className="eyebrow">{label}</div>
      <div className="display tabular kpi-value">{value}</div>
      {sub && <div className="tiny faint">{sub}</div>}
    </div>
  )
}
