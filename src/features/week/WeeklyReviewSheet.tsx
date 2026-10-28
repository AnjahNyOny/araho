import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { FileDown, TrendingUp, TrendingDown, Calendar, Zap, BookOpen, Star } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { useNotes, useSessions, useTaskMap } from '../../db/hooks'
import { computeWeeklyReview } from '../../db/stats'
import { formatDayLong, formatDayMonth, formatDuration, type ISODate } from '../../lib/date'
import { exportWeeklyReviewToMarkdown } from '../../lib/exportMarkdown'
import { Section, TaskIcon } from '../../components/ui'

interface WeeklyReviewSheetProps {
  open: boolean
  onClose: () => void
  weekDays: ISODate[]
}

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export function WeeklyReviewSheet({ open, onClose, weekDays }: WeeklyReviewSheetProps) {
  const allSessions = useSessions()
  const allNotes = useNotes()
  const tasksMap = useTaskMap()

  const stats = useMemo(() => {
    if (!allSessions || !allNotes) return null
    return computeWeeklyReview(allSessions, allNotes, weekDays)
  }, [allSessions, allNotes, weekDays])

  const weekNotes = useMemo(() => {
    if (!allNotes) return []
    const set = new Set(weekDays)
    return allNotes.filter((n) => set.has(n.date))
  }, [allNotes, weekDays])

  const startDate = weekDays[0]
  const endDate = weekDays[weekDays.length - 1]
  const maxDayMin = Math.max(...(stats?.dailyBreakdown.map((d) => d.min) ?? [0]), 60)
  const up = (stats?.diffMin ?? 0) >= 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      id="weekly-review"
      eyebrow="Revue de la semaine"
      title="Bilan hebdomadaire"
      subtitle={`${formatDayMonth(startDate)} — ${formatDayMonth(endDate)}`}
      actions={
        stats && stats.totalMin > 0 && tasksMap ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => exportWeeklyReviewToMarkdown(stats, tasksMap, weekNotes)}
            title="Exporter le bilan en Markdown (.md)"
          >
            <FileDown size={16} /> .md
          </button>
        ) : undefined
      }
    >
      <div className="group stat-hero mb-4">
        <div className="caption">Temps total d’apprentissage</div>
        <div className="stat-hero-value">{stats ? formatDuration(stats.totalMin) : '—'}</div>
        {stats && stats.diffPercent !== null && (
          <span className={`trend ${up ? 'is-up' : 'is-down'}`}>
            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {up ? '+' : ''}
            {formatDuration(stats.diffMin)} ({up ? '+' : ''}
            {stats.diffPercent} %) vs semaine passée
          </span>
        )}
      </div>

      <div className="stat-grid">
        <Stat icon={<Calendar size={15} />} label="Jours actifs" value={stats ? `${stats.activeDaysCount} / 7 j` : '—'} />
        <Stat
          icon={<Zap size={15} />}
          label="Meilleur jour"
          value={
            stats?.mostProductiveDay
              ? `${formatDayMonth(stats.mostProductiveDay.date)} · ${formatDuration(stats.mostProductiveDay.min)}`
              : '—'
          }
        />
        <Stat icon={<BookOpen size={15} />} label="Notes rédigées" value={String(stats?.notesCount ?? 0)} />
        <Stat
          icon={<Star size={15} />}
          label="Compréhension"
          value={stats?.avgConfidence ? `${stats.avgConfidence.toFixed(1)} / 5` : '—'}
        />
      </div>

      <Section title="Temps par jour">
        <div className="pad">
          <div className="bars">
            {stats?.dailyBreakdown.map((d, idx) => {
              const h = d.min > 0 ? Math.max(0.08, d.min / maxDayMin) : 0.03
              return (
                <div key={d.date} className="bars-col" title={`${formatDayLong(d.date)} : ${formatDuration(d.min)}`}>
                  {d.min > 0 && <span className="bars-value">{formatDuration(d.min)}</span>}
                  <div className={`bars-bar ${d.min > 0 ? 'is-active' : ''}`} style={{ '--h': h } as CSSProperties} />
                  <span className={`bars-label ${d.min > 0 ? 'is-active' : ''}`}>{DAY_LETTERS[idx]}</span>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {stats && stats.taskBreakdown.length > 0 && (
        <Section title="Répartition par tâche">
          <div className="pad breakdown">
            {stats.taskBreakdown.map((t) => {
              const task = tasksMap?.get(t.taskId)
              return (
                <div key={t.taskId}>
                  <div className="row spread mb-2">
                    <div className="row gap-2">
                      {task && <TaskIcon task={task} size={22} />}
                      <span className="breakdown-name">{task?.name ?? 'Tâche'}</span>
                    </div>
                    <span className="tabular muted tiny">
                      {formatDuration(t.min)} · {t.percent} %
                    </span>
                  </div>
                  <div
                    className="bar"
                    style={{ '--p': t.percent / 100, '--c': task?.color } as CSSProperties}
                  >
                    <span />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {weekNotes.length > 0 && (
        <Section title={`Ce que tu as appris cette semaine · ${weekNotes.length}`}>
          <div className="pad">
            {weekNotes.map((note) => {
              const task = tasksMap?.get(note.taskId)
              return (
                <div key={note.id} className="note-line">
                  <div className="row spread mb-2">
                    <span className="tiny strong">
                      {task?.name} · {formatDayMonth(note.date)}
                    </span>
                    {note.confidence > 0 && (
                      <span className="tiny text-warning">{'★'.repeat(note.confidence)}</span>
                    )}
                  </div>
                  <p className="small">{note.learned}</p>
                  {note.nextStep && <div className="tiny muted mt-1">→ {note.nextStep}</div>}
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </Sheet>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="group stat">
      <div className="stat-label">
        {icon}
        <span className="caption">{label}</span>
      </div>
      <div className="stat-value truncate">{value}</div>
    </div>
  )
}
