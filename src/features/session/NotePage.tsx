import { useEffect, useState, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Target, X } from 'lucide-react'
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
      <div className="empty">
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
    <div className="note-page animate-in">
      <header className="nav-bar">
        <button className="btn btn-ghost btn-back" onClick={goBack} id="note-back">
          <ChevronLeft size={24} /> Retour
        </button>
        <button type="button" className="btn btn-ghost strong" onClick={save} disabled={saving} id="note-save-top">
          OK
        </button>
      </header>

      <div className="page-header">
        <div className="grow">
          <div className="caption">{isNew ? 'Session terminée' : 'Note'} · {relativeDayLabel(session.date)}</div>
          <h1 className="page-title">{task.name}</h1>
        </div>
        <TaskIcon task={task} size={44} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <section className="section">
          <div className="group">
            <label className="cell">
              <span className="cell-body">Durée</span>
              <input
                id="note-duration"
                className="num-input tabular"
                type="number"
                inputMode="numeric"
                min={1}
                max={720}
                value={duration || ''}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
              <span className="cell-value">min</span>
            </label>
          </div>
          <div className="group-footer">{formatDuration(duration || 0)} de travail effectif</div>
        </section>

        {lastNextStep && (
          <section className="section">
            <div className="group-title">Prévu la dernière fois</div>
            <div className="group">
              <div className="cell">
                <Target size={18} className="muted" />
                <span className="cell-body small">{lastNextStep}</span>
              </div>
            </div>
          </section>
        )}

        <section className="section">
          <label className="group-title" htmlFor="note-learned">Qu’as-tu appris ou accompli ?</label>
          <textarea
            id="note-learned"
            className="textarea"
            rows={5}
            autoFocus={isNew}
            placeholder="Ex. Les closures : une fonction garde l’accès aux variables de son scope parent…"
            value={learned}
            onChange={(e) => setLearned(e.target.value)}
          />
        </section>

        <section className="section">
          <div className="group-title">Niveau de compréhension</div>
          <div className="segmented" role="group" aria-label="Niveau de compréhension">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                id={`note-confidence-${v}`}
                aria-pressed={confidence === v}
                onClick={() => setConfidence(confidence === v ? 0 : v)}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="group-footer">{confidence ? CONFIDENCE_LABELS[confidence] : '1 = flou · 5 = maîtrisé'}</div>
        </section>

        <section className="section">
          <label className="group-title" htmlFor="note-difficulties">Difficultés / questions</label>
          <textarea
            id="note-difficulties"
            className="textarea is-short"
            rows={3}
            placeholder="Ce qui bloque, ce qui reste flou…"
            value={difficulties}
            onChange={(e) => setDifficulties(e.target.value)}
          />
        </section>

        <section className="section">
          <label className="group-title" htmlFor="note-next">Prochaine étape</label>
          <input
            id="note-next"
            className="input"
            placeholder="Ex. Pratiquer les closures avec 3 exercices"
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
          />
          <div className="group-footer">Elle te sera rappelée au début de ta prochaine session.</div>
        </section>

        <section className="section">
          <label className="group-title" htmlFor="note-tags">Tags</label>
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
        </section>

        <div className="stack gap-2">
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={saving} id="note-save">
            Enregistrer la note
          </button>
          {isNew && (
            <button type="button" className="btn btn-ghost btn-block" onClick={goBack} id="note-skip">
              Plus tard
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
