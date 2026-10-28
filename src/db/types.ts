import type { ISODate } from '../lib/date'

/**
 * Champs communs à tous les enregistrements.
 * Pensés dès la V1 pour la future synchronisation serveur :
 * - `id` UUID généré côté client (pas de conflit entre appareils)
 * - `userId` pour le multi-utilisateurs
 * - `updatedAt` pour la résolution "last-write-wins"
 * - `deleted` (0/1) suppression logique, propagée lors de la sync
 */
export interface BaseRecord {
  id: string
  userId: string
  createdAt: number
  updatedAt: number
  deleted: 0 | 1
}

export interface Task extends BaseRecord {
  name: string
  description: string
  color: string
  icon: string
  /** Objectif quotidien en minutes (0 = pas d'objectif). */
  dailyGoalMin: number
  startDate: ISODate
  archived: 0 | 1
}

/** Règle de répétition : génère des créneaux "virtuels" sans les stocker. */
export interface Recurrence extends BaseRecord {
  taskId: string
  /** Valeurs Date#getDay (0 = dimanche). */
  daysOfWeek: number[]
  startMin: number
  durationMin: number
  fromDate: ISODate
  untilDate: ISODate | null
}

export type SlotStatus = 'planned' | 'done' | 'skipped'

/** Créneau réel. Créé directement, ou "matérialisé" depuis une récurrence. */
export interface Slot extends BaseRecord {
  taskId: string
  date: ISODate
  startMin: number
  durationMin: number
  status: SlotStatus
  recurrenceId: string | null
}

export type SessionStatus = 'active' | 'completed'

/** Temps réellement passé sur une tâche. */
export interface Session extends BaseRecord {
  taskId: string
  slotId: string | null
  date: ISODate
  status: SessionStatus
  startedAt: number
  endedAt: number | null
  /** Durée cumulée des pauses (ms). */
  pausedMs: number
  /** Timestamp de début de la pause en cours, sinon null. */
  pausedAt: number | null
  /** Durée visée (créneau ou objectif quotidien). */
  plannedMin: number
  durationMin: number
}

/** Ce qui a été appris / fait pendant une session. */
export interface Note extends BaseRecord {
  sessionId: string
  taskId: string
  date: ISODate
  learned: string
  difficulties: string
  nextStep: string
  /** 1 (flou) → 5 (maîtrisé), 0 = non renseigné. */
  confidence: number
  tags: string[]
}

/** Élément d'une liste de validation (ex. fin de phase d'un plan d'apprentissage). */
export interface ChecklistItem extends BaseRecord {
  /** Regroupe les éléments d'une même liste (ex. "plan-phase-1"). */
  groupId: string
  groupTitle: string
  /** Tâche sur laquelle la liste s'affiche, ou null. */
  taskId: string | null
  /** Échéance de la liste (fin de phase), ou null. */
  dueDate: ISODate | null
  position: number
  label: string
  checked: 0 | 1
  checkedAt: number | null
}

export interface ChecklistGroup {
  groupId: string
  groupTitle: string
  dueDate: ISODate | null
  items: ChecklistItem[]
}

export type TaskInput =Pick<Task, 'name' | 'description' | 'color' | 'icon' | 'dailyGoalMin'>

export interface ScheduleInput {
  daysOfWeek: number[]
  startMin: number
  durationMin: number
}

export type NoteInput = Pick<
  Note,
  'learned' | 'difficulties' | 'nextStep' | 'confidence' | 'tags'
>

/** Élément du planning d'un jour : créneau réel OU occurrence virtuelle d'une récurrence. */
export interface PlanItem {
  key: string
  taskId: string
  date: ISODate
  startMin: number
  durationMin: number
  status: SlotStatus
  slot: Slot | null
  recurrence: Recurrence | null
}
