import { useMemo, useState } from 'react'
import { Search, BookText } from 'lucide-react'
import { PageHeader, EmptyState } from '../../components/ui'
import { useNotes, useSessions, useTasks } from '../../db/hooks'
import { NoteCard } from './NoteCard'

export function JournalPage() {
  const notes = useNotes()
  const sessions = useSessions()
  const tasks = useTasks(true)

  const [search, setSearch] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')

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
      <PageHeader eyebrow={`${filteredNotes.length} note${filteredNotes.length > 1 ? 's' : ''}`} title="Journal" />

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
    </>
  )
}
