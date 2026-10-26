import { useEffect, useState, type CSSProperties } from 'react'
import { Sheet } from '../../components/Sheet'
import { TaskGlyph, GLYPHS } from '../../components/TaskGlyph'
import { DaysPicker, DurationPicker, Section } from '../../components/ui'
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
  const [icon, setIcon] = useState<string>(DEFAULT_ICON)
  const [color, setColor] = useState<string>(DEFAULT_COLOR)
  const [goal, setGoal] = useState(60)
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [time, setTime] = useState('09:00')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(task?.name ?? '')
    setDescription(task?.description ?? '')
    const rawIcon = task?.icon || ''
    const cleanIcon = rawIcon.toLowerCase().replace(/[^a-z0-9]/g, '')
    setIcon(GLYPHS[rawIcon] ? rawIcon : GLYPHS[cleanIcon] ? cleanIcon : DEFAULT_ICON)
    setColor(task?.color || DEFAULT_COLOR)
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
            {editing ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="section">
          <div className="group">
            <div className="cell has-icon">
              <TaskGlyph icon={icon} color={color} size={30} />
              <input
                id="task-name"
                className="bare-input grow"
                placeholder="Nom (ex. Apprendre le JavaScript)"
                value={name}
                autoFocus={!editing}
                onChange={(e) => setName(e.target.value)}
                aria-label="Nom"
              />
            </div>
            <div className="cell">
              <input
                id="task-description"
                className="bare-input grow"
                placeholder="Objectif (optionnel)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-label="Objectif"
              />
            </div>
          </div>
        </div>

        <Section title="Couleur">
          <div className="pad">
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
        </Section>

        <Section title="Icône">
          <div className="pad">
            <div className="glyph-grid">
              {TASK_ICONS.map((key) => {
                const Icon = GLYPHS[key]
                return (
                  <button
                    key={key}
                    type="button"
                    className="glyph-btn"
                    id={`task-icon-${key}`}
                    aria-label={key}
                    aria-pressed={icon === key}
                    onClick={() => setIcon(key)}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </button>
                )
              })}
            </div>
          </div>
        </Section>

        <Section title="Objectif quotidien">
          <div className="pad">
            <DurationPicker value={goal} onChange={setGoal} idPrefix="task-goal" allowNone />
          </div>
        </Section>

        {!editing && goal > 0 && (
          <Section
            title="Planification automatique"
            footer="Crée un créneau récurrent de la durée de l’objectif. Choisis « Aucun » pour planifier toi-même."
          >
            <div className="pad stack" style={{ '--gap': '14px' } as CSSProperties}>
              <DaysPicker value={days} onChange={setDays} idPrefix="task-schedule" />
            </div>
            {days.length > 0 && (
              <label className="cell">
                <span className="cell-body">Heure de début</span>
                <input
                  id="task-schedule-time"
                  type="time"
                  className="time-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
            )}
          </Section>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
