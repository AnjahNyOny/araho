import { useEffect, useState, type CSSProperties } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Pause, Play, Square, X, Target, Trophy } from 'lucide-react'
import { ProgressRing } from '../../components/ProgressRing'
import { TaskIcon } from '../../components/ui'
import { useActiveSession, useNow, useTask } from '../../db/hooks'
import * as repo from '../../db/repo'
import { formatClock, formatDuration } from '../../lib/date'

export function SessionPage() {
  const session = useActiveSession()
  const task = useTask(session?.taskId)
  const now = useNow(1000)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const lastNextStep = useLiveQuery(
    () => (session ? repo.getLastNextStep(session.taskId) : ''),
    [session?.taskId],
  )

  useWakeLock(!!session && !session.pausedAt)

  const ms = session ? repo.elapsedMs(session, now) : 0
  const clock = formatClock(ms)

  useEffect(() => {
    if (!task) return
    const prev = document.title
    document.title = `${clock} · ${task.name}`
    return () => {
      document.title = prev
    }
  }, [clock, task])

  if (session === undefined) return null
  if (session === null) return <Navigate to="/" replace />
  if (!task) return null

  const plannedMs = session.plannedMin * 60_000
  const progress = ms / plannedMs
  const reached = progress >= 1
  const paused = !!session.pausedAt

  const finish = async () => {
    setBusy(true)
    const done = await repo.finishSession(session.id)
    navigate(`/note/${done.id}`, { replace: true })
  }

  const cancel = async () => {
    if (!confirm('Abandonner cette session ? Le temps ne sera pas comptabilisé.')) return
    await repo.cancelSession(session.id)
    navigate('/', { replace: true })
  }

  return (
    <div className="session-page" style={{ '--c': task.color } as CSSProperties}>
      <div className="session-aura" />
      <header className="session-top">
        <button
          className="icon-btn"
          onClick={() => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate('/'))}
          aria-label="Réduire"
          id="session-minimize"
        >
          <ChevronDown size={24} />
        </button>
        <div className="row" style={{ '--gap': '8px' } as CSSProperties}>
          {paused ? <span className="tag">En pause</span> : <span className="live-dot" />}
          <span className="small muted">Session en cours</span>
        </div>
        <button className="icon-btn" onClick={cancel} aria-label="Abandonner" id="session-cancel">
          <X size={22} />
        </button>
      </header>

      <div className="session-center">
        <div className="row session-task" style={{ '--gap': '12px' } as CSSProperties}>
          <TaskIcon task={task} size={44} />
          <h1 className="display">{task.name}</h1>
        </div>

        <ProgressRing value={progress} size={280} stroke={14} color={task.color} className={`session-ring ${paused ? 'is-paused' : ''}`}>
          <div>
            <div className="display tabular session-clock">{clock}</div>
            <div className="small muted">
              {reached ? (
                <span className="row" style={{ '--gap': '6px', justifyContent: 'center', color: 'var(--success)' } as CSSProperties}>
                  <Trophy size={14} /> Objectif atteint
                </span>
              ) : (
                <>sur {formatDuration(session.plannedMin)}</>
              )}
            </div>
          </div>
        </ProgressRing>

        {lastNextStep && (
          <div className="card card-pad session-goal animate-in">
            <div className="eyebrow row" style={{ '--gap': '6px' } as CSSProperties}>
              <Target size={13} /> Prévu la dernière fois
            </div>
            <p>{lastNextStep}</p>
          </div>
        )}
      </div>

      <footer className="session-controls">
        <button
          className="round-btn"
          onClick={() => (paused ? repo.resumeSession(session.id) : repo.pauseSession(session.id))}
          aria-label={paused ? 'Reprendre' : 'Pause'}
          id="session-toggle-pause"
        >
          {paused ? <Play size={26} fill="currentColor" /> : <Pause size={26} fill="currentColor" />}
        </button>
        <button className="btn btn-primary btn-lg session-finish" onClick={finish} disabled={busy} id="session-finish">
          <Square size={16} fill="currentColor" /> Terminer & noter
        </button>
      </footer>
    </div>
  )
}

/** Garde l'écran allumé pendant la session (Screen Wake Lock API, iOS 16.4+). */
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) lock.release()
      } catch {
        /* refusé (batterie faible, onglet caché…) */
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && acquire()
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [enabled])
}
