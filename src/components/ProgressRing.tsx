import type { ReactNode } from 'react'

interface ProgressRingProps {
  /** 0 → 1 (peut dépasser 1 : l'anneau reste plein). */
  value: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
  className?: string
}

/** Anneau fin, couleur unie (style Apple Fitness). */
export function ProgressRing({ value, size = 96, stroke = 8, color = 'var(--accent)', children, className }: ProgressRingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value || 0))

  return (
    <div className={`ring ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 600ms var(--ease)' }}
        />
      </svg>
      {children && <div className="ring-center">{children}</div>}
    </div>
  )
}
