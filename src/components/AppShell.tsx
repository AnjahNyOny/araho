import type { CSSProperties } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, CalendarRange, LayoutGrid, NotebookPen, Settings, ChevronRight } from 'lucide-react'
import { useActiveSession, useNow, useTaskMap } from '../db/hooks'
import { elapsedMs } from '../db/repo'
import { formatClock } from '../lib/date'
import { TaskIcon } from './ui'

const NAV = [
  { to: '/', label: "Aujourd'hui", icon: CalendarDays, end: true, id: 'nav-today' },
  { to: '/week', label: 'Semaine', icon: CalendarRange, id: 'nav-week' },
  { to: '/tasks', label: 'Tâches', icon: LayoutGrid, id: 'nav-tasks' },
  { to: '/journal', label: 'Journal', icon: NotebookPen, id: 'nav-journal' },
]

export function AppShell() {
  const session = useActiveSession()
  const location = useLocation()
  const hasDock = !!session && !location.pathname.startsWith('/session')
  return (
    <div className={`shell ${hasDock ? 'has-dock' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <img src="/icons/icon-64.png" alt="" width={34} height={34} />
          <span className="display">Araho</span>
        </div>
        <nav className="side-nav">
          {NAV.map(({ to, label, icon: Icon, end, id }) => (
            <NavLink key={to} to={to} end={end} className="side-link" id={`${id}-side`}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="grow" />
        <NavLink to="/settings" className="side-link" id="nav-settings-side">
          <Settings size={19} />
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
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Mini-lecteur flottant de la session en cours (visible partout sauf sur l'écran de session). */
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
  const progress = Math.min(1, ms / (session.plannedMin * 60_000))

  return (
    <button
      className="dock animate-in"
      id="session-dock"
      onClick={() => navigate('/session')}
      style={{ '--c': task.color, '--p': progress } as CSSProperties}
    >
      <TaskIcon task={task} size={36} />
      <div className="grow" style={{ textAlign: 'left' }}>
        <div className="row small" style={{ '--gap': '6px' } as CSSProperties}>
          {session.pausedAt ? <span className="faint">En pause</span> : <span className="live-dot" />}
          <span className="truncate" style={{ fontWeight: 600 }}>{task.name}</span>
        </div>
        <div className="display tabular dock-time">{formatClock(ms)}</div>
      </div>
      <ChevronRight size={20} className="faint" />
      <span className="dock-progress" />
    </button>
  )
}
