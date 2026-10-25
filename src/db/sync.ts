import { db } from './db'
import { supabase } from '../lib/supabase'
import type { Task, Slot, Recurrence, Session, Note } from './types'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export interface SyncState {
  status: SyncStatus
  lastSyncAt: number | null
  error: string | null
}

let syncState: SyncState = {
  status: 'idle',
  lastSyncAt: null,
  error: null,
}

const listeners = new Set<(state: SyncState) => void>()

function notify() {
  for (const listener of listeners) listener({ ...syncState })
}

export function subscribeSyncState(fn: (state: SyncState) => void) {
  listeners.add(fn)
  fn({ ...syncState })
  return () => {
    listeners.delete(fn)
  }
}

/** Pousse les données locales non synchronisées ou existantes vers Supabase */
export async function pushToSupabase(userId: string): Promise<void> {
  if (!supabase) return

  // 1. Tasks
  const localTasks = await db.tasks.toArray()
  if (localTasks.length > 0) {
    const payload = localTasks.map((t) => ({
      id: t.id,
      user_id: userId,
      name: t.name,
      description: t.description,
      icon: t.icon,
      color: t.color,
      daily_goal_min: t.dailyGoalMin,
      start_date: t.startDate,
      archived: Boolean(t.archived),
      updated_at: new Date(t.updatedAt).toISOString(),
    }))
    const { error } = await supabase.from('tasks').upsert(payload, { onConflict: 'id' })
    if (error) console.error('Sync tasks error:', error)
  }

  // 2. Recurrences
  const localRecs = await db.recurrences.toArray()
  if (localRecs.length > 0) {
    const payload = localRecs.map((r) => ({
      id: r.id,
      user_id: userId,
      task_id: r.taskId,
      days_of_week: r.daysOfWeek,
      start_min: r.startMin,
      duration_min: r.durationMin,
      from_date: r.fromDate,
      until_date: r.untilDate,
    }))
    const { error } = await supabase.from('recurrences').upsert(payload, { onConflict: 'id' })
    if (error) console.error('Sync recurrences error:', error)
  }

  // 3. Slots
  const localSlots = await db.slots.toArray()
  if (localSlots.length > 0) {
    const payload = localSlots.map((s) => ({
      id: s.id,
      user_id: userId,
      task_id: s.taskId,
      date: s.date,
      start_min: s.startMin,
      duration_min: s.durationMin,
      status: s.status,
      recurrence_id: s.recurrenceId,
      updated_at: new Date(s.updatedAt).toISOString(),
    }))
    const { error } = await supabase.from('slots').upsert(payload, { onConflict: 'id' })
    if (error) console.error('Sync slots error:', error)
  }

  // 4. Sessions
  const localSessions = await db.sessions.toArray()
  if (localSessions.length > 0) {
    const payload = localSessions.map((s) => ({
      id: s.id,
      user_id: userId,
      task_id: s.taskId,
      slot_id: s.slotId,
      date: s.date,
      status: s.status,
      started_at: new Date(s.startedAt).toISOString(),
      ended_at: s.endedAt ? new Date(s.endedAt).toISOString() : null,
      duration_min: s.durationMin,
    }))
    const { error } = await supabase.from('sessions').upsert(payload, { onConflict: 'id' })
    if (error) console.error('Sync sessions error:', error)
  }

  // 5. Notes
  const localNotes = await db.notes.toArray()
  if (localNotes.length > 0) {
    const payload = localNotes.map((n) => ({
      id: n.id,
      user_id: userId,
      session_id: n.sessionId,
      task_id: n.taskId,
      date: n.date,
      learned: n.learned,
      difficulties: n.difficulties,
      next_step: n.nextStep,
      confidence: n.confidence,
      tags: n.tags,
    }))
    const { error } = await supabase.from('notes').upsert(payload, { onConflict: 'id' })
    if (error) console.error('Sync notes error:', error)
  }
}

/** Récupère les données distantes de Supabase et met à jour Dexie */
export async function pullFromSupabase(userId: string): Promise<void> {
  if (!supabase) return

  // 1. Tasks
  const { data: remoteTasks } = await supabase.from('tasks').select('*').eq('user_id', userId)
  if (remoteTasks) {
    for (const r of remoteTasks) {
      const local: Task = {
        id: r.id,
        userId: r.user_id,
        name: r.name,
        description: r.description || '',
        icon: r.icon || 'code',
        color: r.color || '#007AFF',
        dailyGoalMin: r.daily_goal_min || 0,
        startDate: r.start_date,
        archived: r.archived ? 1 : 0,
        createdAt: new Date(r.created_at).getTime(),
        updatedAt: new Date(r.updated_at).getTime(),
        deleted: 0,
      }
      await db.tasks.put(local)
    }
  }

  // 2. Recurrences
  const { data: remoteRecs } = await supabase.from('recurrences').select('*').eq('user_id', userId)
  if (remoteRecs) {
    for (const r of remoteRecs) {
      const local: Recurrence = {
        id: r.id,
        userId: r.user_id,
        taskId: r.task_id,
        daysOfWeek: r.days_of_week || [],
        startMin: r.start_min,
        durationMin: r.duration_min,
        fromDate: r.from_date,
        untilDate: r.until_date,
        createdAt: new Date(r.created_at).getTime(),
        updatedAt: new Date(r.created_at).getTime(),
        deleted: 0,
      }
      await db.recurrences.put(local)
    }
  }

  // 3. Slots
  const { data: remoteSlots } = await supabase.from('slots').select('*').eq('user_id', userId)
  if (remoteSlots) {
    for (const r of remoteSlots) {
      const local: Slot = {
        id: r.id,
        userId: r.user_id,
        taskId: r.task_id,
        date: r.date,
        startMin: r.start_min,
        durationMin: r.duration_min,
        status: r.status,
        recurrenceId: r.recurrence_id,
        createdAt: new Date(r.created_at).getTime(),
        updatedAt: new Date(r.updated_at).getTime(),
        deleted: 0,
      }
      await db.slots.put(local)
    }
  }

  // 4. Sessions
  const { data: remoteSessions } = await supabase.from('sessions').select('*').eq('user_id', userId)
  if (remoteSessions) {
    for (const r of remoteSessions) {
      const local: Session = {
        id: r.id,
        userId: r.user_id,
        taskId: r.task_id,
        slotId: r.slot_id,
        date: r.date,
        status: r.status,
        startedAt: new Date(r.started_at).getTime(),
        endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
        pausedMs: 0,
        pausedAt: null,
        plannedMin: r.duration_min,
        durationMin: r.duration_min,
        createdAt: new Date(r.created_at).getTime(),
        updatedAt: new Date(r.created_at).getTime(),
        deleted: 0,
      }
      await db.sessions.put(local)
    }
  }

  // 5. Notes
  const { data: remoteNotes } = await supabase.from('notes').select('*').eq('user_id', userId)
  if (remoteNotes) {
    for (const r of remoteNotes) {
      const local: Note = {
        id: r.id,
        userId: r.user_id,
        sessionId: r.session_id,
        taskId: r.task_id,
        date: r.date,
        learned: r.learned || '',
        difficulties: r.difficulties || '',
        nextStep: r.next_step || '',
        confidence: r.confidence || 3,
        tags: r.tags || [],
        createdAt: new Date(r.created_at).getTime(),
        updatedAt: new Date(r.created_at).getTime(),
        deleted: 0,
      }
      await db.notes.put(local)
    }
  }
}

/** Synchronisation globale bi-directionnelle */
export async function syncAll(userId: string): Promise<boolean> {
  if (!supabase) return false
  syncState = { ...syncState, status: 'syncing', error: null }
  notify()

  try {
    // 1. Pousser les données locales
    await pushToSupabase(userId)
    // 2. Récupérer les données distantes
    await pullFromSupabase(userId)

    syncState = {
      status: 'success',
      lastSyncAt: Date.now(),
      error: null,
    }
    notify()
    return true
  } catch (err: unknown) {
    console.error('Erreur synchronisation Supabase:', err)
    syncState = {
      ...syncState,
      status: 'error',
      error: err instanceof Error ? err.message : 'Erreur inconnue',
    }
    notify()
    return false
  }
}
