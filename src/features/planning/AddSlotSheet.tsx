import { useEffect, useState, type CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { DaysPicker, DurationPicker, Section, TaskIcon } from '../../components/ui'
import { useTasks } from '../../db/hooks'
import { addSlot } from '../../db/repo'
import { dayOfWeek, minutesToTime, nowMinutes, timeToMinutes, today, type ISODate } from '../../lib/date'

interface Props {
  open: boolean
  onClose: () => void
  date: ISODate
  taskId?: string
  initialStartMin?: number
  onNeedTask?: () => void
}

function defaultStart(date: ISODate, initialMin?: number): string {
  if (initialMin !== undefined) return minutesToTime(initialMin)
  if (date !== today()) return '09:00'
  const m = Math.ceil((nowMinutes() + 5) / 30) * 30
  return minutesToTime(Math.min(m, 23 * 60))
}

export function AddSlotSheet({ open, onClose, date, taskId, initialStartMin, onNeedTask }: Props) {
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
    setTime(defaultStart(date, initialStartMin))
    setRepeat(false)
    setDays([dayOfWeek(date)])
  }, [open, date, taskId, initialStartMin])

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
        <>
          <Section title="Tâche">
            {tasks?.map((t) => (
              <button
                key={t.id}
                type="button"
                className="cell has-icon"
                id={`add-slot-task-${t.id}`}
                aria-pressed={selected === t.id}
                onClick={() => setSelected(t.id)}
              >
                <TaskIcon task={t} size={30} />
                <span className="cell-body truncate">{t.name}</span>
                {selected === t.id && <Check size={20} color="var(--accent)" strokeWidth={2.4} />}
              </button>
            ))}
          </Section>

          <Section>
            <label className="cell">
              <span className="cell-body">{repeat ? 'À partir du' : 'Jour'}</span>
              <input
                id="add-slot-date"
                type="date"
                className="time-input"
                value={day}
                onChange={(e) => e.target.value && setDay(e.target.value)}
              />
            </label>
            <label className="cell">
              <span className="cell-body">Début</span>
              <input
                id="add-slot-time"
                type="time"
                className="time-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </Section>

          <Section title="Durée">
            <div className="pad">
              <DurationPicker value={duration} onChange={setDuration} idPrefix="add-slot-duration" />
            </div>
          </Section>

          <Section footer={repeat ? undefined : 'Crée une série de créneaux réguliers.'}>
            <label className="cell" htmlFor="add-slot-repeat">
              <span className="cell-body">Répéter</span>
              <input
                id="add-slot-repeat"
                type="checkbox"
                className="switch"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
            </label>
            {repeat && (
              <div className="pad stack" style={{ '--gap': '12px' } as CSSProperties}>
                <DaysPicker value={days} onChange={setDays} idPrefix="add-slot-repeat" />
              </div>
            )}
          </Section>
        </>
      )}
    </Sheet>
  )
}
