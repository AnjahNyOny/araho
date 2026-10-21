import { useEffect, useState, type CSSProperties } from 'react'
import { Sheet } from '../../components/Sheet'
import { DaysPicker, DurationPicker, TaskIcon } from '../../components/ui'
import { createTask, updateTask } from '../../db/repo'
import type { Task } from '../../db/types'
import { DEFAULT_COLOR, DEFAULT_ICON, TASK_COLORS, TASK_ICONS } from '../../lib/palette'
import { minutesToTime, timeToMinutes } from '../../lib/date'

interface Props {
  open: boolean
  onClose: () => void
  /** Si fourni : mode édition. */
  task?: Task | null
  onCreated?: (task: Task) => void
}

export function TaskFormSheet({ open, onClose, task, onCreated }: Props) {
  const editing = !!task
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState(DEFAULT_ICON)
  const [color, setColor] = useState<string>(DEFAULT_COLOR)
  const [goal, setGoal] = useState(60)
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [time, setTime] = useState('09:00')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(task?.name ?? '')
    setDescription(task?.description ?? '')
    setIcon(task?.icon ?? DEFAULT_ICON)
    setColor(task?.color ?? DEFAULT_COLOR)
    setGoal(task?.dailyGoalMin ?? 60)
    setDays([0, 1, 2, 3, 4, 5, 6])
    setTime(minutesToTime(9 * 60))
  }, [open, task])

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const input = { name: name.trim(), description: description.trim(), icon, color, dailyGoalMin: goal }
      if (editing && task) {
        await updateTask(task.id, input)
      } else {
        const created = await createTask(
          input,
          goal > 0 && days.length ? { daysOfWeek: days, startMin: timeToMinutes(time), durationMin: goal } : undefined,
        )
        onCreated?.(created)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      id="task-form"
      title={editing ? 'Modifier la tâche' : 'Nouvelle tâche'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} id="task-form-cancel">
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!name.trim() || saving} id="task-form-submit">
            {editing ? 'Enregistrer' : 'Créer la tâche'}
          </button>
        </>
      }
    >
      <form
        className="stack"
        style={{ '--gap': '22px' } as CSSProperties}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="row" style={{ '--gap': '14px' } as CSSProperties}>
          <TaskIcon task={{ icon, color }} size={56} />
          <div className="field grow">
            <label className="field-label" htmlFor="task-name">
              Nom
            </label>
            <input
              id="task-name"
              className="input"
              placeholder="Ex. Apprendre le JavaScript"
              value={name}
              autoFocus={!editing}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="task-description">
            Objectif / description <span className="faint">(optionnel)</span>
          </label>
          <input
            id="task-description"
            className="input"
            placeholder="Ex. Être capable de créer une app React"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field-label">Couleur</span>
          <div className="swatches">
            {TASK_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className="swatch"
                id={`task-color-${c.name.toLowerCase()}`}
                aria-label={c.name}
                aria-pressed={color === c.value}
                style={{ '--c': c.value } as CSSProperties}
                onClick={() => setColor(c.value)}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Icône</span>
          <div className="emoji-grid">
            {TASK_ICONS.map((e, i) => (
              <button
                key={e}
                type="button"
                className="emoji-btn"
                id={`task-icon-${i}`}
                aria-pressed={icon === e}
                onClick={() => setIcon(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Objectif quotidien</span>
          <DurationPicker value={goal} onChange={setGoal} idPrefix="task-goal" allowNone />
        </div>

        {!editing && goal > 0 && (
          <div className="card card-pad stack" style={{ '--gap': '14px' } as CSSProperties}>
            <div>
              <div style={{ fontWeight: 600 }}>Planifier automatiquement</div>
              <p className="small muted">
                Crée un créneau récurrent de la durée de l’objectif. Choisis « Aucun » pour planifier toi-même.
              </p>
            </div>
            <DaysPicker value={days} onChange={setDays} idPrefix="task-schedule" />
            {days.length > 0 && (
              <label className="row" style={{ '--gap': '10px' } as CSSProperties}>
                <span className="small muted">À</span>
                <input
                  id="task-schedule-time"
                  type="time"
                  className="input"
                  style={{ maxWidth: 140 }}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
            )}
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
