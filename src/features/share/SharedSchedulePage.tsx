import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { fetchSharedSchedule, type SharedData } from '../../db/share'
import {
  addDays,
  formatCalendarHeader,
  minutesToTime,
  nowMinutes,
  today,
  weekDatesSunday,
  type ISODate,
} from '../../lib/date'

const TIMELINE_START_HOUR = 6
const TIMELINE_END_HOUR = 23
const HOUR_HEIGHT = 64
const TIMELINE_TOP_PAD = 10

const HOURS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
  (_, i) => TIMELINE_START_HOUR + i,
)

export function SharedSchedulePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<SharedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<ISODate>(today())

  const weekDays = useMemo(() => weekDatesSunday(selectedDate), [selectedDate])
  const nowMin = nowMinutes(new Date())
  const isToday = selectedDate === today()

  // Charger les données de la semaine
  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetchSharedSchedule(token, weekDays[0], weekDays[6])
      .then((res) => {
        if (!res || res.error) {
          setError(res?.error || 'Lien de partage introuvable ou expiré.')
        } else {
          setData(res)
          setError(null)
        }
      })
      .catch((err) => {
        console.error(err)
        setError('Impossible de charger le planning partagé.')
      })
      .finally(() => setLoading(false))
  }, [token, weekDays])

  // Mapping des tâches par ID
  const tasksMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; icon: string }>()
    for (const t of data?.tasks ?? []) map.set(t.id, t)
    return map
  }, [data?.tasks])

  // Créneaux du jour sélectionné
  const currentSlots = useMemo(() => {
    const list = (data?.slots ?? []).filter((s) => s.date === selectedDate)
    return [...list].sort((a, b) => a.startMin - b.startMin)
  }, [data?.slots, selectedDate])

  // Calcul du statut de disponibilité en temps réel (Aujourd'hui)
  const availabilityStatus = useMemo(() => {
    if (!data) return null

    // 1. Session active en direct
    if (data.activeSession) {
      return {
        type: 'busy' as const,
        title: `En session : ${data.activeSession.taskName}`,
        detail: 'Session en cours',
        color: data.activeSession.taskColor || 'var(--sys-blue)',
      }
    }

    // 2. Créneau en cours en ce moment
    const todaySlots = (data.slots ?? []).filter((s) => s.date === today())
    const ongoingSlot = todaySlots.find(
      (s) => nowMin >= s.startMin && nowMin < s.startMin + s.durationMin && s.status !== 'skipped'
    )
    if (ongoingSlot) {
      const task = tasksMap.get(ongoingSlot.taskId)
      const endFormatted = minutesToTime(ongoingSlot.startMin + ongoingSlot.durationMin)
      return {
        type: 'busy' as const,
        title: `En créneau : ${task?.name || 'Tâche'}`,
        detail: `Occupé(e) jusqu'à ${endFormatted}`,
        color: task?.color || 'var(--sys-blue)',
      }
    }

    // 3. Prochain créneau à venir
    const upcoming = todaySlots
      .filter((s) => s.startMin > nowMin && s.status !== 'skipped')
      .sort((a, b) => a.startMin - b.startMin)[0]

    if (upcoming) {
      const task = tasksMap.get(upcoming.taskId)
      const startFormatted = minutesToTime(upcoming.startMin)
      return {
        type: 'free' as const,
        title: 'Actuellement libre',
        detail: `Prochaine activité : ${task?.name || 'Tâche'} à ${startFormatted}`,
        color: 'var(--sys-green)',
      }
    }

    // 4. Libre pour le reste de la journée
    return {
      type: 'free' as const,
      title: 'Actuellement libre',
      detail: 'Aucun créneau restant aujourd’hui',
      color: 'var(--sys-green)',
    }
  }, [data, nowMin, tasksMap])

  // Position du marqueur temps réel
  const nowTopPx = TIMELINE_TOP_PAD + (nowMin - TIMELINE_START_HOUR * 60) * (HOUR_HEIGHT / 60)
  const showNowLine =
    isToday &&
    nowMin >= TIMELINE_START_HOUR * 60 &&
    nowMin <= (TIMELINE_END_HOUR + 1) * 60

  if (loading && !data) {
    return (
      <div className="shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p className="muted">Chargement du planning partagé…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 20 }}>
        <div className="group pad" style={{ maxWidth: 400, textAlign: 'center' }}>
          <Lock size={40} style={{ color: 'var(--sys-red)', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Accès impossible</h2>
          <p className="muted" style={{ fontSize: 15 }}>{error || 'Ce lien de partage n’est plus actif.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="shell" style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 60 }}>
      {/* 1. Header Apple Partagé */}
      <header style={{ padding: '16px 20px 8px', borderBottom: '0.5px solid var(--separator)' }}>
        <div className="row spread">
          <div>
            <div className="caption" style={{ color: 'var(--sys-blue)' }}>
              Accès lecture seule · {data.label}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.01, marginTop: 2 }}>
              Planning de {data.ownerName}
            </h1>
          </div>
          <div className="row" style={{ gap: 4 }}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              aria-label="Semaine précédente"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              aria-label="Semaine suivante"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Badge de disponibilité temps réel */}
        {availabilityStatus && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--bg-cell)',
              border: '0.5px solid var(--separator)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: availabilityStatus.color,
                boxShadow: `0 0 8px ${availabilityStatus.color}`,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{availabilityStatus.title}</div>
              <div className="muted" style={{ fontSize: 13 }}>{availabilityStatus.detail}</div>
            </div>
          </div>
        )}
      </header>

      {/* 2. Bandeau 7 jours de la semaine */}
      <div className="cal-week-strip" style={{ padding: '8px 12px 10px' }} role="tablist">
        {weekDays.map((dStr, idx) => {
          const isSelected = dStr === selectedDate
          const dayDate = new Date(dStr + 'T12:00:00')
          const dayLetter = ['D', 'L', 'M', 'M', 'J', 'V', 'S'][idx]
          const dayNum = dayDate.getDate()
          const hasSlots = (data.slots ?? []).some((s) => s.date === dStr)

          return (
            <button
              key={dStr}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`cal-day-cell ${isSelected ? 'is-selected' : ''}`}
              onClick={() => setSelectedDate(dStr)}
            >
              <span className="cal-day-letter">{dayLetter}</span>
              <span className="cal-day-num">{dayNum}</span>
              <span className={`cal-day-dot ${hasSlots ? 'has-events' : ''}`} />
            </button>
          )
        })}
      </div>

      {/* 3. Titre du jour sélectionné */}
      <div className="cal-day-title">
        {formatCalendarHeader(selectedDate)}
      </div>

      {/* 4. Timeline horaire en lecture seule */}
      <div className="cal-timeline-wrap" style={{ height: 'calc(100dvh - 280px)', minHeight: 460 }}>
        <div
          className="cal-timeline"
          style={{ height: TIMELINE_TOP_PAD + (TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1) * HOUR_HEIGHT + 40 }}
        >
          {/* Lignes d'heures */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="cal-hour-row"
              style={{ top: TIMELINE_TOP_PAD + (h - TIMELINE_START_HOUR) * HOUR_HEIGHT }}
            >
              <span className="cal-hour-label">{String(h).padStart(2, '0')}:00</span>
              <div className="cal-hour-line" />
            </div>
          ))}

          {/* Ligne rouge temps réel */}
          {showNowLine && (
            <div className="cal-now-line" style={{ top: nowTopPx }}>
              <span className="cal-now-badge">{minutesToTime(nowMin)}</span>
            </div>
          )}

          {/* Créneaux */}
          {currentSlots.map((item) => {
            const task = tasksMap.get(item.taskId)
            if (!task) return null

            const top = TIMELINE_TOP_PAD + (item.startMin - TIMELINE_START_HOUR * 60) * (HOUR_HEIGHT / 60)
            const isCompact = item.durationMin <= 35
            const height = Math.max(isCompact ? 28 : 46, item.durationMin * (HOUR_HEIGHT / 60) - 2)
            const done = item.status === 'done'

            return (
              <div
                key={item.id}
                className={`cal-event ${isCompact ? 'is-compact' : 'is-standard'}`}
                style={
                  {
                    '--c': task.color,
                    top,
                    height,
                    cursor: 'default',
                  } as CSSProperties
                }
              >
                {isCompact ? (
                  <div className="cal-event-row">
                    <span className="cal-event-title truncate">{task.name}</span>
                    <span className="cal-event-bullet">·</span>
                    <span className="cal-event-time">
                      {minutesToTime(item.startMin)} – {minutesToTime(item.startMin + item.durationMin)}
                    </span>
                    {done && (
                      <span className="cal-event-check">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="cal-event-stack">
                    <div className="row spread" style={{ alignItems: 'flex-start' }}>
                      <span className="cal-event-title truncate">{task.name}</span>
                      {done && (
                        <span className="cal-event-check">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <span className="cal-event-time">
                      {minutesToTime(item.startMin)} – {minutesToTime(item.startMin + item.durationMin)}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 5. Bouton Aujourd'hui si navigué ailleurs */}
      {!isToday && (
        <button
          type="button"
          className="cal-today-pill"
          onClick={() => setSelectedDate(today())}
        >
          Aujourd’hui
        </button>
      )}
    </div>
  )
}
