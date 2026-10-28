import Dexie, { type EntityTable } from 'dexie'
import type { ChecklistItem, Note, Recurrence, Session, Slot, Task } from './types'

export class ArahoDB extends Dexie {
  declare tasks: EntityTable<Task, 'id'>
  declare recurrences: EntityTable<Recurrence, 'id'>
  declare slots: EntityTable<Slot, 'id'>
  declare sessions: EntityTable<Session, 'id'>
  declare notes: EntityTable<Note, 'id'>
  declare checklistItems: EntityTable<ChecklistItem, 'id'>

  constructor() {
    super('araho')
    this.version(1).stores({
      tasks: 'id, updatedAt',
      recurrences: 'id, taskId, updatedAt',
      slots: 'id, date, taskId, recurrenceId, updatedAt',
      sessions: 'id, taskId, slotId, status, date, updatedAt',
      notes: 'id, sessionId, taskId, date, updatedAt',
    })
    this.version(2).stores({
      checklistItems: 'id, groupId, taskId, updatedAt',
    })
  }
}

export const db = new ArahoDB()

/** Utilisateur local en attendant les comptes (phase 3). */
export const LOCAL_USER_ID = 'local'
