import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
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
    <article className="note-card group" id={`note-card-${note.id}`}>
      <header className="note-card-header">
        {showTask && task && <TaskIcon task={task} size={24} />}
        <div className="grow">
          {showTask && task && (
            <Link to={`/tasks/${task.id}`} className="note-card-taskname">
              {task.name}
            </Link>
          )}
          <div className="tiny muted">
            {relativeDayLabel(note.date)}
            {session && <span className="tabular"> · {formatDuration(session.durationMin)}</span>}
          </div>
        </div>
        {note.confidence > 0 && <ConfidenceDots value={note.confidence} />}
        <Link
          to={`/note/${note.sessionId}`}
          className="icon-btn"
          style={{ width: 30, height: 30 }}
          title="Modifier la note"
          aria-label="Modifier la note"
          id={`note-edit-${note.id}`}
        >
          <Pencil size={15} />
        </Link>
      </header>

      {note.learned && <p className="note-card-text">{note.learned}</p>}

      {note.difficulties && (
        <div className="note-card-block">
          <div className="note-card-label">Difficultés</div>
          <p className="note-card-text small">{note.difficulties}</p>
        </div>
      )}

      {note.nextStep && (
        <div className="note-card-block">
          <div className="note-card-label">Prochaine étape</div>
          <p className="note-card-text small">{note.nextStep}</p>
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
