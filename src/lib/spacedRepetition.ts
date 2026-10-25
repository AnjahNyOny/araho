import type { Note } from '../db/types'
import { addDays, today, type ISODate } from './date'

export interface NoteReviewState {
  noteId: string
  level: number
  nextReviewDate: ISODate
  lastReviewedAt: number
}

const STORAGE_KEY = 'araho_spaced_reviews'

const INTERVALS = [1, 3, 7, 14, 30, 60]

export function getAllReviewStates(): Record<string, NoteReviewState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function saveReviewStates(states: Record<string, NoteReviewState>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states))
    window.dispatchEvent(new CustomEvent('araho_spaced_review_updated'))
  } catch {}
}

/**
 * Calcule les notes qui doivent être révisées aujourd'hui.
 */
export function getDueNotes(notes: Note[], taskId?: string): Note[] {
  const states = getAllReviewStates()
  const todayStr = today()

  return notes.filter((n) => {
    if (!n.learned || n.learned.trim().length < 3) return false
    if (taskId && n.taskId !== taskId) return false

    const existing = states[n.id]
    if (existing) {
      return existing.nextReviewDate <= todayStr
    }

    // Première planification automatique basée sur le niveau de compréhension initial
    let initialDays = 3
    if (n.confidence <= 2) initialDays = 1
    else if (n.confidence >= 4) initialDays = 7

    const defaultDue = addDays(n.date, initialDays)
    return defaultDue <= todayStr
  })
}

/**
 * Enregistre le résultat de la révision d'une note.
 * @param quality 'again' (à revoir) ou 'good' (bien assimilé)
 */
export function recordReviewResult(noteId: string, quality: 'again' | 'good'): void {
  const states = getAllReviewStates()
  const existing = states[noteId]
  const currentLevel = existing ? existing.level : 1
  const todayStr = today()

  let nextLevel: number
  let intervalDays: number

  if (quality === 'again') {
    nextLevel = 1
    intervalDays = 1
  } else {
    nextLevel = currentLevel + 1
    const idx = Math.min(nextLevel - 1, INTERVALS.length - 1)
    intervalDays = INTERVALS[idx]
  }

  states[noteId] = {
    noteId,
    level: nextLevel,
    nextReviewDate: addDays(todayStr, intervalDays),
    lastReviewedAt: Date.now(),
  }

  saveReviewStates(states)
}
