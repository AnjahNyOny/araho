import type { Note, Session } from './types'
import { addDays, type ISODate } from '../lib/date'

export interface TaskStats {
  totalMin: number
  sessionsCount: number
  activeDays: number
  /** Jours consécutifs avec au moins une session (aujourd'hui ou hier inclus). */
  streak: number
  bestStreak: number
  todayMin: number
  avgConfidence: number
  notesCount: number
  /** Minutes par jour sur les N derniers jours (du plus ancien au plus récent). */
  history: { date: ISODate; min: number }[]
}

export function minutesByDate(sessions: Session[]): Map<ISODate, number> {
  const map = new Map<ISODate, number>()
  for (const s of sessions) map.set(s.date, (map.get(s.date) ?? 0) + s.durationMin)
  return map
}

export function computeStreak(days: Set<ISODate>, today: ISODate): number {
  let cursor = days.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

function computeBestStreak(days: Set<ISODate>): number {
  let best = 0
  for (const d of days) {
    if (days.has(addDays(d, -1))) continue // pas un début de série
    let len = 0
    let cursor = d
    while (days.has(cursor)) {
      len++
      cursor = addDays(cursor, 1)
    }
    best = Math.max(best, len)
  }
  return best
}

export function computeTaskStats(
  sessions: Session[],
  notes: Note[],
  today: ISODate,
  historyDays = 14,
): TaskStats {
  const byDate = minutesByDate(sessions)
  const days = new Set(byDate.keys())
  const rated = notes.filter((n) => n.confidence > 0)
  return {
    totalMin: sessions.reduce((acc, s) => acc + s.durationMin, 0),
    sessionsCount: sessions.length,
    activeDays: days.size,
    streak: computeStreak(days, today),
    bestStreak: computeBestStreak(days),
    todayMin: byDate.get(today) ?? 0,
    avgConfidence: rated.length ? rated.reduce((a, n) => a + n.confidence, 0) / rated.length : 0,
    notesCount: notes.length,
    history: Array.from({ length: historyDays }, (_, i) => {
      const date = addDays(today, i - historyDays + 1)
      return { date, min: byDate.get(date) ?? 0 }
    }),
  }
}
