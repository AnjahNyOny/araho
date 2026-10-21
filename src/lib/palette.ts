/** Palette de couleurs des tâches (harmonisée avec le thème sombre). */
export const TASK_COLORS = [
  { name: 'Violet', value: 'hsl(258 88% 70%)' },
  { name: 'Indigo', value: 'hsl(232 85% 70%)' },
  { name: 'Ciel', value: 'hsl(200 92% 62%)' },
  { name: 'Turquoise', value: 'hsl(174 72% 52%)' },
  { name: 'Menthe', value: 'hsl(152 62% 55%)' },
  { name: 'Citron', value: 'hsl(78 70% 55%)' },
  { name: 'Ambre', value: 'hsl(40 95% 60%)' },
  { name: 'Corail', value: 'hsl(14 90% 64%)' },
  { name: 'Framboise', value: 'hsl(342 85% 66%)' },
  { name: 'Orchidée', value: 'hsl(296 70% 68%)' },
] as const

export const TASK_ICONS = [
  '📚', '💻', '🧠', '✍️', '🎯', '🏋️', '🧘', '🎸',
  '🎨', '🌍', '🗣️', '📈', '🔬', '🧩', '🚀', '💡',
  '📝', '🎧', '🍳', '🏃', '📷', '💼', '🧮', '🌱',
]

export const DEFAULT_COLOR = TASK_COLORS[0].value
export const DEFAULT_ICON = '🎯'
