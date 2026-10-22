/** Couleurs des tâches : couleurs système Apple (variables CSS, adaptées clair/sombre). */
export const TASK_COLORS = [
  { name: 'Bleu', value: 'var(--sys-blue)' },
  { name: 'Vert', value: 'var(--sys-green)' },
  { name: 'Orange', value: 'var(--sys-orange)' },
  { name: 'Rouge', value: 'var(--sys-red)' },
  { name: 'Rose', value: 'var(--sys-pink)' },
  { name: 'Violet', value: 'var(--sys-purple)' },
  { name: 'Indigo', value: 'var(--sys-indigo)' },
  { name: 'Ciel', value: 'var(--sys-cyan)' },
  { name: 'Menthe', value: 'var(--sys-mint)' },
  { name: 'Jaune', value: 'var(--sys-yellow)' },
] as const

/** Clés d'icônes (résolues vers des symboles Lucide dans components/TaskGlyph). */
export const TASK_ICONS = [
  'book', 'code', 'brain', 'pen', 'target', 'dumbbell', 'lotus', 'music',
  'palette', 'globe', 'languages', 'chart', 'flask', 'puzzle', 'rocket', 'bulb',
  'note', 'headphones', 'chef', 'run', 'camera', 'briefcase', 'calculator', 'sprout',
] as const

export const DEFAULT_COLOR: string = TASK_COLORS[0].value
export const DEFAULT_ICON = 'target'
