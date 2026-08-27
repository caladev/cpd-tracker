import React from 'react'

export default function ProgressRing({
  value = 0,
  max = 1,
  size = 132,
  stroke = 12,
  id,
  from = '#14b8a6',
  to = '#10b981',
  status = 'ok',
  children,
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = max > 0 ? Math.min(1, Math.max(0, value / max)) : value > 0 ? 1 : 0
  const gradId = `ring-${id || 'g'}-${from.replace('#', '').slice(0, 4)}`

  return (
    <div className={`ring ring--${status}`} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-progress"
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}