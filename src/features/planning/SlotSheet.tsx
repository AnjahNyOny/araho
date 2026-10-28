import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, Check, SkipForward, Trash2, Repeat, NotebookPen, Undo2, Clock, Sparkles } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { DurationPicker, Section, TaskIcon } from '../../components/ui'
import { useActiveSession, useDayPlan, useTaskMap } from '../../db/hooks'
import * as repo from '../../db/repo'
import type { PlanItem } from '../../db/types'
import {
  addDays,
  describeDays,
  formatDuration,
  minutesToTime,
  relativeDayLabel,
  timeToMinutes,
} from '../../lib/date'
import { findNextFreeSlot } from '../../lib/scheduling'

interface Props {
  item: PlanItem | null
  onClose: () => void
}

export function SlotSheet({ item, onClose }: Props) {
  const navigate = useNavigate()
  const tasks = useTaskMap()
  const active = useActiveSession()
  const dayPlan = useDayPlan(item?.date ?? '')
  const [editing, setEditing] = useState(false)
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [scope, setScope] = useState<'one' | 'series'>('one')

  const nextFree = useMemo(() => {
    if (!dayPlan || !item) return null
    return findNextFreeSlot(item, dayPlan)
  }, [dayPlan, item])

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
    <Sheet open onClose={onClose} id="slot-sheet" title="Créneau">
      <div className="section row gap-4">
        <TaskIcon task={task} size={56} />
        <div className="grow">
          <h3 className="title">{task.name}</h3>
          <div className="small muted tabular">
            {relativeDayLabel(item.date)} · {minutesToTime(item.startMin)} – {minutesToTime(end)} · {formatDuration(item.durationMin)}
          </div>
          {item.recurrence && (
            <div className="tiny muted row gap-1 mt-1">
              <Repeat size={12} /> {describeDays(item.recurrence.daysOfWeek)}
            </div>
          )}
        </div>
      </div>

      {done && (
        <Section>
          <div className="cell">
            <Check size={20} color="var(--success)" strokeWidth={2.6} />
            <span className="cell-body">Fait{session ? ` · ${formatDuration(session.durationMin)}` : ''}</span>
            {session && (
              <button
                className="btn btn-sm btn-secondary"
                id="slot-view-note"
                onClick={() => {
                  onClose()
                  navigate(`/note/${session.id}`)
                }}
              >
                <NotebookPen size={14} /> Note
              </button>
            )}
          </div>
        </Section>
      )}
      {skipped && (
        <Section>
          <div className="cell">
            <SkipForward size={20} className="muted" />
            <span className="cell-body">Créneau sauté</span>
          </div>
        </Section>
      )}

      {editing ? (
        <>
          <Section>
            <label className="cell">
              <span className="cell-body">Début</span>
              <input
                id="slot-edit-time"
                type="time"
                className="time-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </Section>
          <Section title="Durée">
            <div className="pad">
              <DurationPicker value={duration} onChange={setDuration} idPrefix="slot-edit-duration" />
            </div>
          </Section>
          {item.recurrence && (
            <div className="section chips">
              <button className="chip" id="slot-edit-scope-one" aria-pressed={scope === 'one'} onClick={() => setScope('one')}>
                Ce créneau seulement
              </button>
              <button className="chip" id="slot-edit-scope-series" aria-pressed={scope === 'series'} onClick={() => setScope('series')}>
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
        </>
      ) : (
        <>
          {!done && (
            <div className="section">
              <button className="btn btn-primary btn-lg btn-block" onClick={start} id="slot-start">
                <Play size={17} fill="currentColor" />
                {isActiveHere ? 'Reprendre la session' : 'Démarrer la session'}
              </button>
            </div>
          )}

          {!done && !isActiveHere && (
            <Section title="Décaler / Reporter">
              {nextFree && (
                <button
                  className="cell is-accent"
                  id="slot-postpone-free"
                  onClick={async () => {
                    await repo.updateOccurrence(item, { startMin: nextFree.startMin })
                    onClose()
                  }}
                >
                  <Sparkles size={20} />
                  <div className="cell-body">
                    <div className="cell-title">Prochain créneau libre</div>
                    <div className="cell-sub tabular">
                      {minutesToTime(nextFree.startMin)} – {minutesToTime(nextFree.startMin + item.durationMin)}
                    </div>
                  </div>
                  <span className="chip chip-sm is-active">
                    Décaler
                  </span>
                </button>
              )}
              <div className="pad row gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary grow"
                  id="slot-postpone-30m"
                  onClick={async () => {
                    await repo.updateOccurrence(item, {
                      startMin: Math.min(23 * 60 - item.durationMin, item.startMin + 30),
                    })
                    onClose()
                  }}
                >
                  +30 min
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary grow"
                  id="slot-postpone-1h"
                  onClick={async () => {
                    await repo.updateOccurrence(item, {
                      startMin: Math.min(23 * 60 - item.durationMin, item.startMin + 60),
                    })
                    onClose()
                  }}
                >
                  +1h
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary grow"
                  id="slot-postpone-tomorrow"
                  onClick={async () => {
                    await repo.updateOccurrence(item, { date: addDays(item.date, 1) })
                    onClose()
                  }}
                >
                  À demain
                </button>
              </div>
            </Section>
          )}

          <Section>
            {!done && !isActiveHere && (
              <button className="cell is-accent" onClick={markDone} id="slot-mark-done">
                <Check size={20} />
                <span className="cell-body">Marquer comme fait</span>
              </button>
            )}
            {!done && !skipped && !isActiveHere && (
              <button
                className="cell is-accent"
                id="slot-skip"
                onClick={async () => {
                  await repo.setSlotStatus(item, 'skipped')
                  onClose()
                }}
              >
                <SkipForward size={20} />
                <span className="cell-body">Sauter</span>
              </button>
            )}
            {skipped && (
              <button
                className="cell is-accent"
                id="slot-unskip"
                onClick={async () => {
                  await repo.setSlotStatus(item, 'planned')
                  onClose()
                }}
              >
                <Undo2 size={20} />
                <span className="cell-body">Rétablir</span>
              </button>
            )}
            {!done && !isActiveHere && (
              <button className="cell is-accent" onClick={() => setEditing(true)} id="slot-edit">
                <Clock size={20} />
                <span className="cell-body">Modifier l’horaire</span>
              </button>
            )}
          </Section>

          {!isActiveHere && (
            <Section>
              <button
                className="cell is-danger"
                id="slot-delete"
                onClick={async () => {
                  if (!confirm('Supprimer ce créneau ?')) return
                  await repo.deleteOccurrence(item)
                  onClose()
                }}
              >
                <Trash2 size={20} />
                <span className="cell-body">Supprimer ce créneau</span>
              </button>
              {item.recurrence && (
                <button
                  className="cell is-danger"
                  id="slot-delete-series"
                  onClick={async () => {
                    if (!confirm('Supprimer toute la série ? L’historique est conservé.')) return
                    await repo.deleteRecurrence(item.recurrence!.id)
                    onClose()
                  }}
                >
                  <Trash2 size={20} />
                  <span className="cell-body">Supprimer toute la série</span>
                </button>
              )}
            </Section>
          )}
        </>
      )}
    </Sheet>
  )
}
