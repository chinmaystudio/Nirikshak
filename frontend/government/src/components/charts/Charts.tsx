import { useId } from 'react'
import { cn } from '@/utils/cn'
import { formatPct } from '@/utils/format'

/**
 * Dependency-free horizontal bar chart (spec: charts without heavy chart libs).
 * Used for budget utilization, contractor comparisons, district counts.
 */
export function BarChart({
  data,
  ariaLabel,
  valueFormatter,
  maxValue,
  className,
  showValues = true,
}: {
  data: { label: string; value: number; tone?: 'primary' | 'success' | 'warning' | 'danger' }[]
  ariaLabel: string
  valueFormatter?: (v: number) => string
  maxValue?: number
  className?: string
  showValues?: boolean
}) {
  const id = useId()
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1)
  return (
    <div role="img" aria-label={ariaLabel} className={cn('flex flex-col gap-2', className)}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100
        const color =
          d.tone === 'success'
            ? 'bg-success'
            : d.tone === 'warning'
              ? 'bg-warning'
              : d.tone === 'danger'
                ? 'bg-danger'
                : 'bg-primary'
        return (
          <div key={`${id}-${i}`} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-caption text-fg-muted" title={d.label}>
              {d.label}
            </span>
            <div className="h-4 w-full overflow-hidden rounded-badge bg-surface-3">
              <div
                className={cn('h-full rounded-badge', color)}
                style={{ width: `${Math.max(pct, d.value > 0 ? 2 : 0)}%` }}
              />
            </div>
            {showValues && (
              <span className="w-20 shrink-0 text-right text-caption tabular-nums text-fg">
                {valueFormatter ? valueFormatter(d.value) : formatPct(d.value)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Dependency-free stacked segmented bar — one row, proportional segments with
 * legend. Used for fund flows and portfolio status splits.
 */
export function SegmentBar({
  segments,
  ariaLabel,
  className,
}: {
  segments: { label: string; value: number; className: string }[]
  ariaLabel: string
  className?: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex h-3 w-full overflow-hidden rounded-badge bg-surface-3"
      >
        {segments.map((s, i) => (
          <div
            key={i}
            className={cn('h-full', s.className)}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${((s.value / total) * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-caption text-fg-muted">
            <span className={cn('h-2.5 w-2.5 rounded-[2px]', s.className)} aria-hidden="true" />
            {s.label}
            <span className="tabular-nums text-fg-subtle">{((s.value / total) * 100).toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Dependency-free line/area sparkline (SVG polyline) for trends.
 * `points` are plain numbers; the chart scales to the min/max window.
 */
export function Sparkline({
  points,
  ariaLabel,
  tone = 'primary',
  className,
  height = 48,
}: {
  points: number[]
  ariaLabel: string
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
  height?: number
}) {
  const stroke =
    tone === 'success' ? 'var(--color-success)' : tone === 'warning' ? 'var(--color-warning)' : tone === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)'
  const fill =
    tone === 'success'
      ? 'var(--color-success-tint)'
      : tone === 'warning'
        ? 'var(--color-warning-tint)'
        : tone === 'danger'
          ? 'var(--color-danger-tint)'
          : 'var(--color-primary-soft)'
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const W = 100
  const H = height
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W
    const y = H - 4 - ((p - min) / span) * (H - 8)
    return [x, y] as const
  })
  const line = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `0,${H} ${line} ${W},${H}`
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className={cn('w-full', className)}
      style={{ height }}
    >
      <polygon points={area} fill={fill} stroke="none" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/**
 * Donut chart (SVG stroke-dasharray) for portfolio status distribution.
 */
export function DonutChart({
  segments,
  ariaLabel,
  size = 140,
  thickness = 16,
  centerLabel,
  centerValue,
  className,
}: {
  segments: { label: string; value: number; color: string }[]
  ariaLabel: string
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
  className?: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      <svg width={size} height={size} role="img" aria-label={ariaLabel} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )
          offset += len
          return el
        })}
        {centerValue && (
          <text
            x="50%"
            y="47%"
            textAnchor="middle"
            fontSize={size * 0.17}
            fontWeight="700"
            fill="var(--color-fg)"
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x="50%"
            y="63%"
            textAnchor="middle"
            fontSize={size * 0.085}
            fill="var(--color-fg-muted)"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="flex min-w-40 flex-col gap-1.5">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-caption text-fg-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} aria-hidden="true" />
            <span className="flex-1">{s.label}</span>
            <span className="tabular-nums text-fg">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
