import { useEffect, useState, type CSSProperties } from 'react'
import { Sheet } from '../../components/Sheet'
import { DaysPicker, DurationPicker, TaskIcon } from '../../components/ui'
import { useTasks } from '../../db/hooks'
import { addSlot } from '../../db/repo'
import { dayOfWeek, minutesToTime, nowMinutes, timeToMinutes, today, type ISODate } from '../../lib/date'

interface Props {
  open: boolean
  onClose: () => void
  date: ISODate
  taskId?: string
  onNeedTask?: () => void
}

function defaultStart(date: ISODate): string {
  if (date !== today()) return '09:00'
  const m = Math.ceil((nowMinutes() + 5) / 30) * 30
  return minutesToTime(Math.min(m, 23 * 60))
}

export function AddSlotSheet({ open, onClose, date, taskId, onNeedTask }: Props) {
  const tasks = useTasks()
  const [selected, setSelected] = useState<string | undefined>(taskId)
  const [day, setDay] = useState<ISODate>(date)
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [repeat, setRepeat] = useState(false)
  const [days, setDays] = useState<number[]>([])

  useEffect(() => {
    if (!open) return
    setSelected(taskId)
    setDay(date)
    setTime(defaultStart(date))
    setRepeat(false)
    setDays([dayOfWeek(date)])
  }, [open, date, taskId])

  // Pré-remplit la durée avec l'objectif de la tâche choisie
  useEffect(() => {
    const t = tasks?.find((x) => x.id === selected)
    if (t?.dailyGoalMin) setDuration(t.dailyGoalMin)
  }, [selected, tasks])

  useEffect(() => {
    if (open && tasks && tasks.length && !selected) setSelected(tasks[0].id)
  }, [open, tasks, selected])

  const submit = async () => {
    if (!selected) return
    await addSlot({
      taskId: selected,
      date: day,
      startMin: timeToMinutes(time),
      durationMin: Math.max(5, duration),
      repeatDays: repeat ? days : [],
    })
    onClose()
  }

  const noTasks = tasks && tasks.length === 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      id="add-slot"
      title="Nouveau créneau"
      footer={
        noTasks ? undefined : (
          <>
            <button className="btn btn-secondary" onClick={onClose} id="add-slot-cancel">
              Annuler
            </button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!selected || (repeat && !days.length)}
              id="add-slot-submit"
            >
              Planifier
            </button>
          </>
        )
      }
    >
      {noTasks ? (
        <div className="stack" style={{ textAlign: 'center', padding: '12px 0 8px' }}>
          <p className="muted">Crée d’abord une tâche pour pouvoir lui allouer des créneaux.</p>
          <button
            className="btn btn-primary"
            id="add-slot-create-task"
            onClick={() => {
              onClose()
              onNeedTask?.()
            }}
          >
            Créer une tâche
          </button>
        </div>
      ) : (
        <div className="stack" style={{ '--gap': '22px' } as CSSProperties}>
          <div className="field">
            <span className="field-label">Tâche</span>
            <div className="task-picker">
              {tasks?.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="task-pick"
                  id={`add-slot-task-${t.id}`}
                  aria-pressed={selected === t.id}
                  style={{ '--c': t.color } as CSSProperties}
                  onClick={() => setSelected(t.id)}
                >
                  <TaskIcon task={t} size={30} />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="row" style={{ '--gap': '12px', alignItems: 'flex-end' } as CSSProperties}>
            <label className="field grow">
              <span className="field-label">{repeat ? 'À partir du' : 'Jour'}</span>
              <input
                id="add-slot-date"
                type="date"
                className="input"
                value={day}
                onChange={(e) => e.target.value && setDay(e.target.value)}
              />
            </label>
            <label className="field" style={{ width: 130 }}>
              <span className="field-label">Début</span>
              <input
                id="add-slot-time"
                type="time"
                className="input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>

          <div className="field">
            <span className="field-label">Durée</span>
            <DurationPicker value={duration} onChange={setDuration} idPrefix="add-slot-duration" />
          </div>

          <div className="stack" style={{ '--gap': '12px' } as CSSProperties}>
            <label className="toggle-row" htmlFor="add-slot-repeat">
              <span>
                <span style={{ fontWeight: 600 }}>Répéter</span>
                <span className="small muted" style={{ display: 'block' }}>
                  Crée une série de créneaux réguliers
                </span>
              </span>
              <input
                id="add-slot-repeat"
                type="checkbox"
                className="switch"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
            </label>
            {repeat && <DaysPicker value={days} onChange={setDays} idPrefix="add-slot-repeat" />}
          </div>
        </div>
      )}
    </Sheet>
  )
}
