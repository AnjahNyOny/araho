import { db } from './db'
import { supabase } from '../lib/supabase'
import type { Task, Slot, Recurrence, Session, Note, ChecklistItem } from './types'

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

  const localItems = await db.checklistItems.toArray()
  for (const it of localItems) {
    if (it.userId === 'local' || it.userId === 'local-user') {
      await db.checklistItems.update(it.id, { userId })
      it.userId = userId
    }
  }

  // 1. Tasks
  const deletedTasks = localTasks.filter((t) => t.deleted === 1)
  const activeTasks = localTasks.filter((t) => t.deleted !== 1)
  const activeTaskIds = new Set(activeTasks.map((t) => t.id))

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
  const isRecDeleted = (r: Recurrence) => r.deleted === 1 || !activeTaskIds.has(r.taskId)
  const deletedRecs = localRecs.filter(isRecDeleted)
  const activeRecs = localRecs.filter((r) => !isRecDeleted(r))

  if (deletedRecs.length > 0) {
    const ids = deletedRecs.map((r) => r.id)
    await supabase.from('recurrences').delete().in('id', ids)
    await db.recurrences.bulkDelete(ids)
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
  // Les slots orphelins (dont le taskId est supprimé) ou les slots ponctuels supprimés doivent être purgés
  const isOrphanSlot = (s: Slot) => !activeTaskIds.has(s.taskId) || (s.deleted === 1 && !s.recurrenceId)
  const orphanSlots = localSlots.filter(isOrphanSlot)
  // Les slots actifs OU les tombstones de créneau récurrent (qui masquent une occurrence d'une série active)
  const slotsToSync = localSlots.filter((s) => !isOrphanSlot(s))

  if (orphanSlots.length > 0) {
    const ids = orphanSlots.map((s) => s.id)
    await supabase.from('slots').delete().in('id', ids)
    await db.slots.bulkDelete(ids)
  }

  if (slotsToSync.length > 0) {
    const payload = slotsToSync.map((s) => ({
      id: s.id,
      user_id: userId,
      task_id: s.taskId,
      date: s.date,
      start_min: s.startMin,
      duration_min: s.durationMin,
      status: s.deleted === 1 ? 'skipped' : s.status,
      recurrence_id: s.recurrenceId,
      updated_at: new Date(s.updatedAt || Date.now()).toISOString(),
    }))
    const { error } = await supabase.from('slots').upsert(payload, { onConflict: 'id' })
    if (error) console.error('Sync slots error:', error)
  }

  // 4. Sessions
  const isSessionDeleted = (s: Session) => s.deleted === 1 || !activeTaskIds.has(s.taskId)
  const deletedSessions = localSessions.filter(isSessionDeleted)
  const activeSessions = localSessions.filter((s) => !isSessionDeleted(s))
  const activeSessionIds = new Set(activeSessions.map((s) => s.id))

  if (deletedSessions.length > 0) {
    const ids = deletedSessions.map((s) => s.id)
    await supabase.from('sessions').delete().in('id', ids)
    await db.sessions.bulkDelete(ids)
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
  const isNoteDeleted = (n: Note) =>
    n.deleted === 1 || !activeTaskIds.has(n.taskId) || !activeSessionIds.has(n.sessionId)
  const deletedNotes = localNotes.filter(isNoteDeleted)
  const activeNotes = localNotes.filter((n) => !isNoteDeleted(n))

  if (deletedNotes.length > 0) {
    const ids = deletedNotes.map((n) => n.id)
    await supabase.from('notes').delete().in('id', ids)
    await db.notes.bulkDelete(ids)
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

  // 6. Checklist items
  const isItemDeleted = (it: ChecklistItem) => it.deleted === 1 || (!!it.taskId && !activeTaskIds.has(it.taskId))
  const deletedItems = localItems.filter(isItemDeleted)
  const activeItems = localItems.filter((it) => !isItemDeleted(it))

  if (deletedItems.length > 0) {
    const ids = deletedItems.map((it) => it.id)
    await supabase.from('checklist_items').delete().in('id', ids)
    await db.checklistItems.bulkDelete(ids)
  }

  if (activeItems.length > 0) {
    const payload = activeItems.map((it) => ({
      id: it.id,
      user_id: userId,
      group_id: it.groupId,
      group_title: it.groupTitle,
      kind: it.kind ?? 'validation',
      task_id: it.taskId,
      due_date: it.dueDate,
      position: it.position,
      label: it.label,
      checked: Boolean(it.checked),
      checked_at: it.checkedAt ? new Date(it.checkedAt).toISOString() : null,
      updated_at: new Date(it.updatedAt).toISOString(),
    }))
    const { error } = await supabase.from('checklist_items').upsert(payload, { onConflict: 'id' })
    if (error) console.error('Sync checklist items error:', error)
  }
}

/** Récupère les données distantes de Supabase et met à jour Dexie sans réanimer les éléments supprimés */
export async function pullFromSupabase(userId: string): Promise<void> {
  if (!supabase) return

  // 1. Tasks
  const { data: remoteTasks } = await supabase.from('tasks').select('*').eq('user_id', userId)
  const remoteTaskIds = new Set((remoteTasks || []).map((r) => r.id))
  if (remoteTasks) {
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
      if (lt.userId === userId && !remoteTaskIds.has(lt.id)) {
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
      if ((lr.userId === userId || !remoteTaskIds.has(lr.taskId)) && !remoteIds.has(lr.id)) {
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

      const isSkippedOrDeleted = r.status === 'skipped' || r.status === 'deleted'
      const local: Slot = {
        id: r.id,
        userId: r.user_id,
        taskId: r.task_id,
        date: r.date,
        startMin: r.start_min,
        durationMin: r.duration_min,
        status: isSkippedOrDeleted ? 'skipped' : (r.status || 'planned'),
        recurrenceId: r.recurrence_id,
        createdAt: new Date(r.created_at).getTime(),
        updatedAt: new Date(r.updated_at).getTime(),
        deleted: isSkippedOrDeleted ? 1 : 0,
      }
      await db.slots.put(local)
    }

    const allLocal = await db.slots.toArray()
    for (const ls of allLocal) {
      if ((ls.userId === userId || !remoteTaskIds.has(ls.taskId)) && !remoteIds.has(ls.id)) {
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
      if ((ls.userId === userId || !remoteTaskIds.has(ls.taskId)) && !remoteIds.has(ls.id)) {
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
      if ((ln.userId === userId || !remoteTaskIds.has(ln.taskId)) && !remoteIds.has(ln.id)) {
        await db.notes.delete(ln.id)
      }
    }
  }

  // 6. Checklist items (data reste null si la table n'a pas encore été créée sur Supabase)
  const { data: remoteItems } = await supabase.from('checklist_items').select('*').eq('user_id', userId)
  if (remoteItems) {
    const remoteIds = new Set(remoteItems.map((r) => r.id))
    for (const r of remoteItems) {
      const existing = await db.checklistItems.get(r.id)
      if (existing && existing.deleted === 1) continue

      const local: ChecklistItem = {
        id: r.id,
        userId: r.user_id,
        groupId: r.group_id,
        groupTitle: r.group_title || '',
        kind: r.kind === 'track' ? 'track' : 'validation',
        taskId: r.task_id,
        dueDate: r.due_date,
        position: r.position || 0,
        label: r.label,
        checked: r.checked ? 1 : 0,
        checkedAt: r.checked_at ? new Date(r.checked_at).getTime() : null,
        createdAt: new Date(r.created_at).getTime(),
        updatedAt: new Date(r.updated_at).getTime(),
        deleted: 0,
      }
      await db.checklistItems.put(local)
    }

    const allLocal = await db.checklistItems.toArray()
    for (const li of allLocal) {
      if (li.userId === userId && !remoteIds.has(li.id)) {
        await db.checklistItems.delete(li.id)
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
