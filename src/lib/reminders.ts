import { useEffect } from 'react'
import { db } from '../db/db'
import type { Task } from '../db/types'
import * as repo from '../db/repo'
import { formatDuration, minutesToTime, today } from './date'
import { playReminderChime } from './sound'

export interface ReminderConfig {
  enabled: boolean
  sound: boolean
  leadMin: number
}

const STORAGE_KEY_CONFIG = 'araho_reminders_config'

export function getReminderConfig(): ReminderConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { enabled: true, sound: true, leadMin: 5 }
}

export function saveReminderConfig(config: ReminderConfig): void {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config))
  window.dispatchEvent(new CustomEvent('araho_reminders_config_changed'))
}

function getAlertedSetForToday(): Set<string> {
  const key = `araho_alerted_slots_${today()}`
  try {
    const raw = localStorage.getItem(key)
    if (raw) return new Set(JSON.parse(raw))
  } catch {}
  return new Set()
}

function markAlertedForToday(slotKey: string): void {
  const key = `araho_alerted_slots_${today()}`
  const set = getAlertedSetForToday()
  set.add(slotKey)
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)))
  } catch {}
}

/**
 * Parcourt les créneaux planifiés d'aujourd'hui et déclenche
 * le carillon sonore et la notification système si un créneau commence dans les 5 minutes.
 */
export async function checkSlotReminders(): Promise<void> {
  const config = getReminderConfig()
  if (!config.enabled) return

  const now = new Date()
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const todayDate = today()

  try {
    const [items, tasks] = await Promise.all([
      repo.getDayPlan(todayDate),
      db.tasks.toArray(),
    ])

    const tasksMap = new Map<string, Task>(tasks.map((t: Task) => [t.id, t]))
    const alerted = getAlertedSetForToday()

    for (const item of items) {
      if (item.status !== 'planned') continue

      const diff = item.startMin - currentMin

      // Alerte si le créneau commence dans les minutes configurées (ex: 5 min)
      if (diff >= 0 && diff <= config.leadMin && !alerted.has(item.key)) {
        markAlertedForToday(item.key)

        const task = tasksMap.get(item.taskId)
        const taskName = task?.name ?? 'Tâche planifiée'

        // 1. Carillon sonore doux
        if (config.sound) {
          playReminderChime()
        }

        // 2. Notification système
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          const timeText = diff === 0 ? 'maintenant' : `dans ${diff} min`
          try {
            const notif = new Notification(`⏰ Créneau ${timeText} : ${taskName}`, {
              body: `${minutesToTime(item.startMin)} – ${minutesToTime(item.startMin + item.durationMin)} (${formatDuration(item.durationMin)})\nPrépare-toi pour ta session d'apprentissage.`,
              icon: '/icons/icon-192.png',
              tag: `slot-${item.key}`,
            })

            notif.onclick = () => {
              window.focus()
              notif.close()
            }
          } catch (notifErr) {
            console.warn('Erreur affichage notification créneau:', notifErr)
          }
        }
      }
    }
  } catch (err) {
    console.warn('Erreur vérification rappels créneaux:', err)
  }
}

/**
 * Hook React pour surveiller les créneaux en continu en tâche de fond.
 */
export function useSlotReminders(): void {
  useEffect(() => {
    // Vérification immédiate
    checkSlotReminders()

    // Vérifie toutes les 25 secondes
    const interval = setInterval(checkSlotReminders, 25_000)

    // Vérifie aussi au réveil de l'écran ou au retour sur l'onglet
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSlotReminders()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}
