import { useMemo } from 'react'
import { X, FileDown, TrendingUp, TrendingDown, Calendar, Zap, BookOpen, Star } from 'lucide-react'
import { useNotes, useSessions, useTaskMap } from '../../db/hooks'
import { computeWeeklyReview } from '../../db/stats'
import { formatDayLong, formatDayMonth, formatDuration, type ISODate } from '../../lib/date'
import { exportWeeklyReviewToMarkdown } from '../../lib/exportMarkdown'
import { TaskIcon } from '../../components/ui'

interface WeeklyReviewSheetProps {
  open: boolean
  onClose: () => void
  weekDays: ISODate[]
}

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

  if (!open) return null

  const startDate = weekDays[0]
  const endDate = weekDays[weekDays.length - 1]
  const maxDayMin = Math.max(...(stats?.dailyBreakdown.map((d) => d.min) ?? [0]), 60)

  return (
    <div className="sheet-backdrop animate-fade" onClick={onClose}>
      <div
        className="sheet-panel animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Barre supérieure */}
        <div className="sheet-header">
          <div className="grow">
            <div className="caption">Revue de la semaine</div>
            <div className="sheet-title">Bilan hebdomadaire</div>
            <div className="tiny muted">{formatDayMonth(startDate)} — {formatDayMonth(endDate)}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {stats && stats.totalMin > 0 && tasksMap && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => exportWeeklyReviewToMarkdown(stats, tasksMap, weekNotes)}
                title="Exporter le bilan en Markdown (.md)"
              >
                <FileDown size={16} /> Exporter .md
              </button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Fermer">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="sheet-body" style={{ paddingBottom: 32 }}>
          {/* Carte Principale Hero */}
          <div
            className="group"
            style={{
              padding: '24px 20px',
              textAlign: 'center',
              background: 'linear-gradient(180deg, var(--bg-cell) 0%, var(--fill) 100%)',
              marginBottom: 16,
            }}
          >
            <div className="caption" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Temps total d'apprentissage
            </div>
            <div
              className="tabular"
              style={{
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                margin: '8px 0',
                color: 'var(--label)',
              }}
            >
              {stats ? formatDuration(stats.totalMin) : '—'}
            </div>

            {stats && stats.diffPercent !== null && (
              <div
                className="chip chip-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: stats.diffMin >= 0 ? 'var(--sys-green)' : 'var(--sys-orange)',
                  background: stats.diffMin >= 0 ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 149, 0, 0.12)',
                  padding: '4px 10px',
                  borderRadius: 999,
                }}
              >
                {stats.diffMin >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>
                  {stats.diffMin >= 0 ? '+' : ''}
                  {formatDuration(stats.diffMin)} ({stats.diffMin >= 0 ? '+' : ''}
                  {stats.diffPercent}%) vs semaine passée
                </span>
              </div>
            )}
          </div>

          {/* Grille 4 métriques clés */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <div className="group" style={{ padding: '14px 16px', margin: 0 }}>
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <Calendar size={15} style={{ color: 'var(--sys-blue)' }} />
                <span className="caption">Jours actifs</span>
              </div>
              <div className="tabular" style={{ fontSize: 20, fontWeight: 700 }}>
                {stats ? `${stats.activeDaysCount} / 7 j` : '—'}
              </div>
            </div>

            <div className="group" style={{ padding: '14px 16px', margin: 0 }}>
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <Zap size={15} style={{ color: 'var(--sys-orange)' }} />
                <span className="caption">Meilleur jour</span>
              </div>
              <div className="tabular truncate" style={{ fontSize: 16, fontWeight: 700 }}>
                {stats?.mostProductiveDay
                  ? `${formatDayMonth(stats.mostProductiveDay.date)} (${formatDuration(stats.mostProductiveDay.min)})`
                  : '—'}
              </div>
            </div>

            <div className="group" style={{ padding: '14px 16px', margin: 0 }}>
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <BookOpen size={15} style={{ color: 'var(--sys-purple)' }} />
                <span className="caption">Notes rédigées</span>
              </div>
              <div className="tabular" style={{ fontSize: 20, fontWeight: 700 }}>
                {stats ? stats.notesCount : 0}
              </div>
            </div>

            <div className="group" style={{ padding: '14px 16px', margin: 0 }}>
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <Star size={15} style={{ color: 'var(--sys-yellow)' }} />
                <span className="caption">Compréhension</span>
              </div>
              <div className="tabular" style={{ fontSize: 20, fontWeight: 700 }}>
                {stats?.avgConfidence ? `${stats.avgConfidence.toFixed(1)} / 5` : '—'}
              </div>
            </div>
          </div>

          {/* Graphique de la semaine */}
          <div className="group" style={{ padding: '16px 14px', marginBottom: 20 }}>
            <div className="group-title" style={{ margin: '0 0 16px 4px' }}>
              Temps par jour
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                alignItems: 'flex-end',
                height: 120,
                gap: 8,
                padding: '0 4px',
              }}
            >
              {stats?.dailyBreakdown.map((d, idx) => {
                const dayLetter = ['D', 'L', 'M', 'M', 'J', 'V', 'S'][idx]
                const heightPct = d.min > 0 ? Math.max(8, (d.min / maxDayMin) * 100) : 3
                return (
                  <div
                    key={d.date}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                    title={`${formatDayLong(d.date)} : ${formatDuration(d.min)}`}
                  >
                    {d.min > 0 && (
                      <span className="tiny muted tabular" style={{ fontSize: 10 }}>
                        {formatDuration(d.min)}
                      </span>
                    )}
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 28,
                        height: `${heightPct}%`,
                        background: d.min > 0 ? 'var(--sys-blue)' : 'var(--fill-2)',
                        borderRadius: 6,
                        transition: 'height 300ms ease',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: d.min > 0 ? 'var(--label)' : 'var(--label-3)',
                      }}
                    >
                      {dayLetter}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Répartition par tâche */}
          {stats && stats.taskBreakdown.length > 0 && (
            <div className="group" style={{ padding: '16px 16px 8px', marginBottom: 20 }}>
              <div className="group-title" style={{ margin: '0 0 12px 0' }}>
                Répartition par tâche
              </div>
              {stats.taskBreakdown.map((t) => {
                const task = tasksMap?.get(t.taskId)
                return (
                  <div key={t.taskId} style={{ marginBottom: 14 }}>
                    <div className="row spread" style={{ marginBottom: 6 }}>
                      <div className="row" style={{ gap: 8 }}>
                        {task && <TaskIcon task={task} size={22} />}
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{task?.name ?? 'Tâche'}</span>
                      </div>
                      <span className="tabular muted tiny" style={{ fontSize: 13 }}>
                        {formatDuration(t.min)} ({t.percent}%)
                      </span>
                    </div>
                    <div className="bar" style={{ height: 6, borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${t.percent}%`,
                          background: task?.color || 'var(--sys-blue)',
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Apprentissages clés de la semaine */}
          {weekNotes.length > 0 && (
            <div className="group" style={{ padding: '16px 16px 4px', marginBottom: 20 }}>
              <div className="group-title" style={{ margin: '0 0 12px 0' }}>
                Ce que tu as appris cette semaine · {weekNotes.length}
              </div>
              <div className="notes-list">
                {weekNotes.map((note) => {
                  const task = tasksMap?.get(note.taskId)
                  return (
                    <div
                      key={note.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid var(--separator)',
                      }}
                    >
                      <div className="row spread" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: task?.color || 'var(--label)' }}>
                          {task?.name} · {formatDayMonth(note.date)}
                        </span>
                        {note.confidence > 0 && (
                          <span className="tiny" style={{ color: 'var(--sys-yellow)' }}>
                            {'★'.repeat(note.confidence)}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, color: 'var(--label)' }}>
                        {note.learned}
                      </p>
                      {note.nextStep && (
                        <div className="tiny muted" style={{ marginTop: 4 }}>
                          👉 {note.nextStep}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
