/** Date locale au format YYYY-MM-DD (pas d'UTC : on raisonne en "jours vécus"). */
export type ISODate = string

export function toISODate(d: Date = new Date()): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): ISODate {
  return toISODate(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** 0 = dimanche … 6 = samedi (comme Date#getDay). */
export function dayOfWeek(s: ISODate): number {
  return parseISODate(s).getDay()
}

/** Lundi de la semaine contenant `s`. */
export function startOfWeek(s: ISODate): ISODate {
  return addDays(s, -((dayOfWeek(s) + 6) % 7))
}

export function weekDates(s: ISODate): ISODate[] {
  const start = startOfWeek(s)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Dimanche de la semaine contenant `s` (comme sur Calendrier iOS). */
export function startOfWeekSunday(s: ISODate): ISODate {
  return addDays(s, -dayOfWeek(s))
}

export function weekDatesSunday(s: ISODate): ISODate[] {
  const start = startOfWeekSunday(s)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

export function nowMinutes(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** 570 -> "09:30" */
export function minutesToTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** "09:30" -> 570 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** 90 -> "1h30", 45 -> "45 min" */
export function formatDuration(min: number): string {
  const total = Math.max(0, Math.round(min))
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/** Chrono : "04:12" ou "1:04:12" */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShortDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const fmtDayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

export function formatDayLong(s: ISODate): string {
  return capitalize(fmtLong.format(parseISODate(s)))
}

export function formatWeekday(s: ISODate): string {
  return capitalize(fmtShortDay.format(parseISODate(s)).replace('.', ''))
}

export function formatDayMonth(s: ISODate): string {
  return fmtDayMonth.format(parseISODate(s)).replace('.', '')
}

export function formatMonthName(s: ISODate): string {
  const m = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(parseISODate(s))
  return capitalize(m)
}

export function formatCalendarHeader(s: ISODate): string {
  const d = parseISODate(s)
  const weekday = capitalize(new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d))
  const day = d.getDate()
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d).replace('.', '')
  const year = d.getFullYear()
  return `${weekday} - ${day} ${month}. ${year}`
}

export function relativeDayLabel(s: ISODate): string {
  const diff = daysBetween(today(), s)
  if (diff === 0) return "Aujourd'hui"
  if (diff === -1) return 'Hier'
  if (diff === 1) return 'Demain'
  return formatDayLong(s)
}

/** Ordre d'affichage lundi → dimanche, valeurs Date#getDay. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
export const WEEKDAY_LETTERS: Record<number, string> = {
  0: 'D',
  1: 'L',
  2: 'M',
  3: 'M',
  4: 'J',
  5: 'V',
  6: 'S',
}
export const WEEKDAY_NAMES: Record<number, string> = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
}

export function describeDays(days: number[]): string {
  const set = new Set(days)
  if (set.size === 7) return 'Tous les jours'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'En semaine'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Le week-end'
  return WEEK_ORDER.filter((d) => set.has(d))
    .map((d) => WEEKDAY_NAMES[d].slice(0, 3))
    .join(', ')
}
