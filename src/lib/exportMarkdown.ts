import type { Note, Task } from '../db/types'
import { formatDayLong, today } from './date'

/**
 * Génère et télécharge un document Markdown structuré pour Obsidian, Notion ou relecture.
 */
export function exportNotesToMarkdown(
  notes: Note[],
  tasksMap: Map<string, Task>,
  title: string = 'Journal d’apprentissage',
  filename?: string
): void {
  if (notes.length === 0) {
    alert('Aucune note à exporter.')
    return
  }

  const lines: string[] = []

  // Frontmatter YAML pour compatibilité Obsidian / Notion
  lines.push('---')
  lines.push(`title: "${title.replace(/"/g, '\\"')}"`)
  lines.push(`exported_at: "${new Date().toISOString()}"`)
  lines.push(`notes_count: ${notes.length}`)
  lines.push('generator: Araho')
  lines.push('---')
  lines.push('')

  // Titre principal
  lines.push(`# ${title}`)
  lines.push(`> *Document généré le ${formatDayLong(today())} · ${notes.length} note${notes.length > 1 ? 's' : ''} documentée${notes.length > 1 ? 's' : ''}*`)
  lines.push('')

  // Tri par date décroissante
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)

  for (const note of sorted) {
    const task = tasksMap.get(note.taskId)
    const taskName = task?.name || 'Tâche'
    const confidenceStars = note.confidence ? '★'.repeat(note.confidence) + '☆'.repeat(5 - note.confidence) : 'Non évalué'

    lines.push(`## 📅 ${formatDayLong(note.date)} — ${taskName}`)
    lines.push(`*Niveau de compréhension : ${confidenceStars} (${note.confidence}/5)*`)

    if (note.tags && note.tags.length > 0) {
      lines.push(`*Tags : ${note.tags.map((t) => `#${t.replace(/\s+/g, '_')}`).join(' ')}*`)
    }
    lines.push('')

    if (note.learned) {
      lines.push('### 💡 Ce que j’ai appris')
      lines.push(note.learned.trim())
      lines.push('')
    }

    if (note.difficulties) {
      lines.push('### ⚠️ Difficultés rencontrées')
      lines.push(note.difficulties.trim())
      lines.push('')
    }

    if (note.nextStep) {
      lines.push('### 🎯 Prochaine étape')
      lines.push(note.nextStep.trim())
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const cleanFilename = filename || `araho-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${today()}.md`
  const link = document.createElement('a')
  link.href = url
  link.download = cleanFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Exporte le bilan hebdomadaire complet en document Markdown pour Obsidian/Notion.
 */
export function exportWeeklyReviewToMarkdown(
  stats: import('../db/stats').WeeklyReviewStats,
  tasksMap: Map<string, Task>,
  notes: Note[],
): void {
  const startDate = stats.weekDays[0]
  const endDate = stats.weekDays[stats.weekDays.length - 1]
  const title = `Bilan hebdomadaire (${startDate} au ${endDate})`

  const lines: string[] = []
  lines.push('---')
  lines.push(`title: "${title}"`)
  lines.push(`period_start: "${startDate}"`)
  lines.push(`period_end: "${endDate}"`)
  lines.push(`total_minutes: ${stats.totalMin}`)
  lines.push(`active_days: ${stats.activeDaysCount}`)
  lines.push('generator: Araho')
  lines.push('---')
  lines.push('')
  lines.push(`# 📊 ${title}`)
  lines.push(`> *Document généré le ${formatDayLong(today())} · Temps total : ${Math.floor(stats.totalMin / 60)}h${stats.totalMin % 60 ? (stats.totalMin % 60) + 'm' : ''}*`)
  lines.push('')

  if (stats.diffPercent !== null) {
    const sign = stats.diffMin >= 0 ? '+' : ''
    lines.push(`**Évolution vs semaine passée :** ${sign}${Math.floor(Math.abs(stats.diffMin) / 60)}h${Math.abs(stats.diffMin) % 60 ? (Math.abs(stats.diffMin) % 60) + 'm' : ''} (${sign}${stats.diffPercent}%)`)
    lines.push('')
  }

  lines.push('## ⏱️ Répartition par tâche')
  for (const t of stats.taskBreakdown) {
    const taskName = tasksMap.get(t.taskId)?.name || 'Tâche'
    const durationStr = `${Math.floor(t.min / 60)}h${t.min % 60 ? (t.min % 60) + 'm' : ''}`
    lines.push(`- **${taskName}** : ${durationStr} (${t.percent}%)`)
  }
  lines.push('')

  lines.push('## 📅 Activité par jour')
  for (const d of stats.dailyBreakdown) {
    const durationStr = d.min > 0 ? `${Math.floor(d.min / 60)}h${d.min % 60 ? (d.min % 60) + 'm' : ''}` : '0 min'
    lines.push(`- **${formatDayLong(d.date)}** : ${durationStr}`)
  }
  lines.push('')

  if (notes.length > 0) {
    lines.push('## 💡 Ce que j’ai appris cette semaine')
    for (const n of notes) {
      const taskName = tasksMap.get(n.taskId)?.name || 'Tâche'
      lines.push(`### ${formatDayLong(n.date)} — ${taskName}`)
      if (n.learned) lines.push(n.learned.trim())
      if (n.difficulties) lines.push(`*Difficulté :* ${n.difficulties.trim()}`)
      if (n.nextStep) lines.push(`*Prochaine étape :* ${n.nextStep.trim()}`)
      lines.push('')
    }
  }

  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `araho-bilan-semaine-${startDate}-au-${endDate}.md`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
