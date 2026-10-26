/**
 * Repositories : SEULE couche autorisée à lire/écrire dans la base.
 * L'UI ne touche jamais Dexie directement → en phase 3, on branchera la
 * synchronisation ici sans modifier les composants.
 */
import { db, LOCAL_USER_ID } from './db'
import type {
  BaseRecord,
  Note,
  NoteInput,
  PlanItem,
  Recurrence,
  ScheduleInput,
  Session,
  Slot,
  SlotStatus,
  Task,
  TaskInput,
} from './types'
import { dayOfWeek, today, type ISODate } from '../lib/date'
import { uuid } from '../lib/id'
import { supabase } from '../lib/supabase'
import { pushToSupabase } from './sync'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function base(): BaseRecord {
  const t = Date.now()
  return { id: uuid(), userId: LOCAL_USER_ID, createdAt: t, updatedAt: t, deleted: 0 }
}

export const alive = <T extends BaseRecord>(r: T | undefined): r is T => !!r && !r.deleted

const touch = <T extends object>(patch: T) => ({ ...patch, updatedAt: Date.now() })

async function syncPushIfOnline() {
  if (!supabase) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      await pushToSupabase(session.user.id)
    }
  } catch (err) {
    console.warn('Sync push error:', err)
  }
}

/* ------------------------------------------------------------------ */
/* Tâches                                                              */
/* ------------------------------------------------------------------ */

export async function listTasks(includeArchived = false): Promise<Task[]> {
  const all = await db.tasks.toArray()
  return all
    .filter((t) => alive(t) && (includeArchived || !t.archived))
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function getTask(id: string): Promise<Task | undefined> {
  const t = await db.tasks.get(id)
  return alive(t) ? t : undefined
}

export async function createTask(input: TaskInput, schedule?: ScheduleInput): Promise<Task> {
  const task: Task = {
    ...base(),
    ...input,
    name: input.name.trim(),
    startDate: today(),
    archived: 0,
  }
  await db.transaction('rw', db.tasks, db.recurrences, async () => {
    await db.tasks.add(task)
    if (schedule && schedule.daysOfWeek.length) {
      await addRecurrence(task.id, schedule, today())
    }
  })
  syncPushIfOnline().catch(console.error)
  return task
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  await db.tasks.update(id, touch(patch))
  syncPushIfOnline().catch(console.error)
}

export async function setTaskArchived(id: string, archived: boolean): Promise<void> {
  await db.tasks.update(id, touch({ archived: archived ? 1 : 0 }))
  syncPushIfOnline().catch(console.error)
}

/** Suppression logique de la tâche, de ses récurrences et de ses créneaux futurs. */
export async function deleteTask(id: string): Promise<void> {
  const t = today()
  await db.transaction('rw', db.tasks, db.recurrences, db.slots, async () => {
    await db.tasks.update(id, touch({ deleted: 1 as const }))
    await db.recurrences.where('taskId').equals(id).modify(touch({ deleted: 1 as const }))
    await db.slots
      .where('taskId')
      .equals(id)
      .filter((s) => s.date >= t && s.status === 'planned')
      .modify(touch({ deleted: 1 as const }))
  })
  syncPushIfOnline().catch(console.error)
}

/* ------------------------------------------------------------------ */
/* Récurrences & planning                                              */
/* ------------------------------------------------------------------ */

async function addRecurrence(taskId: string, s: ScheduleInput, fromDate: ISODate) {
  const rec: Recurrence = {
    ...base(),
    taskId,
    daysOfWeek: [...s.daysOfWeek].sort(),
    startMin: s.startMin,
    durationMin: s.durationMin,
    fromDate,
    untilDate: null,
  }
  await db.recurrences.add(rec)
  return rec
}

export async function listRecurrences(taskId: string): Promise<Recurrence[]> {
  const all = await db.recurrences.where('taskId').equals(taskId).toArray()
  return all.filter(alive).sort((a, b) => a.startMin - b.startMin)
}

/** Supprime une série : les occurrences futures disparaissent, l'historique reste. */
export async function deleteRecurrence(id: string): Promise<void> {
  const t = today()
  await db.transaction('rw', db.recurrences, db.slots, async () => {
    await db.recurrences.update(id, touch({ deleted: 1 as const }))
    await db.slots
      .where('recurrenceId')
      .equals(id)
      .filter((s) => s.date >= t && s.status === 'planned')
      .modify(touch({ deleted: 1 as const }))
  })
  syncPushIfOnline().catch(console.error)
}

/**
 * Planning de plusieurs jours : créneaux réels + occurrences virtuelles des
 * récurrences. Une occurrence est masquée dès qu'un créneau réel (même
 * supprimé) existe pour cette récurrence ce jour-là : c'est ce qui permet de
 * modifier ou supprimer une seule occurrence d'une série.
 */
export async function getPlan(dates: ISODate[]): Promise<Record<ISODate, PlanItem[]>> {
  const [slots, recs, tasks] = await Promise.all([
    db.slots.where('date').anyOf(dates).toArray(),
    db.recurrences.toArray(),
    db.tasks.toArray(),
  ])
  const activeTasks = new Set(tasks.filter((t) => alive(t) && !t.archived).map((t) => t.id))

  const result: Record<ISODate, PlanItem[]> = {}
  for (const date of dates) {
    const daySlots = slots.filter((s) => s.date === date)
    const usedRecs = new Set(daySlots.map((s) => s.recurrenceId).filter(Boolean))
    const items: PlanItem[] = daySlots
      .filter((s) => alive(s) && activeTasks.has(s.taskId))
      .map((s) => ({
        key: s.id,
        taskId: s.taskId,
        date,
        startMin: s.startMin,
        durationMin: s.durationMin,
        status: s.status,
        slot: s,
        recurrence: recs.find((r) => r.id === s.recurrenceId) ?? null,
      }))

    const dow = dayOfWeek(date)
    for (const r of recs) {
      if (!alive(r) || !activeTasks.has(r.taskId)) continue
      if (!r.daysOfWeek.includes(dow) || date < r.fromDate) continue
      if (r.untilDate && date > r.untilDate) continue
      if (usedRecs.has(r.id)) continue
      items.push({
        key: `${r.id}:${date}`,
        taskId: r.taskId,
        date,
        startMin: r.startMin,
        durationMin: r.durationMin,
        status: 'planned',
        slot: null,
        recurrence: r,
      })
    }
    result[date] = items.sort((a, b) => a.startMin - b.startMin)
  }
  return result
}

export async function getDayPlan(date: ISODate): Promise<PlanItem[]> {
  return (await getPlan([date]))[date]
}

/** Transforme une occurrence virtuelle en créneau réel (idempotent). */
export async function materialize(item: PlanItem): Promise<Slot> {
  if (item.slot) return item.slot
  const slot: Slot = {
    ...base(),
    taskId: item.taskId,
    date: item.date,
    startMin: item.startMin,
    durationMin: item.durationMin,
    status: item.status,
    recurrenceId: item.recurrence?.id ?? null,
  }
  await db.slots.add(slot)
  return slot
}

export interface NewSlotInput {
  taskId: string
  date: ISODate
  startMin: number
  durationMin: number
  /** Si non vide : crée une série répétée ces jours-là à partir de `date`. */
  repeatDays: number[]
}

export async function addSlot(input: NewSlotInput): Promise<void> {
  if (input.repeatDays.length) {
    await addRecurrence(
      input.taskId,
      {
        daysOfWeek: input.repeatDays,
        startMin: input.startMin,
        durationMin: input.durationMin,
      },
      input.date,
    )
    return
  }
  const slot: Slot = {
    ...base(),
    taskId: input.taskId,
    date: input.date,
    startMin: input.startMin,
    durationMin: input.durationMin,
    status: 'planned',
    recurrenceId: null,
  }
  await db.slots.add(slot)
}

/** Modifie UNE occurrence (la série n'est pas touchée). */
export async function updateOccurrence(
  item: PlanItem,
  patch: Partial<Pick<Slot, 'startMin' | 'durationMin' | 'date'>>,
): Promise<void> {
  const slot = await materialize(item)
  await db.slots.update(slot.id, touch(patch))
}

/** Modifie l'horaire de toute la série. */
export async function updateRecurrence(
  id: string,
  patch: Partial<Pick<Recurrence, 'startMin' | 'durationMin' | 'daysOfWeek'>>,
): Promise<void> {
  await db.recurrences.update(id, touch(patch))
}

export async function setSlotStatus(item: PlanItem, status: SlotStatus): Promise<void> {
  const slot = await materialize(item)
  await db.slots.update(slot.id, touch({ status }))
}

export async function deleteOccurrence(item: PlanItem): Promise<void> {
  const slot = await materialize(item)
  await db.slots.update(slot.id, touch({ deleted: 1 as const }))
  syncPushIfOnline().catch(console.error)
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export function elapsedMs(s: Session, now = Date.now()): number {
  const end = s.endedAt ?? s.pausedAt ?? now
  return Math.max(0, end - s.startedAt - s.pausedMs)
}

export async function getActiveSession(): Promise<Session | null> {
  const list = await db.sessions.where('status').equals('active').toArray()
  return list.find((s) => alive(s)) ?? null
}

export async function getSession(id: string): Promise<Session | undefined> {
  const s = await db.sessions.get(id)
  return alive(s) ? s : undefined
}

export async function startSession(taskId: string, item?: PlanItem): Promise<Session> {
  const existing = await getActiveSession()
  if (existing) throw new Error('Une session est déjà en cours.')

  const task = await getTask(taskId)
  const slot = item ? await materialize(item) : null
  const session: Session = {
    ...base(),
    taskId,
    slotId: slot?.id ?? null,
    date: today(),
    status: 'active',
    startedAt: Date.now(),
    endedAt: null,
    pausedMs: 0,
    pausedAt: null,
    plannedMin: item?.durationMin || task?.dailyGoalMin || 30,
    durationMin: 0,
  }
  await db.sessions.add(session)
  return session
}

export async function pauseSession(id: string): Promise<void> {
  await db.sessions.update(id, touch({ pausedAt: Date.now() }))
}

export async function resumeSession(id: string): Promise<void> {
  const s = await db.sessions.get(id)
  if (!s?.pausedAt) return
  await db.sessions.update(id, touch({ pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: null }))
}

export async function finishSession(id: string): Promise<Session> {
  const s = await db.sessions.get(id)
  if (!s) throw new Error('Session introuvable')
  const now = Date.now()
  const pausedMs = s.pausedAt ? s.pausedMs + (now - s.pausedAt) : s.pausedMs
  const finished: Session = {
    ...s,
    status: 'completed',
    endedAt: now,
    pausedAt: null,
    pausedMs,
    durationMin: Math.max(1, Math.round((now - s.startedAt - pausedMs) / 60_000)),
    updatedAt: now,
  }
  await db.transaction('rw', db.sessions, db.slots, async () => {
    await db.sessions.put(finished)
    if (s.slotId) await db.slots.update(s.slotId, touch({ status: 'done' as const }))
  })
  return finished
}

export async function cancelSession(id: string): Promise<void> {
  await db.sessions.update(id, touch({ deleted: 1 as const }))
  syncPushIfOnline().catch(console.error)
}

export async function updateSessionDuration(id: string, durationMin: number): Promise<void> {
  await db.sessions.update(id, touch({ durationMin: Math.max(1, Math.round(durationMin)) }))
}

/** "J'ai déjà fait ce créneau" : enregistre une session terminée sans chrono. */
export async function logManualSession(
  taskId: string,
  durationMin: number,
  item?: PlanItem,
): Promise<Session> {
  const slot = item ? await materialize(item) : null
  const date = item?.date ?? today()
  const now = Date.now()
  const session: Session = {
    ...base(),
    taskId,
    slotId: slot?.id ?? null,
    date,
    status: 'completed',
    startedAt: now - durationMin * 60_000,
    endedAt: now,
    pausedMs: 0,
    pausedAt: null,
    plannedMin: durationMin,
    durationMin,
  }
  await db.transaction('rw', db.sessions, db.slots, async () => {
    await db.sessions.add(session)
    if (slot) await db.slots.update(slot.id, touch({ status: 'done' as const }))
  })
  return session
}

export async function getSessionsForSlot(slotId: string): Promise<Session[]> {
  const list = await db.sessions.where('slotId').equals(slotId).toArray()
  return list.filter((s) => alive(s) && s.status === 'completed')
}

export async function listSessions(filter?: { taskId?: string; dates?: ISODate[] }): Promise<Session[]> {
  let list: Session[]
  if (filter?.taskId) list = await db.sessions.where('taskId').equals(filter.taskId).toArray()
  else if (filter?.dates) list = await db.sessions.where('date').anyOf(filter.dates).toArray()
  else list = await db.sessions.toArray()
  return list
    .filter((s) => alive(s) && s.status === 'completed')
    .filter((s) => !filter?.dates || filter.dates.includes(s.date))
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

export async function getNoteForSession(sessionId: string): Promise<Note | undefined> {
  const list = await db.notes.where('sessionId').equals(sessionId).toArray()
  return list.find(alive)
}

export async function saveNote(session: Session, input: NoteInput): Promise<Note> {
  const existing = await getNoteForSession(session.id)
  const clean: NoteInput = {
    learned: input.learned.trim(),
    difficulties: input.difficulties.trim(),
    nextStep: input.nextStep.trim(),
    confidence: input.confidence,
    tags: [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
  }
  if (existing) {
    const updated = { ...existing, ...clean, updatedAt: Date.now() }
    await db.notes.put(updated)
    return updated
  }
  const note: Note = { ...base(), sessionId: session.id, taskId: session.taskId, date: session.date, ...clean }
  await db.notes.add(note)
  return note
}

export async function listNotes(taskId?: string): Promise<Note[]> {
  const list = taskId ? await db.notes.where('taskId').equals(taskId).toArray() : await db.notes.toArray()
  return list.filter(alive).sort((a, b) => b.createdAt - a.createdAt)
}

/** Dernière "prochaine étape" notée pour une tâche → affichée au démarrage d'une session. */
export async function getLastNextStep(taskId: string, excludeSessionId?: string): Promise<string> {
  const notes = await listNotes(taskId)
  return notes.find((n) => n.nextStep && n.sessionId !== excludeSessionId)?.nextStep ?? ''
}

/* ------------------------------------------------------------------ */
/* Sauvegarde / restauration                                           */
/* ------------------------------------------------------------------ */

export interface BackupFile {
  app: 'araho'
  version: 1
  exportedAt: string
  data: {
    tasks: Task[]
    recurrences: Recurrence[]
    slots: Slot[]
    sessions: Session[]
    notes: Note[]
  }
}

export async function exportAll(): Promise<BackupFile> {
  const [tasks, recurrences, slots, sessions, notes] = await Promise.all([
    db.tasks.toArray(),
    db.recurrences.toArray(),
    db.slots.toArray(),
    db.sessions.toArray(),
    db.notes.toArray(),
  ])
  return {
    app: 'araho',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { tasks, recurrences, slots, sessions, notes },
  }
}

/** Fusion "last-write-wins" : accepte aussi bien le format exporté que des plannings personnalisés. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function importAll(file: any): Promise<number> {
  const data = file?.data ?? file
  if (!data || (!data.tasks && !data.recurrences && !data.slots && !data.sessions && !data.notes)) {
    throw new Error('Fichier de sauvegarde invalide')
  }
  let count = 0
  const now = Date.now()
  const tables = [db.tasks, db.recurrences, db.slots, db.sessions, db.notes] as const
  await db.transaction('rw', [...tables], async () => {
    for (const table of tables) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const incoming = (data[table.name as keyof BackupFile['data']] ?? []) as any[]
      for (const raw of incoming) {
        const rec = {
          ...raw,
          userId: raw.userId ?? 'local-user',
          createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
          updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
          deleted: raw.deleted === 1 ? 1 : 0,
          description: raw.description ?? '',
          archived: raw.archived === true || raw.archived === 1 ? 1 : 0,
        }
        const current = (await table.get(rec.id)) as BaseRecord | undefined
        if (!current || current.updatedAt <= rec.updatedAt) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await table.put(rec as any)
          count++
        }
      }
    }
  })
  return count
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', [db.tasks, db.recurrences, db.slots, db.sessions, db.notes], async () => {
    await Promise.all([db.tasks.clear(), db.recurrences.clear(), db.slots.clear(), db.sessions.clear(), db.notes.clear()])
  })
}
