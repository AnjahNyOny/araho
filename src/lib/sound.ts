/**
 * Module Audio & Notifications pour Araho
 * Utilise la Web Audio API (100% hors ligne, sans fichier externe lourd)
 * pour produire un carillon doux et harmonieux type Apple Watch / cloche zen.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

/**
 * Joue un carillon doux et chaleureux à 3 notes harmoniques (E5, G#5, B5)
 * avec une enveloppe douce et une résonance naturelle.
 */
export function playCompletionChime(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Accord doux : Mi5 (659Hz), Sol#5 (830Hz), Si5 (987Hz), Mi6 (1318Hz)
    const notes = [
      { freq: 659.25, time: now + 0.00, duration: 1.8, gain: 0.28 },
      { freq: 830.61, time: now + 0.12, duration: 1.9, gain: 0.24 },
      { freq: 987.77, time: now + 0.24, duration: 2.1, gain: 0.22 },
      { freq: 1318.51, time: now + 0.36, duration: 2.4, gain: 0.18 },
    ]

    for (const { freq, time, duration, gain } of notes) {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()

      // Onde sinusoïdale pure pour un son cristallin et doux
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, time)

      // Enveloppe d'attaque douce et extinction progressive (decay naturel)
      gainNode.gain.setValueAtTime(0.001, time)
      gainNode.gain.exponentialRampToValueAtTime(gain, time + 0.04)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration)

      osc.connect(gainNode)
      gainNode.connect(ctx.destination)

      osc.start(time)
      osc.stop(time + duration)
    }
  } catch (err) {
    console.warn('Impossible de jouer le son de fin de session:', err)
  }
}

/**
 * Joue un carillon doux à 2 notes pour les rappels de début de créneau (La5 880Hz, Do#6 1108Hz)
 */
export function playReminderChime(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const notes = [
      { freq: 880.0, time: now + 0.0, duration: 1.1, gain: 0.22 },
      { freq: 1108.73, time: now + 0.14, duration: 1.5, gain: 0.26 },
    ]

    for (const { freq, time, duration, gain } of notes) {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, time)

      gainNode.gain.setValueAtTime(0.001, time)
      gainNode.gain.exponentialRampToValueAtTime(gain, time + 0.03)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration)

      osc.connect(gainNode)
      gainNode.connect(ctx.destination)

      osc.start(time)
      osc.stop(time + duration)
    }
  } catch (err) {
    console.warn('Impossible de jouer le son de rappel:', err)
  }
}

/**
 * Demande la permission pour les notifications système (si pas encore accordée)
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  try {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  } catch {
    return false
  }
}

/**
 * Déclenche une notification système de fin de session
 */
export function notifySessionComplete(taskName: string, durationMin: number): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    const notification = new Notification(`Session terminée : ${taskName} ! 🎉`, {
      body: `Objectif de ${durationMin} min atteint. Prends une minute pour documenter ce que tu as appris.`,
      icon: '/icons/icon-192.png',
      tag: 'session-complete',
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch (err) {
    console.warn('Erreur notification fin de session:', err)
  }
}
