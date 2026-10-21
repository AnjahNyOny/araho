import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { TodayPage } from './features/today/TodayPage'
import { WeekPage } from './features/week/WeekPage'
import { TasksPage } from './features/tasks/TasksPage'
import { TaskDetailPage } from './features/tasks/TaskDetailPage'
import { JournalPage } from './features/journal/JournalPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { SessionPage } from './features/session/SessionPage'
import { NotePage } from './features/session/NotePage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Session en cours : plein écran sans barre de navigation */}
        <Route path="/session" element={<SessionPage />} />

        {/* Application principale avec Shell (sidebar sur Mac, tabs sur iPhone) */}
        <Route element={<AppShell />}>
          <Route index element={<TodayPage />} />
          <Route path="week" element={<WeekPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="note/:sessionId" element={<NotePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
