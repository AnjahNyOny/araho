import type { CSSProperties } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, CalendarRange, ListChecks, BookText, Settings, ChevronRight } from 'lucide-react'
import { useActiveSession, useNow, useTaskMap } from '../db/hooks'
import { elapsedMs } from '../db/repo'
import { formatClock } from '../lib/date'
import { TaskIcon } from './ui'
import { useAuth } from '../lib/supabase'
import { syncAll } from '../db/sync'
import { useSlotReminders } from '../lib/reminders'
import { useEffect } from 'react'

const NAV = [
  { to: '/', label: "Aujourd'hui", icon: CalendarDays, end: true, id: 'nav-today' },
  { to: '/week', label: 'Semaine', icon: CalendarRange, id: 'nav-week' },
  { to: '/tasks', label: 'Tâches', icon: ListChecks, id: 'nav-tasks' },
  { to: '/journal', label: 'Journal', icon: BookText, id: 'nav-journal' },
]

export function AppShell() {
  const session = useActiveSession()
  const location = useLocation()
  const { user } = useAuth()

  // Rappels automatiques 5 min avant le début d'un créneau
  useSlotReminders()

  // Synchronisation automatique en tâche de fond multi-appareils dès qu'un compte est connecté
  useEffect(() => {
    if (!user) return

    // Synchro immédiate à l'ouverture
    syncAll(user.id)

    // Synchro périodique (toutes les 45 secondes)
    const interval = setInterval(() => {
      syncAll(user.id)
    }, 45_000)

    // Synchro lors du retour sur l'onglet/l'app (sur Mac ou iPhone)
    const onFocus = () => {
      syncAll(user.id)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [user])

  const hasDock = !!session && !location.pathname.startsWith('/session')
  return (
    <div className={`shell ${hasDock ? 'has-dock' : ''}`}>
      <aside className="sidebar">
        <div className="brand">Araho</div>
        <nav className="side-nav">
          {NAV.map(({ to, label, icon: Icon, end, id }) => (
            <NavLink key={to} to={to} end={end} className="side-link" id={`${id}-side`}>
              <Icon size={19} strokeWidth={1.9} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="grow" />
        <NavLink to="/settings" className="side-link" id="nav-settings-side">
          <Settings size={19} strokeWidth={1.9} />
          <span>Réglages</span>
        </NavLink>
      </aside>

      <main className="main">
        <div className="content">
          <Outlet />
        </div>
      </main>

      <SessionDock />

      <nav className="tabbar">
        {NAV.map(({ to, label, icon: Icon, end, id }) => (
          <NavLink key={to} to={to} end={end} className="tab" id={id}>
            <Icon size={24} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/settings" className="tab" id="nav-settings">
          <Settings size={24} strokeWidth={1.8} />
          <span>Réglages</span>
        </NavLink>
      </nav>
    </div>
  )
}

/** Mini-lecteur de la session en cours (comme le lecteur de Musique). */
function SessionDock() {
  const session = useActiveSession()
  const tasks = useTaskMap()
  const now = useNow(1000)
  const location = useLocation()
  const navigate = useNavigate()

  if (!session || location.pathname.startsWith('/session')) return null
  const task = tasks?.get(session.taskId)
  if (!task) return null
  const ms = elapsedMs(session, now)

  return (
    <button className="dock" id="session-dock" onClick={() => navigate('/session')} style={{ '--c': task.color } as CSSProperties}>
      <TaskIcon task={task} size={34} />
      <div className="grow">
        <div className="dock-title truncate">{task.name}</div>
        <div className="tiny muted row gap-2">
          {session.pausedAt ? <span>En pause</span> : <span className="live-dot" />}
          <span className="tabular">{formatClock(ms)}</span>
        </div>
      </div>
      <ChevronRight size={20} className="cell-chevron" />
    </button>
  )
}
