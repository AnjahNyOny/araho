import { Link } from 'react-router-dom'
import { Calendar, Target, HelpCircle, Pencil } from 'lucide-react'
import { ConfidenceDots, TaskIcon } from '../../components/ui'
import { useTask } from '../../db/hooks'
import type { Note, Session } from '../../db/types'
import { formatDuration, relativeDayLabel } from '../../lib/date'

interface NoteCardProps {
  note: Note
  session?: Session
  showTask?: boolean
}

export function NoteCard({ note, session, showTask = false }: NoteCardProps) {
  const task = useTask(showTask ? note.taskId : undefined)

  return (
    <article className="note-card card animate-in" id={`note-card-${note.id}`}>
      <header className="note-card-header">
        <div className="row" style={{ gap: '8px' }}>
          {showTask && task && <TaskIcon task={task} size={28} />}
          <div className="grow">
            {showTask && task && (
              <Link to={`/tasks/${task.id}`} className="note-card-taskname">
                {task.name}
              </Link>
            )}
            <div className="row small faint" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <span className="row" style={{ gap: '4px' }}>
                <Calendar size={13} />
                {relativeDayLabel(note.date)}
              </span>
              {session && (
                <>
                  <span>·</span>
                  <span className="tabular">{formatDuration(session.durationMin)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: '8px' }}>
          {note.confidence > 0 && <ConfidenceDots value={note.confidence} />}
          <Link
            to={`/note/${note.sessionId}`}
            className="icon-btn"
            style={{ width: 32, height: 32 }}
            title="Modifier la note"
            aria-label="Modifier la note"
            id={`note-edit-${note.id}`}
          >
            <Pencil size={14} />
          </Link>
        </div>
      </header>

      {note.learned && (
        <div className="note-card-section">
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>Ce qui a été appris</div>
          <p className="note-card-text learned-text">{note.learned}</p>
        </div>
      )}

      {note.difficulties && (
        <div className="note-card-section difficulties-box">
          <div className="eyebrow row" style={{ gap: '5px', color: 'var(--warning)' }}>
            <HelpCircle size={13} /> Difficultés / Blocages
          </div>
          <p className="note-card-text">{note.difficulties}</p>
        </div>
      )}

      {note.nextStep && (
        <div className="note-card-section nextstep-box">
          <div className="eyebrow row" style={{ gap: '5px', color: 'var(--accent-2)' }}>
            <Target size={13} /> Prochaine étape
          </div>
          <p className="note-card-text">{note.nextStep}</p>
        </div>
      )}

      {note.tags && note.tags.length > 0 && (
        <footer className="note-card-tags">
          {note.tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
        </footer>
      )}
    </article>
  )
}
