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

/** Pousse les données locales non synchronisées ou existantes vers Supabase, et supprime les enregistrements effacés */
export async function pushToSupabase(userId: string): Promise<void> {
  if (!supabase) return

  // 0. Migration transparente des données locales orphelines vers l'utilisateur connecté
  const localTasks = await db.tasks.toArray()
  for (const t of localTasks) {
    if (t.userId === 'local' || t.userId === 'local-user') {
      await db.tasks.update(t.id, { userId })
      t.userId = userId
    }
  }

  const localRecs = await db.recurrences.toArray()
  for (const r of localRecs) {
    if (r.userId === 'local' || r.userId === 'local-user') {
      await db.recurrences.update(r.id, { userId })
      r.userId = userId
    }
  }

  const localSlots = await db.slots.toArray()
  for (const s of localSlots) {
    if (s.userId === 'local' || s.userId === 'local-user') {
      await db.slots.update(s.id, { userId })
      s.userId = userId
    }
  }

  const localSessions = await db.sessions.toArray()
  for (const s of localSessions) {
    if (s.userId === 'local' || s.userId === 'local-user') {
      await db.sessions.update(s.id, { userId })
      s.userId = userId
    }
  }

  const localNotes = await db.notes.toArray()
  for (const n of localNotes) {
    if (n.userId === 'local' || n.userId === 'local-user') {
      await db.notes.update(n.id, { userId })
      n.userId = userId
    }
  }

  // 1. Tasks
  const deletedTasks = localTasks.filter((t) => t.deleted === 1)
  const activeTasks = localTasks.filter((t) => t.deleted !== 1)

  if (deletedTasks.length > 0) {
    const ids = deletedTasks.map((t) => t.id)
    const { error } = await supabase.from('tasks').delete().in('id', ids)
    if (!error) {
      await db.tasks.bulkDelete(ids)
    } else {
      console.error('Sync delete tasks error:', error)
    }
  }

  if (activeTasks.length > 0) {
    const payload = activeTasks.map((t) => ({
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
  const deletedRecs = localRecs.filter((r) => r.deleted === 1)
  const activeRecs = localRecs.filter((r) => r.deleted !== 1)

  if (deletedRecs.length > 0) {
    const ids = deletedRecs.map((r) => r.id)
    const { error } = await supabase.from('recurrences').delete().in('id', ids)
    if (!error) {
      await db.recurrences.bulkDelete(ids)
    } else {
      console.error('Sync delete recurrences error:', error)
    }
  }

  if (activeRecs.length > 0) {
    const payload = activeRecs.map((r) => ({
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
  const deletedSlots = localSlots.filter((s) => s.deleted === 1)
  const activeSlots = localSlots.filter((s) => s.deleted !== 1)

  if (deletedSlots.length > 0) {
    const ids = deletedSlots.map((s) => s.id)
    const { error } = await supabase.from('slots').delete().in('id', ids)
    if (!error) {
      await db.slots.bulkDelete(ids)
    } else {
      console.error('Sync delete slots error:', error)
    }
  }

  if (activeSlots.length > 0) {
    const payload = activeSlots.map((s) => ({
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
  const deletedSessions = localSessions.filter((s) => s.deleted === 1)
  const activeSessions = localSessions.filter((s) => s.deleted !== 1)

  if (deletedSessions.length > 0) {
    const ids = deletedSessions.map((s) => s.id)
    const { error } = await supabase.from('sessions').delete().in('id', ids)
    if (!error) {
      await db.sessions.bulkDelete(ids)
    } else {
      console.error('Sync delete sessions error:', error)
    }
  }

  if (activeSessions.length > 0) {
    const payload = activeSessions.map((s) => ({
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
  const deletedNotes = localNotes.filter((n) => n.deleted === 1)
  const activeNotes = localNotes.filter((n) => n.deleted !== 1)

  if (deletedNotes.length > 0) {
    const ids = deletedNotes.map((n) => n.id)
    const { error } = await supabase.from('notes').delete().in('id', ids)
    if (!error) {
      await db.notes.bulkDelete(ids)
    } else {
      console.error('Sync delete notes error:', error)
    }
  }

  if (activeNotes.length > 0) {
    const payload = activeNotes.map((n) => ({
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

/** Récupère les données distantes de Supabase et met à jour Dexie sans réanimer les éléments supprimés */
export async function pullFromSupabase(userId: string): Promise<void> {
  if (!supabase) return

  // 1. Tasks
  const { data: remoteTasks } = await supabase.from('tasks').select('*').eq('user_id', userId)
  if (remoteTasks) {
    const remoteIds = new Set(remoteTasks.map((r) => r.id))
    for (const r of remoteTasks) {
      const existing = await db.tasks.get(r.id)
      if (existing && existing.deleted === 1) continue // Était supprimé localement

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

    // Supprimer localement les tâches qui ont été supprimées sur Supabase
    const allLocal = await db.tasks.toArray()
    for (const lt of allLocal) {
      if (lt.userId === userId && !remoteIds.has(lt.id)) {
        await db.tasks.delete(lt.id)
      }
    }
  }

  // 2. Recurrences
  const { data: remoteRecs } = await supabase.from('recurrences').select('*').eq('user_id', userId)
  if (remoteRecs) {
    const remoteIds = new Set(remoteRecs.map((r) => r.id))
    for (const r of remoteRecs) {
      const existing = await db.recurrences.get(r.id)
      if (existing && existing.deleted === 1) continue

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

    const allLocal = await db.recurrences.toArray()
    for (const lr of allLocal) {
      if (lr.userId === userId && !remoteIds.has(lr.id)) {
        await db.recurrences.delete(lr.id)
      }
    }
  }

  // 3. Slots
  const { data: remoteSlots } = await supabase.from('slots').select('*').eq('user_id', userId)
  if (remoteSlots) {
    const remoteIds = new Set(remoteSlots.map((r) => r.id))
    for (const r of remoteSlots) {
      const existing = await db.slots.get(r.id)
      if (existing && existing.deleted === 1) continue

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

    const allLocal = await db.slots.toArray()
    for (const ls of allLocal) {
      if (ls.userId === userId && !remoteIds.has(ls.id)) {
        await db.slots.delete(ls.id)
      }
    }
  }

  // 4. Sessions
  const { data: remoteSessions } = await supabase.from('sessions').select('*').eq('user_id', userId)
  if (remoteSessions) {
    const remoteIds = new Set(remoteSessions.map((r) => r.id))
    for (const r of remoteSessions) {
      const existing = await db.sessions.get(r.id)
      if (existing && existing.deleted === 1) continue

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

    const allLocal = await db.sessions.toArray()
    for (const ls of allLocal) {
      if (ls.userId === userId && !remoteIds.has(ls.id)) {
        await db.sessions.delete(ls.id)
      }
    }
  }

  // 5. Notes
  const { data: remoteNotes } = await supabase.from('notes').select('*').eq('user_id', userId)
  if (remoteNotes) {
    const remoteIds = new Set(remoteNotes.map((r) => r.id))
    for (const r of remoteNotes) {
      const existing = await db.notes.get(r.id)
      if (existing && existing.deleted === 1) continue

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

    const allLocal = await db.notes.toArray()
    for (const ln of allLocal) {
      if (ln.userId === userId && !remoteIds.has(ln.id)) {
        await db.notes.delete(ln.id)
      }
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
