#!/usr/bin/env node
/**
 * Génère un fichier d'import Araho à partir du plan d'apprentissage (Markdown).
 *
 *   node scripts/import-plan.mjs "<plan.md>" --week 0,1 [--archive-others] [--out fichier.json]
 *
 * Le fichier produit s'importe dans l'app : Réglages → Importer.
 * - 4 tâches (Bloc 1, Bloc 2, Bloc 3, Bilan) dont la description donne les objectifs
 *   et le livrable des semaines importées ;
 * - un créneau par session et par jour des semaines demandées ;
 * - les listes de validation de toutes les phases, sur la tâche Bilan.
 * Les identifiants sont stables : réimporter met à jour sans dupliquer, et l'app conserve
 * les créneaux déjà faits ou sautés ainsi que les cases déjà cochées.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/* ------------------------------------------------------------------ */
/* Arguments                                                           */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const planPath = args.find((a, i) => !a.startsWith('--') && !['--week', '--out'].includes(args[i - 1]))
const weekArg = flag('--week')
if (!planPath || !weekArg) {
  console.error('Usage : node scripts/import-plan.mjs "<plan.md>" --week 0,1 [--archive-others] [--out fichier.json]')
  process.exit(1)
}
const weeks = weekArg.split(',').map((w) => Number(w.trim().replace(/^S/i, '')))
if (weeks.some((w) => !Number.isInteger(w) || w < 0)) {
  console.error(`Semaines invalides : ${weekArg}`)
  process.exit(1)
}
const pad = (n) => String(n).padStart(2, '0')
const outPath =
  flag('--out') ?? `imports/plan-${weeks.map((w) => `S${pad(w)}`).join('-')}.json`

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTHS = { janv: 1, févr: 2, mars: 3, avr: 4, mai: 5, juin: 6, juil: 7, août: 8, sept: 9, oct: 10, nov: 11, déc: 12 }

const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
const addDays = (s, n) => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}
const dayOfWeek = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Toutes les dates « 29 oct. », « 1er nov. 2026 » d'un intervalle, la dernière portant l'année. */
function parseRange(text) {
  const parts = [...text.matchAll(/(\d{1,2})(?:er)?(?:\s+([a-zéû]+)\.?)?(?:\s+(\d{4}))?/g)].map((m) => ({
    d: Number(m[1]),
    month: m[2] ? MONTHS[m[2]] : undefined,
    year: m[3] ? Number(m[3]) : undefined,
  }))
  // Une date incomplète hérite de la suivante : « 16 – 29 août 2027 », « 28 déc. – 3 janv. 2027 »
  for (let i = parts.length - 2; i >= 0; i--) {
    const next = parts[i + 1]
    parts[i].month ??= next.month
    parts[i].year ??= parts[i].month > next.month ? next.year - 1 : next.year
  }
  if (parts.some((p) => !p.month || !p.year)) throw new Error(`Dates illisibles : « ${text} »`)
  return parts.map((p) => iso(p.year, p.month, p.d))
}

const toMin = (h, m) => Number(h) * 60 + Number(m || 0)

/* ------------------------------------------------------------------ */
/* Lecture du Markdown                                                 */
/* ------------------------------------------------------------------ */

const md = readFileSync(planPath, 'utf8')
const sections = md.split(/^## /m).slice(1).map((s) => {
  const nl = s.indexOf('\n')
  return { title: s.slice(0, nl).trim(), body: s.slice(nl + 1) }
})
const section = (prefix) => {
  const s = sections.find((x) => x.title.startsWith(prefix))
  if (!s) throw new Error(`Section introuvable dans le plan : « ${prefix} »`)
  return s
}

/** Tableaux Markdown d'un texte, chacun précédé du paragraphe qui l'introduit. */
function tables(text) {
  const lines = text.split('\n')
  const result = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('|') || !lines[i + 1]?.startsWith('| ---')) continue
    const cells = (l) => l.slice(1, -1).split('|').map((c) => c.trim())
    const header = cells(lines[i])
    const rows = []
    let j = i + 2
    for (; j < lines.length && lines[j].startsWith('|'); j++) rows.push(cells(lines[j]))
    const before = lines.slice(0, i).reverse().find((l) => l.trim()) ?? ''
    result.push({ header, rows, before })
    i = j
  }
  return result
}

const checklist = (text) =>
  [...text.matchAll(/^- \[( |x)\] (.+)$/gm)].map((m) => ({ label: clean(m[2]), checked: m[1] === 'x' }))

/** Retire la mise en forme Markdown (gras, code) pour l'affichage dans l'app. */
const clean = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\*(.+?)\*/g, '$1').trim()

const paragraph = (text, prefix) => {
  const line = text.split('\n').find((l) => l.startsWith(prefix))
  return line ? clean(line.slice(prefix.length)) : ''
}

/* Sessions et horaires */
const SESSION_KEYS = ['bloc1', 'bloc2', 'bloc3', 'bilan']
const sessionTable = tables(section('Structure des sessions').body)[0]
const sessions = sessionTable.rows.map((row, i) => {
  const [label, horaire, role] = row
  const m = horaire.match(/(\d{1,2})\s*h\s*(\d{2})?\s*–\s*(\d{1,2})\s*h\s*(\d{2})?/)
  if (!m) throw new Error(`Horaire illisible : « ${horaire} »`)
  const startMin = toMin(m[1], m[2])
  return { key: SESSION_KEYS[i], name: clean(label), startMin, durationMin: toMin(m[3], m[4]) - startMin, role: clean(role) }
})
if (sessions.length !== 4) throw new Error(`4 sessions attendues, ${sessions.length} trouvées`)
const S = Object.fromEntries(sessions.map((s) => [s.key, s]))

/* Semaine 0 */
const s0 = section('Semaine 0')
const [s0Start, s0End] = parseRange(s0.title.match(/\((.+)\)/)[1])
const s1Monday = addDays(s0End, 1)
const week0 = {
  num: 0,
  title: `Semaine 0 : ${s0.title.match(/:\s*([^(]+)/)[1].trim()}`,
  dates: Array.from({ length: (dayOfWeek(s0End) - dayOfWeek(s0Start) + 7) % 7 + 1 }, (_, i) => addDays(s0Start, i)),
  goal: paragraph(s0.body, 'Objectif : '),
  days: Object.fromEntries(
    tables(s0.body)[0].rows.map((r, i) => [addDays(s0Start, i), { label: r[0], text: clean(r[1]) }]),
  ),
}

/* Phases */
const phases = sections
  .filter((s) => /^Phase \d+/.test(s.title))
  .map((s) => {
    const num = Number(s.title.match(/^Phase (\d+)/)[1])
    const paren = s.title.match(/\(([^)]+)\)/)[1]
    const range = paren.replace(/^S\d+–S\d+,\s*/, '')
    const ts = tables(s.body)
    const weekTable = ts.find((t) => t.header[0].startsWith('Sem'))
    const details = ts.filter((t) => /Détail de S(\d+)/.test(t.before))
    return {
      num,
      title: s.title.replace(/\s*\(.+\)\s*$/, ''),
      endDate: parseRange(range).at(-1),
      goal: paragraph(s.body, 'Objectif de phase : '),
      checklist: checklist(s.body),
      weeks: weekTable.rows.map((r) => {
        const n = Number(r[0].replace(/^S/, ''))
        const detail = details.find((d) => Number(d.before.match(/Détail de S(\d+)/)[1]) === n)
        return {
          num: n,
          label: r[0],
          range: r[1],
          bloc1: clean(r[2]),
          bloc2: clean(r[3]),
          bloc3: clean(r[4]),
          deliverable: clean(r[5]),
          detail: detail?.rows.map((d) => ({ label: d[0], bloc1: clean(d[1]), bloc2: clean(d[2]), bloc3: clean(d[3]) })),
        }
      }),
    }
  })

/* ------------------------------------------------------------------ */
/* Construction de l'import                                            */
/* ------------------------------------------------------------------ */

const TASK_IDS = Object.fromEntries(SESSION_KEYS.map((k) => [k, `plan-${k}`]))
const STYLE = {
  bloc1: { icon: 'book', color: 'var(--sys-blue)' },
  bloc2: { icon: 'puzzle', color: 'var(--sys-purple)' },
  bloc3: { icon: 'code', color: 'var(--sys-orange)' },
  bilan: { icon: 'pen', color: 'var(--sys-green)' },
}
const FULL_DAY = ['bloc1', 'bloc2', 'bloc3', 'bilan']

/** Sessions planifiées un jour donné. Semaine 0 allégée : jeu./ven. installation, sam. essai, dim. bilan. */
function sessionsFor(weekNum, date) {
  const dow = dayOfWeek(date)
  if (weekNum === 0) {
    if (dow === 6) return FULL_DAY
    if (dow === 0) return ['bloc2', 'bilan']
    return ['bloc3', 'bilan']
  }
  return dow === 0 ? ['bloc2'] : FULL_DAY
}

function findWeek(n) {
  for (const p of phases) {
    const w = p.weeks.find((x) => x.num === n)
    if (w) return { phase: p, week: w }
  }
  throw new Error(`Semaine S${n} introuvable dans le plan`)
}

const slots = []
const desc = { bloc1: [], bloc2: [], bloc3: [], bilan: [] }

for (const n of weeks) {
  if (n === 0) {
    for (const date of week0.dates) {
      for (const key of sessionsFor(0, date)) {
        slots.push(slot(date, key))
        // L'objectif du jour va aux sessions de travail ; celui du dimanche (bilan de l'essai) au Bilan
        if ((key === 'bilan') === (dayOfWeek(date) === 0)) {
          desc[key].push(`${week0.days[date].label} : ${week0.days[date].text}`)
        }
      }
    }
    for (const key of SESSION_KEYS) desc[key].unshift(`${week0.title} — ${week0.goal}`)
    desc.bilan.push('Validation : voir la liste « Semaine 0 » ci-dessous.')
    continue
  }

  const { phase, week } = findWeek(n)
  const monday = addDays(s1Monday, (n - 1) * 7)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  for (const date of dates) for (const key of sessionsFor(n, date)) slots.push(slot(date, key))

  const head = `${week.label} · ${week.range}`
  desc.bloc1.push(`${head} — ${week.bloc1}`)
  desc.bloc2.push(`${head} — ${week.bloc2}`)
  desc.bloc3.push(`${head} — ${week.bloc3}`)
  if (week.detail) {
    for (const d of week.detail) {
      for (const key of ['bloc1', 'bloc2', 'bloc3']) if (d[key] !== 'Libre') desc[key].push(`${d.label} : ${d[key]}`)
    }
  } else {
    desc.bloc1.push('Sam : révision de la semaine (relire ses notes, refaire de mémoire un exercice difficile)')
    desc.bloc3.push('Sam : terminer le livrable')
  }
  desc.bloc3.push(`Livrable : ${week.deliverable}`)
  desc.bilan.push(`${head} — ${phase.title}`, `Objectif de phase : ${phase.goal}`, `Livrable de la semaine : ${week.deliverable}`)
}

function slot(date, key) {
  const s = S[key]
  return {
    id: `plan-slot-${date}-${key}`,
    taskId: TASK_IDS[key],
    date,
    startMin: s.startMin,
    durationMin: s.durationMin,
    status: 'planned',
    recurrenceId: null,
  }
}

const baseTime = Date.UTC(2026, 9, 28)
const tasks = sessions.map((s, i) => ({
  id: TASK_IDS[s.key],
  name: s.name,
  description: [...desc[s.key], '', `Rôle : ${s.role}`].join('\n').trim(),
  ...STYLE[s.key],
  dailyGoalMin: s.durationMin,
  startDate: s0Start,
  archived: 0,
  createdAt: baseTime + i,
}))

const groups = [
  { id: 'plan-semaine-0', title: week0.title, dueDate: s0End, items: checklist(s0.body) },
  ...phases.map((p) => ({ id: `plan-phase-${p.num}`, title: p.title, dueDate: p.endDate, items: p.checklist })),
]
const checklistItems = groups.flatMap((g) =>
  g.items.map((it, i) => ({
    id: `${g.id}-${pad(i + 1)}`,
    groupId: g.id,
    groupTitle: g.title,
    taskId: TASK_IDS.bilan,
    dueDate: g.dueDate,
    position: i,
    label: it.label,
    checked: it.checked ? 1 : 0,
    checkedAt: null,
    createdAt: baseTime,
  })),
)

const data = { tasks, slots, checklistItems }
if (args.includes('--archive-others')) data.archiveTasksNotIn = Object.values(TASK_IDS)

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify({ app: 'araho', version: 1, exportedAt: new Date().toISOString(), data }, null, 2))

console.log(`✓ ${outPath}`)
console.log(`  ${tasks.length} tâches, ${slots.length} créneaux (${weeks.map((w) => `S${w}`).join(', ')}), ${checklistItems.length} éléments de validation`)
if (data.archiveTasksNotIn) console.log('  Les autres tâches actives seront archivées.')
console.log('  À importer dans l’app : Réglages → Importer.')
