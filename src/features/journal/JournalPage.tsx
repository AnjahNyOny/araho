import { useMemo, useState } from 'react'
import { Search, NotebookPen, Filter } from 'lucide-react'
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

  // Collect all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes ?? []) {
      for (const t of n.tags || []) set.add(t)
    }
    return Array.from(set).sort()
  }, [notes])

  // Filtered notes
  const filteredNotes = useMemo(() => {
    if (!notes) return []
    const q = search.trim().toLowerCase()

    return notes.filter((n) => {
      if (selectedTaskId !== 'all' && n.taskId !== selectedTaskId) return false
      if (selectedTag !== 'all' && !(n.tags || []).includes(selectedTag)) return false
      if (!q) return true

      const matchLearned = n.learned.toLowerCase().includes(q)
      const matchDiff = n.difficulties?.toLowerCase().includes(q)
      const matchNext = n.nextStep?.toLowerCase().includes(q)
      const matchTags = (n.tags || []).some((t) => t.toLowerCase().includes(q))
      return matchLearned || matchDiff || matchNext || matchTags
    })
  }, [notes, search, selectedTaskId, selectedTag])

  return (
    <>
      <PageHeader
        eyebrow="Journal d'apprentissage"
        title="Ce que j'ai appris"
        actions={
          <span className="small muted">
            {filteredNotes.length} note{filteredNotes.length > 1 ? 's' : ''}
          </span>
        }
      />

      <div className="journal-controls card card-pad animate-in" style={{ marginBottom: 20 }}>
        <div className="search-box">
          <Search size={18} className="faint" />
          <input
            id="journal-search"
            type="search"
            className="search-input"
            placeholder="Rechercher dans mes apprentissages, tags, blocages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="row spread" style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="row tiny faint" style={{ gap: 4 }}>
              <Filter size={13} /> Tâche :
            </span>
            <select
              id="journal-filter-task"
              className="select-filter"
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
            >
              <option value="all">Toutes les tâches</option>
              {tasks?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </select>
          </div>

          {allTags.length > 0 && (
            <div className="chips">
              <button
                type="button"
                className={`chip chip-sm ${selectedTag === 'all' ? 'is-active' : ''}`}
                onClick={() => setSelectedTag('all')}
              >
                Tous les tags
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`chip chip-sm ${selectedTag === tag ? 'is-active' : ''}`}
                  onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {notes && notes.length === 0 ? (
        <EmptyState
          icon={<NotebookPen size={28} />}
          title="Aucune documentation pour le moment"
          text="Chaque fois que tu termines une session de travail, documente brièvement ce que tu as appris pour garder trace de tes progrès."
        />
      ) : filteredNotes.length === 0 ? (
        <div className="card card-pad muted small" style={{ textAlign: 'center', padding: '36px 16px' }}>
          Aucune note ne correspond à tes filtres de recherche.
        </div>
      ) : (
        <div className="notes-timeline stagger">
          {filteredNotes.map((note) => (
            <NoteCard key={note.id} note={note} session={sessionMap.get(note.sessionId)} showTask />
          ))}
        </div>
      )}
    </>
  )
}
