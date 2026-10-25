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

export interface WeeklyReviewStats {
  weekDays: ISODate[]
  previousWeekDates: ISODate[]
  totalMin: number
  previousTotalMin: number
  diffMin: number
  diffPercent: number | null
  activeDaysCount: number
  avgDailyMin: number
  mostProductiveDay: { date: ISODate; min: number } | null
  sessionsCount: number
  notesCount: number
  avgConfidence: number
  dailyBreakdown: { date: ISODate; min: number; previousMin: number }[]
  taskBreakdown: { taskId: string; min: number; percent: number }[]
}

export function computeWeeklyReview(
  allSessions: Session[],
  allNotes: Note[],
  weekDays: ISODate[],
): WeeklyReviewStats {
  const currentWeekSet = new Set(weekDays)
  const previousWeekDates = weekDays.map((d) => addDays(d, -7))
  const previousWeekSet = new Set(previousWeekDates)

  const currentSessions = allSessions.filter((s) => currentWeekSet.has(s.date))
  const previousSessions = allSessions.filter((s) => previousWeekSet.has(s.date))

  const totalMin = currentSessions.reduce((acc, s) => acc + s.durationMin, 0)
  const previousTotalMin = previousSessions.reduce((acc, s) => acc + s.durationMin, 0)
  const diffMin = totalMin - previousTotalMin
  const diffPercent =
    previousTotalMin > 0 ? Math.round(((totalMin - previousTotalMin) / previousTotalMin) * 100) : null

  // Par jour
  const currentByDate = minutesByDate(currentSessions)
  const previousByDate = minutesByDate(previousSessions)

  const dailyBreakdown = weekDays.map((date, idx) => ({
    date,
    min: currentByDate.get(date) ?? 0,
    previousMin: previousByDate.get(previousWeekDates[idx]) ?? 0,
  }))

  const activeDaysCount = dailyBreakdown.filter((d) => d.min > 0).length
  const avgDailyMin = activeDaysCount > 0 ? Math.round(totalMin / activeDaysCount) : 0

  let mostProductiveDay: { date: ISODate; min: number } | null = null
  for (const d of dailyBreakdown) {
    if (d.min > 0 && (!mostProductiveDay || d.min > mostProductiveDay.min)) {
      mostProductiveDay = { date: d.date, min: d.min }
    }
  }

  // Par tâche
  const taskMinutes = new Map<string, number>()
  for (const s of currentSessions) {
    taskMinutes.set(s.taskId, (taskMinutes.get(s.taskId) ?? 0) + s.durationMin)
  }

  const taskBreakdown = Array.from(taskMinutes.entries())
    .map(([taskId, min]) => ({
      taskId,
      min,
      percent: totalMin > 0 ? Math.round((min / totalMin) * 100) : 0,
    }))
    .sort((a, b) => b.min - a.min)

  // Notes de la semaine
  const currentNotes = allNotes.filter((n) => currentWeekSet.has(n.date))
  const ratedNotes = currentNotes.filter((n) => n.confidence > 0)
  const avgConfidence =
    ratedNotes.length > 0
      ? ratedNotes.reduce((acc, n) => acc + n.confidence, 0) / ratedNotes.length
      : 0

  return {
    weekDays,
    previousWeekDates,
    totalMin,
    previousTotalMin,
    diffMin,
    diffPercent,
    activeDaysCount,
    avgDailyMin,
    mostProductiveDay,
    sessionsCount: currentSessions.length,
    notesCount: currentNotes.length,
    avgConfidence,
    dailyBreakdown,
    taskBreakdown,
  }
}
