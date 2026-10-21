import { useId, type ReactNode } from 'react'

interface ProgressRingProps {
  /** 0 → 1 (peut dépasser 1 : l'anneau reste plein). */
  value: number
  size?: number
  stroke?: number
  /** Couleur unie ; sinon dégradé d'accent. */
  color?: string
  children?: ReactNode
  className?: string
}

export function ProgressRing({ value, size = 96, stroke = 9, color, children, className }: ProgressRingProps) {
  const gid = useId()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value || 0))

  return (
    <div className={`ring ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(262 88% 68%)" />
            <stop offset="100%" stopColor="hsl(192 95% 60%)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? `url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      {children && <div className="ring-center">{children}</div>}
    </div>
  )
}
