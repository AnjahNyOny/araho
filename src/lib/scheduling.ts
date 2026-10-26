import type { PlanItem } from '../db/types'
import { updateOccurrence } from '../db/repo'
import { addDays, minutesToTime } from './date'

export interface FreeSlot {
  startMin: number
  endMin: number
  durationMin: number
}

/** Calcule les créneaux libres entre les tâches planifiées d'une journée */
export function getFreeSlots(
  items: PlanItem[],
  dayStartMin = 8 * 60, // 08:00
  dayEndMin = 22 * 60,  // 22:00
  minGap = 15,
): FreeSlot[] {
  const activeItems = items
    .filter((i) => i.status !== 'skipped')
    .sort((a, b) => a.startMin - b.startMin)

  if (activeItems.length === 0) {
    return [{ startMin: dayStartMin, endMin: dayEndMin, durationMin: dayEndMin - dayStartMin }]
  }

  const free: FreeSlot[] = []

  // 1. Avant le premier créneau
  const first = activeItems[0]
  if (first.startMin - dayStartMin >= minGap) {
    free.push({
      startMin: dayStartMin,
      endMin: first.startMin,
      durationMin: first.startMin - dayStartMin,
    })
  }

  // 2. Entre les créneaux
  let currentEnd = first.startMin + first.durationMin
  for (let i = 1; i < activeItems.length; i++) {
    const item = activeItems[i]
    if (item.startMin - currentEnd >= minGap) {
      free.push({
        startMin: currentEnd,
        endMin: item.startMin,
        durationMin: item.startMin - currentEnd,
      })
    }
    currentEnd = Math.max(currentEnd, item.startMin + item.durationMin)
  }

  // 3. Après le dernier créneau
  if (dayEndMin - currentEnd >= minGap) {
    free.push({
      startMin: currentEnd,
      endMin: dayEndMin,
      durationMin: dayEndMin - currentEnd,
    })
  }

  return free
}

/** Trouve le premier créneau libre après `fromMin` capable d'accueillir la durée requise */
export function findNextFreeSlot(
  item: PlanItem,
  allItems: PlanItem[],
  fromMin?: number,
  dayEndMin = 23 * 60,
): FreeSlot | null {
  // Par défaut, chercher après la fin du créneau actuel ou au moins 15 min après le début
  const startSearchingFrom = fromMin !== undefined ? fromMin : (item.startMin + 15)
  // On exclut l'élément lui-même pour simuler le calendrier sans lui
  const otherItems = allItems.filter((i) => i.key !== item.key)
  const freeSlots = getFreeSlots(otherItems, 5 * 60, dayEndMin, 15)

  // 1. Chercher un créneau libre existant qui commence après startSearchingFrom et qui est assez long
  for (const slot of freeSlots) {
    const effectiveStart = Math.max(slot.startMin, startSearchingFrom)
    if (slot.endMin - effectiveStart >= item.durationMin && effectiveStart >= startSearchingFrom) {
      return {
        startMin: effectiveStart,
        endMin: effectiveStart + item.durationMin,
        durationMin: item.durationMin,
      }
    }
  }

  // 2. Si aucun créneau libre ne convient entre les tâches, on place après la dernière tâche
  const activeOthers = otherItems.filter((i) => i.status !== 'skipped')
  if (activeOthers.length > 0) {
    const lastEnd = Math.max(...activeOthers.map((i) => i.startMin + i.durationMin))
    const start = Math.max(lastEnd, startSearchingFrom)
    if (start + item.durationMin <= dayEndMin) {
      return {
        startMin: start,
        endMin: start + item.durationMin,
        durationMin: item.durationMin,
      }
    }
  }

  return null
}

/** Vérifie si un intervalle chevauche une autre tâche */
export function checkCollision(
  startMin: number,
  durationMin: number,
  items: PlanItem[],
  excludeKey?: string,
): { collision: boolean; collidingItem?: PlanItem } {
  const endMin = startMin + durationMin
  for (const item of items) {
    if (item.key === excludeKey || item.status === 'skipped') continue
    const itemEnd = item.startMin + item.durationMin
    if (startMin < itemEnd && endMin > item.startMin) {
      return { collision: true, collidingItem: item }
    }
  }
  return { collision: false }
}

/** Décale rapidement un créneau (prochain créneau libre, +X min, ou demain) */
export async function postponePlanItem(
  item: PlanItem,
  allItems: PlanItem[],
  action: 'next-free' | { addMinutes: number } | 'tomorrow',
  options?: { isToday?: boolean; nowMin?: number; dayEndMin?: number },
): Promise<{ success: boolean; newStartMin?: number; newDate?: string; message: string }> {
  if (action === 'tomorrow') {
    const nextDate = addDays(item.date, 1)
    await updateOccurrence(item, { date: nextDate })
    return { success: true, newDate: nextDate, message: 'Créneau reporté à demain' }
  }

  if (action === 'next-free') {
    const fromMin =
      options?.isToday && options?.nowMin !== undefined
        ? Math.max(item.startMin + 15, options.nowMin)
        : item.startMin + 15
    const slot = findNextFreeSlot(item, allItems, fromMin, options?.dayEndMin ?? 23 * 60)
    if (!slot) {
      return { success: false, message: 'Aucun créneau libre disponible plus tard aujourd’hui' }
    }
    await updateOccurrence(item, { startMin: slot.startMin })
    return {
      success: true,
      newStartMin: slot.startMin,
      message: `Décalé à ${minutesToTime(slot.startMin)}`,
    }
  }

  if (typeof action === 'object' && 'addMinutes' in action) {
    const maxEnd = (options?.dayEndMin ?? 23 * 60)
    const targetMin = Math.min(maxEnd - item.durationMin, item.startMin + action.addMinutes)
    await updateOccurrence(item, { startMin: targetMin })
    return {
      success: true,
      newStartMin: targetMin,
      message: `Décalé de +${action.addMinutes} min (${minutesToTime(targetMin)})`,
    }
  }

  return { success: false, message: 'Action inconnue' }
}

