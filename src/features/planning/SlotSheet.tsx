import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, Check, SkipForward, Trash2, Repeat, NotebookPen, Undo2, Clock } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { DurationPicker, TaskIcon } from '../../components/ui'
import { useActiveSession, useTaskMap } from '../../db/hooks'
import * as repo from '../../db/repo'
import type { PlanItem } from '../../db/types'
import { describeDays, formatDuration, minutesToTime, relativeDayLabel, timeToMinutes } from '../../lib/date'

interface Props {
  item: PlanItem | null
  onClose: () => void
}

export function SlotSheet({ item, onClose }: Props) {
  const navigate = useNavigate()
  const tasks = useTaskMap()
  const active = useActiveSession()
  const [editing, setEditing] = useState(false)
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [scope, setScope] = useState<'one' | 'series'>('one')

  const sessions = useLiveQuery(
    () => (item?.slot ? repo.getSessionsForSlot(item.slot.id) : []),
    [item?.slot?.id],
  )

  useEffect(() => {
    if (!item) return
    setEditing(false)
    setTime(minutesToTime(item.startMin))
    setDuration(item.durationMin)
    setScope('one')
  }, [item])

  if (!item) return null
  const task = tasks?.get(item.taskId)
  if (!task) return null

  const isActiveHere = !!active && !!item.slot && active.slotId === item.slot.id
  const done = item.status === 'done'
  const skipped = item.status === 'skipped'
  const session = sessions?.[0]

  const start = async () => {
    if (active) {
      if (isActiveHere) {
        onClose()
        navigate('/session')
        return
      }
      alert('Une session est déjà en cours. Termine-la avant d’en démarrer une autre.')
      return
    }
    await repo.startSession(item.taskId, item)
    onClose()
    navigate('/session')
  }

  const markDone = async () => {
    const s = await repo.logManualSession(item.taskId, item.durationMin, item)
    onClose()
    navigate(`/note/${s.id}`)
  }

  const saveEdit = async () => {
    const patch = { startMin: timeToMinutes(time), durationMin: Math.max(5, duration) }
    if (scope === 'series' && item.recurrence) await repo.updateRecurrence(item.recurrence.id, patch)
    else await repo.updateOccurrence(item, patch)
    setEditing(false)
    onClose()
  }

  const end = item.startMin + item.durationMin

  return (
    <Sheet open onClose={onClose} id="slot-sheet" title="">
      <div className="stack" style={{ '--gap': '20px', marginTop: -18 } as CSSProperties}>
        <div className="row" style={{ '--gap': '14px' } as CSSProperties}>
          <TaskIcon task={task} size={54} />
          <div className="grow">
            <h3 style={{ fontSize: 21 }}>{task.name}</h3>
            <div className="small muted row" style={{ '--gap': '6px', flexWrap: 'wrap' } as CSSProperties}>
              <span>{relativeDayLabel(item.date)}</span>·
              <span className="tabular">
                {minutesToTime(item.startMin)} – {minutesToTime(end)}
              </span>
              ·<span>{formatDuration(item.durationMin)}</span>
            </div>
            {item.recurrence && (
              <div className="tiny faint row" style={{ '--gap': '5px', marginTop: 4 } as CSSProperties}>
                <Repeat size={12} /> {describeDays(item.recurrence.daysOfWeek)}
              </div>
            )}
          </div>
        </div>

        {done && (
          <div className="status-banner success">
            <Check size={18} />
            <span className="grow">
              Fait{session ? ` · ${formatDuration(session.durationMin)}` : ''}
            </span>
            {session && (
              <button
                className="btn btn-sm btn-secondary"
                id="slot-view-note"
                onClick={() => {
                  onClose()
                  navigate(`/note/${session.id}`)
                }}
              >
                <NotebookPen size={15} /> Note
              </button>
            )}
          </div>
        )}
        {skipped && (
          <div className="status-banner">
            <SkipForward size={18} />
            <span className="grow">Créneau sauté</span>
          </div>
        )}

        {editing ? (
          <div className="stack card card-pad" style={{ '--gap': '16px' } as CSSProperties}>
            <label className="field">
              <span className="field-label">Début</span>
              <input
                id="slot-edit-time"
                type="time"
                className="input"
                style={{ maxWidth: 150 }}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
            <div className="field">
              <span className="field-label">Durée</span>
              <DurationPicker value={duration} onChange={setDuration} idPrefix="slot-edit-duration" />
            </div>
            {item.recurrence && (
              <div className="chips">
                <button
                  className="chip"
                  id="slot-edit-scope-one"
                  aria-pressed={scope === 'one'}
                  onClick={() => setScope('one')}
                >
                  Ce créneau seulement
                </button>
                <button
                  className="chip"
                  id="slot-edit-scope-series"
                  aria-pressed={scope === 'series'}
                  onClick={() => setScope('series')}
                >
                  Toute la série
                </button>
              </div>
            )}
            <div className="row">
              <button className="btn btn-secondary grow" onClick={() => setEditing(false)} id="slot-edit-cancel">
                Annuler
              </button>
              <button className="btn btn-primary grow" onClick={saveEdit} id="slot-edit-save">
                Enregistrer
              </button>
            </div>
          </div>
        ) : (
          <div className="stack" style={{ '--gap': '10px' } as CSSProperties}>
            {!done && (
              <button className="btn btn-primary btn-lg btn-block" onClick={start} id="slot-start">
                <Play size={18} fill="currentColor" />
                {isActiveHere ? 'Reprendre la session' : 'Démarrer la session'}
              </button>
            )}
            <div className="action-grid">
              {!done && !isActiveHere && (
                <button className="action-tile" onClick={markDone} id="slot-mark-done">
                  <Check size={20} />
                  <span>Déjà fait</span>
                </button>
              )}
              {!done && !skipped && !isActiveHere && (
                <button
                  className="action-tile"
                  id="slot-skip"
                  onClick={async () => {
                    await repo.setSlotStatus(item, 'skipped')
                    onClose()
                  }}
                >
                  <SkipForward size={20} />
                  <span>Sauter</span>
                </button>
              )}
              {skipped && (
                <button
                  className="action-tile"
                  id="slot-unskip"
                  onClick={async () => {
                    await repo.setSlotStatus(item, 'planned')
                    onClose()
                  }}
                >
                  <Undo2 size={20} />
                  <span>Rétablir</span>
                </button>
              )}
              {!done && !isActiveHere && (
                <button className="action-tile" onClick={() => setEditing(true)} id="slot-edit">
                  <Clock size={20} />
                  <span>Modifier</span>
                </button>
              )}
              {!isActiveHere && (
                <button
                  className="action-tile danger"
                  id="slot-delete"
                  onClick={async () => {
                    if (!confirm('Supprimer ce créneau ?')) return
                    await repo.deleteOccurrence(item)
                    onClose()
                  }}
                >
                  <Trash2 size={20} />
                  <span>Supprimer</span>
                </button>
              )}
            </div>
            {item.recurrence && !isActiveHere && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'center', color: 'var(--danger)' }}
                id="slot-delete-series"
                onClick={async () => {
                  if (!confirm('Supprimer toute la série ? L’historique est conservé.')) return
                  await repo.deleteRecurrence(item.recurrence!.id)
                  onClose()
                }}
              >
                Supprimer toute la série
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
