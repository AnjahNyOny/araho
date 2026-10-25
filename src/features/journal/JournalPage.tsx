import { useMemo, useState } from 'react'
import { Search, BookText, FileDown, Brain } from 'lucide-react'
import { PageHeader, EmptyState } from '../../components/ui'
import { useNotes, useSessions, useTasks } from '../../db/hooks'
import { exportNotesToMarkdown } from '../../lib/exportMarkdown'
import { getDueNotes } from '../../lib/spacedRepetition'
import { SpacedReviewSheet } from './SpacedReviewSheet'
import { NoteCard } from './NoteCard'

export function JournalPage() {
  const notes = useNotes()
  const sessions = useSessions()
  const tasks = useTasks(true)

  const [search, setSearch] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [reviewOpen, setReviewOpen] = useState(false)

  const dueNotes = useMemo(() => (notes ? getDueNotes(notes) : []), [notes])
  const sessionMap = useMemo(() => new Map((sessions ?? []).map((s) => [s.id, s])), [sessions])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes ?? []) for (const t of n.tags || []) set.add(t)
    return Array.from(set).sort()
  }, [notes])

  const filteredNotes = useMemo(() => {
    if (!notes) return []
    const q = search.trim().toLowerCase()
    return notes.filter((n) => {
      if (selectedTaskId !== 'all' && n.taskId !== selectedTaskId) return false
      if (selectedTag !== 'all' && !(n.tags || []).includes(selectedTag)) return false
      if (!q) return true
      return (
        n.learned.toLowerCase().includes(q) ||
        !!n.difficulties?.toLowerCase().includes(q) ||
        !!n.nextStep?.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [notes, search, selectedTaskId, selectedTag])

  return (
    <>
      <PageHeader
        eyebrow={`${filteredNotes.length} note${filteredNotes.length > 1 ? 's' : ''}`}
        title="Journal"
        actions={
          <div className="row" style={{ gap: 6 }}>
            {dueNotes.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setReviewOpen(true)}
                title="Lancer une révision espacée"
                id="journal-spaced-btn"
                style={{ color: 'var(--sys-purple)' }}
              >
                <Brain size={15} /> Réviser ({dueNotes.length})
              </button>
            )}
            {filteredNotes.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const map = new Map((tasks ?? []).map((t) => [t.id, t]))
                  const taskObj = selectedTaskId !== 'all' ? tasks?.find((t) => t.id === selectedTaskId) : undefined
                  const sub = taskObj ? ` — ${taskObj.name}` : ''
                  exportNotesToMarkdown(filteredNotes, map, `Journal${sub}`)
                }}
                title="Exporter les notes en Markdown (.md)"
                id="export-journal-md"
              >
                <FileDown size={15} /> Exporter .md
              </button>
            )}
          </div>
        }
      />

      <div className="search-box">
        <Search size={17} className="muted" />
        <input
          id="journal-search"
          type="search"
          className="search-input"
          placeholder="Rechercher"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {(tasks?.length ?? 0) > 1 || allTags.length > 0 ? (
        <div className="filters">
          <div className="chips">
            <button
              className={`chip chip-sm ${selectedTaskId === 'all' ? 'is-active' : ''}`}
              id="journal-filter-all"
              onClick={() => setSelectedTaskId('all')}
            >
              Toutes
            </button>
            {tasks?.map((t) => (
              <button
                key={t.id}
                className={`chip chip-sm ${selectedTaskId === t.id ? 'is-active' : ''}`}
                id={`journal-filter-${t.id}`}
                onClick={() => setSelectedTaskId(selectedTaskId === t.id ? 'all' : t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
          {allTags.length > 0 && (
            <div className="chips">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={`chip chip-sm ${selectedTag === tag ? 'is-active' : ''}`}
                  onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {notes && notes.length === 0 ? (
        <EmptyState
          icon={<BookText size={56} strokeWidth={1.4} />}
          title="Aucune note"
          text="À la fin de chaque session, note ce que tu as appris. Elles apparaîtront ici."
        />
      ) : filteredNotes.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '40px 16px' }}>
          Aucun résultat
        </p>
      ) : (
        <div className="notes-list">
          {filteredNotes.map((note) => (
            <NoteCard key={note.id} note={note} session={sessionMap.get(note.sessionId)} showTask />
          ))}
        </div>
      )}

      {tasks && (
        <SpacedReviewSheet
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          notes={dueNotes}
          tasksMap={new Map((tasks ?? []).map((t) => [t.id, t]))}
        />
      )}
    </>
  )
}
