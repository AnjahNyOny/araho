import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import * as repo from './repo'
import type { Task } from './types'
import type { ISODate } from '../lib/date'

/* Hooks réactifs : se mettent à jour automatiquement quand la base change. */

export function useTasks(includeArchived = false) {
  return useLiveQuery(() => repo.listTasks(includeArchived), [includeArchived])
}

export function useTaskMap(): Map<string, Task> | undefined {
  const tasks = useLiveQuery(() => repo.listTasks(true), [])
  return tasks ? new Map(tasks.map((t) => [t.id, t])) : undefined
}

export function useTask(id: string | undefined) {
  return useLiveQuery(() => (id ? repo.getTask(id).then((t) => t ?? null) : null), [id])
}

export function usePlan(dates: ISODate[]) {
  const key = dates.join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useLiveQuery(() => repo.getPlan(dates), [key])
}

export function useDayPlan(date: ISODate) {
  return useLiveQuery(() => repo.getDayPlan(date), [date])
}

export function useActiveSession() {
  return useLiveQuery(() => repo.getActiveSession(), [])
}

export function useSessions(filter?: { taskId?: string; dates?: ISODate[] }) {
  const key = `${filter?.taskId ?? ''}|${filter?.dates?.join(',') ?? ''}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useLiveQuery(() => repo.listSessions(filter), [key])
}

export function useNotes(taskId?: string) {
  return useLiveQuery(() => repo.listNotes(taskId), [taskId])
}

export function useChecklistGroups(taskId: string | undefined) {
  return useLiveQuery(() => (taskId ? repo.listChecklistGroups(taskId) : []), [taskId])
}

export function useRecurrences(taskId: string | undefined) {
  return useLiveQuery(() => (taskId ? repo.listRecurrences(taskId) : []), [taskId])
}

/** Horloge qui se rafraîchit toutes les `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
  return now
}
