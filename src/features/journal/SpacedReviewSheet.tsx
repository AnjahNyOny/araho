import { useState } from 'react'
import { Sparkles, CheckCircle, RotateCcw, Eye, ArrowRight } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import type { Note, Task } from '../../db/types'
import { formatDayLong } from '../../lib/date'
import { recordReviewResult } from '../../lib/spacedRepetition'
import { TaskIcon } from '../../components/ui'

interface SpacedReviewSheetProps {
  open: boolean
  onClose: () => void
  notes: Note[]
  tasksMap: Map<string, Task>
}

export function SpacedReviewSheet({ open, onClose, notes, tasksMap }: SpacedReviewSheetProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  const isCompleted = currentIndex >= notes.length
  const currentNote = !isCompleted ? notes[currentIndex] : null
  const currentTask = currentNote ? tasksMap.get(currentNote.taskId) : null

  const handleAnswer = (quality: 'again' | 'good') => {
    if (!currentNote) return
    recordReviewResult(currentNote.id, quality)
    setRevealed(false)
    setCurrentIndex((prev) => prev + 1)
    setReviewedCount((prev) => prev + 1)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      id="spaced-review"
      eyebrow="Ancrage mémoriel"
      title="Révision espacée"
      subtitle={!isCompleted && notes.length > 0 ? `Carte ${currentIndex + 1} sur ${notes.length}` : undefined}
    >
      {isCompleted ? (
        <div className="group stat-hero animate-in">
          <div className="review-done-icon">
            <CheckCircle size={34} strokeWidth={2} />
          </div>
          <h2 className="title mb-2">Révision terminée</h2>
          <p className="muted small mb-5">
            {reviewedCount > 0
              ? `Tu as réactivé ${reviewedCount} apprentissage${reviewedCount > 1 ? 's' : ''} aujourd'hui. Tes acquis sont durablement consolidés.`
              : 'Tous tes apprentissages sont à jour pour le moment.'}
          </p>
          <button className="btn btn-primary btn-lg" onClick={onClose}>
            Terminer
          </button>
        </div>
      ) : currentNote && currentTask ? (
        <div className="animate-in">
          <div className="group review-card">
            <div>
              <div className="row spread mb-4">
                <div className="row gap-2">
                  <TaskIcon task={currentTask} size={28} />
                  <span className="strong">{currentTask.name}</span>
                </div>
                <span className="tiny muted">{formatDayLong(currentNote.date)}</span>
              </div>

              {!revealed ? (
                <div className="review-prompt">
                  <div className="review-question">Te souviens-tu de ce que tu as appris lors de cette session ?</div>
                  <p className="small muted">
                    Fais l’effort de te remémorer les points clés avant de retourner la carte.
                  </p>
                </div>
              ) : (
                <div className="review-answer animate-in">
                  <div>
                    <div className="review-label">Ce que tu as noté</div>
                    <p className="note-card-text">{currentNote.learned}</p>
                  </div>
                  {currentNote.difficulties && (
                    <div>
                      <div className="review-label">Difficulté</div>
                      <p className="small muted">{currentNote.difficulties}</p>
                    </div>
                  )}
                  {currentNote.nextStep && (
                    <div>
                      <div className="review-label">Prochaine étape</div>
                      <p className="small muted">{currentNote.nextStep}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!revealed && (
              <button className="btn btn-secondary btn-block" onClick={() => setRevealed(true)} id="spaced-review-reveal">
                <Eye size={17} /> Afficher la réponse
              </button>
            )}
          </div>

          {revealed && (
            <div className="row animate-in">
              <button className="btn btn-secondary btn-lg grow" onClick={() => handleAnswer('again')} id="spaced-review-again">
                <RotateCcw size={17} /> À revoir (1 j)
              </button>
              <button className="btn btn-success btn-lg grow" onClick={() => handleAnswer('good')} id="spaced-review-good">
                <Sparkles size={17} /> Assimilé <ArrowRight size={17} />
              </button>
            </div>
          )}
        </div>
      ) : null}
    </Sheet>
  )
}
