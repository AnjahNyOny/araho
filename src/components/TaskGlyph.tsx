import type { CSSProperties } from 'react'
import {
  BookOpen, Briefcase, Brain, Calculator, Camera, ChefHat, ChartNoAxesColumnIncreasing, Code,
  Dumbbell, Flower2, FlaskConical, Footprints, Globe, Headphones, Languages, Lightbulb,
  Music, Palette, PenLine, Puzzle, Rocket, Sprout, StickyNote, Target, Swords, Code2,
  Gamepad2, ShieldAlert, Cpu, Film, type LucideIcon,
} from 'lucide-react'

export const GLYPHS: Record<string, LucideIcon> = {
  book: BookOpen,
  bookopen: BookOpen,
  code: Code,
  code2: Code2,
  brain: Brain,
  pen: PenLine,
  target: Target,
  dumbbell: Dumbbell,
  lotus: Flower2,
  music: Music,
  palette: Palette,
  globe: Globe,
  languages: Languages,
  chart: ChartNoAxesColumnIncreasing,
  flask: FlaskConical,
  puzzle: Puzzle,
  rocket: Rocket,
  bulb: Lightbulb,
  note: StickyNote,
  headphones: Headphones,
  chef: ChefHat,
  run: Footprints,
  camera: Camera,
  briefcase: Briefcase,
  calculator: Calculator,
  sprout: Sprout,
  swords: Swords,
  gamepad2: Gamepad2,
  gamepad: Gamepad2,
  shieldalert: ShieldAlert,
  shield: ShieldAlert,
  cpu: Cpu,
  film: Film,
}

interface Props {
  icon: string
  color: string
  size?: number
}

export function TaskGlyph({ icon, color, size = 30 }: Props) {
  const cleanKey = (icon || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const Icon = GLYPHS[icon] ?? GLYPHS[cleanKey] ?? Target
  return (
    <span
      className="glyph"
      style={{ '--c': color, width: size, height: size, borderRadius: size * 0.225 } as CSSProperties}
    >
      <Icon size={size * 0.58} strokeWidth={2.1} />
    </span>
  )
}
