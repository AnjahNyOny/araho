import { useState } from 'react'
import { X, Sparkles, CheckCircle, RotateCcw, Eye, ArrowRight } from 'lucide-react'
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

  if (!open) return null

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
    <div className="sheet-backdrop animate-fade" onClick={onClose}>
      <div
        className="sheet-panel animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '88vh', overflowY: 'auto' }}
      >
        {/* En-tête */}
        <div className="sheet-header">
          <div className="grow">
            <div className="caption">Ancrage mémoriel</div>
            <div className="sheet-title">Révision espacée</div>
            {!isCompleted && notes.length > 0 && (
              <div className="tiny muted">
                Carte {currentIndex + 1} sur {notes.length}
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="sheet-body" style={{ paddingBottom: 28 }}>
          {isCompleted ? (
            /* Écran de félicitations */
            <div
              className="group animate-in"
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: 'linear-gradient(180deg, var(--bg-cell) 0%, var(--fill) 100%)',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(52, 199, 89, 0.15)',
                  color: 'var(--sys-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckCircle size={36} strokeWidth={2.2} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px 0' }}>
                Révision terminée ! 🎉
              </h2>
              <p className="muted" style={{ maxWidth: 360, margin: '0 auto 24px', fontSize: 15, lineHeight: 1.4 }}>
                {reviewedCount > 0
                  ? `Tu as réactivé ${reviewedCount} apprentissage${reviewedCount > 1 ? 's' : ''} aujourd'hui. Tes acquis sont durablement consolidés.`
                  : 'Tous tes apprentissages sont à jour pour le moment.'}
              </p>
              <button className="btn btn-primary btn-lg" onClick={onClose} style={{ minWidth: 160 }}>
                Terminer
              </button>
            </div>
          ) : currentNote && currentTask ? (
            /* Carte de révision interactive */
            <div className="animate-in">
              <div
                className="group"
                style={{
                  padding: '24px 20px',
                  borderRadius: 16,
                  border: '1px solid var(--separator)',
                  background: 'var(--bg-cell)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                  minHeight: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  marginBottom: 20,
                }}
              >
                <div>
                  <div className="row spread" style={{ marginBottom: 16 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <TaskIcon task={currentTask} size={28} />
                      <span style={{ fontWeight: 600, fontSize: 16 }}>{currentTask.name}</span>
                    </div>
                    <span className="tiny muted">{formatDayLong(currentNote.date)}</span>
                  </div>

                  {!revealed ? (
                    <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: 'var(--label)',
                          marginBottom: 8,
                        }}
                      >
                        Te souviens-tu de ce que tu as appris lors de cette session ?
                      </div>
                      <div className="caption muted">
                        Fais l'effort mental de te remémorer les points clés avant de retourner la carte.
                      </div>
                    </div>
                  ) : (
                    <div className="animate-fade" style={{ paddingTop: 8 }}>
                      <div style={{ marginBottom: 16 }}>
                        <div className="caption" style={{ color: 'var(--sys-blue)', marginBottom: 4 }}>
                          💡 Ce que tu as noté
                        </div>
                        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'var(--label)', whiteSpace: 'pre-wrap' }}>
                          {currentNote.learned}
                        </p>
                      </div>

                      {currentNote.difficulties && (
                        <div style={{ marginBottom: 12 }}>
                          <div className="caption" style={{ color: 'var(--sys-orange)', marginBottom: 2 }}>
                            ⚠️ Difficulté
                          </div>
                          <p style={{ margin: 0, fontSize: 14, color: 'var(--label-2)' }}>
                            {currentNote.difficulties}
                          </p>
                        </div>
                      )}

                      {currentNote.nextStep && (
                        <div>
                          <div className="caption" style={{ color: 'var(--sys-green)', marginBottom: 2 }}>
                            🎯 Prochaine étape
                          </div>
                          <p style={{ margin: 0, fontSize: 14, color: 'var(--label-2)' }}>
                            {currentNote.nextStep}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!revealed && (
                  <button
                    className="btn btn-secondary btn-block"
                    onClick={() => setRevealed(true)}
                    style={{ marginTop: 16 }}
                    id="spaced-review-reveal"
                  >
                    <Eye size={17} /> Afficher la réponse
                  </button>
                )}
              </div>

              {/* Boutons d'évaluation une fois révélée */}
              {revealed && (
                <div className="row spread animate-in" style={{ gap: 12 }}>
                  <button
                    className="btn btn-secondary btn-lg grow"
                    onClick={() => handleAnswer('again')}
                    style={{ color: 'var(--sys-orange)' }}
                    id="spaced-review-again"
                  >
                    <RotateCcw size={17} /> À revoir (1 j)
                  </button>
                  <button
                    className="btn btn-primary btn-lg grow"
                    onClick={() => handleAnswer('good')}
                    style={{ background: 'var(--sys-green)' }}
                    id="spaced-review-good"
                  >
                    <Sparkles size={17} /> Bien assimilé <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
