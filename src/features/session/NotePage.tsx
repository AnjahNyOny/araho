import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Target, X, PartyPopper } from 'lucide-react'
import { TaskIcon, CONFIDENCE_LABELS } from '../../components/ui'
import { useTask } from '../../db/hooks'
import * as repo from '../../db/repo'
import { formatDuration, relativeDayLabel } from '../../lib/date'

export function NotePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(async () => {
    if (!sessionId) return null
    const session = await repo.getSession(sessionId)
    if (!session) return null
    const note = await repo.getNoteForSession(sessionId)
    const lastNextStep = await repo.getLastNextStep(session.taskId, sessionId)
    return { session, note: note ?? null, lastNextStep }
  }, [sessionId])
  const task = useTask(data?.session.taskId)

  const [learned, setLearned] = useState('')
  const [difficulties, setDifficulties] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [duration, setDuration] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!data || initialized) return
    setLearned(data.note?.learned ?? '')
    setDifficulties(data.note?.difficulties ?? '')
    setNextStep(data.note?.nextStep ?? '')
    setConfidence(data.note?.confidence ?? 0)
    setTags(data.note?.tags ?? [])
    setDuration(data.session.durationMin)
    setInitialized(true)
  }, [data, initialized])

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/', { replace: true })
  }

  if (data === undefined || task === undefined) return null
  if (data === null || task === null) {
    return (
      <div className="empty card">
        <h3>Session introuvable</h3>
        <button className="btn btn-secondary" onClick={() => navigate('/')} id="note-missing-home">
          Retour
        </button>
      </div>
    )
  }

  const { session, note, lastNextStep } = data
  const isNew = !note

  const addTag = () => {
    const t = tagDraft.trim().replace(/,$/, '').toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagDraft('')
  }

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !tagDraft && tags.length) {
      setTags(tags.slice(0, -1))
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const allTags = tagDraft.trim() ? [...tags, tagDraft.trim()] : tags
      if (duration !== session.durationMin) await repo.updateSessionDuration(session.id, duration)
      await repo.saveNote(session, { learned, difficulties, nextStep, confidence, tags: allTags })
      goBack()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="note-page animate-in" style={{ '--c': task.color } as CSSProperties}>
      <header className="row spread" style={{ marginBottom: 18 }}>
        <button className="icon-btn" onClick={goBack} aria-label="Retour" id="note-back">
          <ArrowLeft size={22} />
        </button>
        <span className="small muted">{relativeDayLabel(session.date)}</span>
        <span style={{ width: 40 }} />
      </header>

      <section className="note-hero card">
        <div className="note-hero-glow" />
        <TaskIcon task={task} size={56} />
        <div className="grow">
          {isNew && (
            <div className="eyebrow row" style={{ '--gap': '6px', color: 'var(--success)' } as CSSProperties}>
              <PartyPopper size={14} /> Session terminée
            </div>
          )}
          <h1 className="display" style={{ fontSize: 26 }}>{task.name}</h1>
          <label className="row small muted" style={{ '--gap': '8px', marginTop: 6 } as CSSProperties}>
            <span>Durée</span>
            <input
              id="note-duration"
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={720}
              value={duration || ''}
              onChange={(e) => setDuration(Number(e.target.value))}
              style={{ width: 80, padding: '6px 10px', fontSize: 15 }}
            />
            <span>min · {formatDuration(duration || 0)}</span>
          </label>
        </div>
      </section>

      {lastNextStep && (
        <div className="note-reminder">
          <Target size={15} />
          <span>
            <span className="faint">Tu avais prévu : </span>
            {lastNextStep}
          </span>
        </div>
      )}

      <form
        className="stack note-form"
        style={{ '--gap': '22px' } as CSSProperties}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="note-learned">
            Qu’as-tu appris ou accompli ?
          </label>
          <textarea
            id="note-learned"
            className="textarea"
            rows={5}
            autoFocus={isNew}
            placeholder="Ex. Les closures : une fonction garde l’accès aux variables de son scope parent…"
            value={learned}
            onChange={(e) => setLearned(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field-label">Niveau de compréhension</span>
          <div className="confidence">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                id={`note-confidence-${v}`}
                className="conf-btn"
                aria-pressed={confidence === v}
                onClick={() => setConfidence(confidence === v ? 0 : v)}
              >
                <span className="conf-num display">{v}</span>
                <span className="tiny">{CONFIDENCE_LABELS[v]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="note-difficulties">
            Difficultés / questions <span className="faint">(optionnel)</span>
          </label>
          <textarea
            id="note-difficulties"
            className="textarea"
            rows={3}
            placeholder="Ce qui bloque, ce qui reste flou…"
            value={difficulties}
            onChange={(e) => setDifficulties(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="note-next">
            Prochaine étape
          </label>
          <input
            id="note-next"
            className="input"
            placeholder="Ex. Pratiquer les closures avec 3 exercices"
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
          />
          <span className="tiny faint">Elle te sera rappelée au début de ta prochaine session.</span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="note-tags">
            Tags <span className="faint">(optionnel)</span>
          </label>
          <div className="tag-input">
            {tags.map((t) => (
              <span key={t} className="tag tag-removable">
                #{t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Retirer ${t}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              id="note-tags"
              value={tagDraft}
              placeholder={tags.length ? '' : 'closures, async…'}
              onChange={(e) => {
                const v = e.target.value
                if (!v.includes(',')) return setTagDraft(v)
                const parts = v.split(',').map((p) => p.trim().toLowerCase())
                const last = parts.pop() ?? ''
                setTags([...new Set([...tags, ...parts.filter(Boolean)])])
                setTagDraft(last)
              }}
              onKeyDown={onTagKey}
              onBlur={addTag}
            />
          </div>
        </div>

        <div className="note-actions">
          <button type="button" className="btn btn-ghost" onClick={goBack} id="note-skip">
            {isNew ? 'Plus tard' : 'Annuler'}
          </button>
          <button type="submit" className="btn btn-primary btn-lg grow" disabled={saving} id="note-save">
            Enregistrer la note
          </button>
        </div>
      </form>
    </div>
  )
}
