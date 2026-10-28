import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Surtitre au-dessus du titre (petites capitales). */
  eyebrow?: ReactNode
  /** Ligne grise sous le titre. */
  subtitle?: ReactNode
  /** Boutons placés avant le bouton Fermer. */
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  id?: string
}

/** Feuille modale : glisse depuis le bas sur mobile, centrée sur desktop. */
export function Sheet({ open, onClose, title, eyebrow, subtitle, actions, children, footer, id }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="sheet-root" id={id}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel" ref={panelRef} role="dialog" aria-modal="true">
        <div className="sheet-grabber" />
        {title !== undefined && (
          <header className="sheet-header">
            <div className="grow">
              {eyebrow && <div className="caption">{eyebrow}</div>}
              <h2 className="sheet-title">{title}</h2>
              {subtitle && <div className="sheet-subtitle">{subtitle}</div>}
            </div>
            <div className="sheet-actions">
              {actions}
              <button className="icon-btn is-muted" onClick={onClose} aria-label="Fermer" id={id ? `${id}-close` : undefined}>
                <X size={20} />
              </button>
            </div>
          </header>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
