// SVG 라인 차트 (외부 라이브러리 없음)
// data: [{ x: string, y: number }, ...]

import { useId } from 'react'

export default function LineChart({
  data,
  height = 180,
  color = 'var(--color-primary)',
  label = '',
  unit = '',
  yMin = null,
  yMax = null,
}) {
  const rawId = useId()
  const gradId = `lc-grad-${rawId.replace(/[^a-zA-Z0-9-]/g, '')}`
  if (!data?.length) {
    return <div className="chart-empty">데이터 없음</div>
  }

  const W = 320
  const H = height
  const PAD_L = 40
  const PAD_R = 16
  const PAD_T = 20
  const PAD_B = 28
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const ys = data.map((d) => d.y)
  const minY = yMin !== null ? yMin : Math.min(...ys)
  const maxY = yMax !== null ? yMax : Math.max(...ys)
  const range = Math.max(0.001, maxY - minY)

  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0

  const points = data.map((d, i) => {
    const x = PAD_L + i * xStep
    const y = PAD_T + innerH - ((d.y - minY) / range) * innerH
    return { x, y, raw: d }
  })

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  // 면적 채우기용
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_T + innerH).toFixed(1)} L ${PAD_L} ${(PAD_T + innerH).toFixed(1)} Z`

  // Y축 눈금 4개
  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = minY + (range * i) / ticks
    const y = PAD_T + innerH - (i / ticks) * innerH
    return { v, y }
  })

  // X축 라벨: 처음/중간/마지막
  const xLabels = data.length <= 6
    ? data.map((d, i) => ({ label: d.x, x: PAD_L + i * xStep }))
    : [0, Math.floor(data.length / 2), data.length - 1].map((i) => ({
        label: data[i].x,
        x: PAD_L + i * xStep,
      }))

  return (
    <div className="line-chart">
      {label && <div className="chart-label">{label}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="none">
        {/* Y축 그리드 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_L} x2={W - PAD_R}
              y1={t.y} y2={t.y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
            <text
              x={PAD_L - 6} y={t.y + 3}
              fill="var(--color-text-3)"
              fontSize="9"
              textAnchor="end"
              fontFamily="inherit"
            >
              {Math.round(t.v * 10) / 10}
            </text>
          </g>
        ))}

        {/* 면적 */}
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />

        {/* 라인 */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* 포인트 */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={color}
            stroke="var(--color-bg)"
            strokeWidth="1.5"
          >
            <title>{p.raw.x}: {p.raw.y}{unit}</title>
          </circle>
        ))}

        {/* X축 라벨 */}
        {xLabels.map((d, i) => (
          <text
            key={i}
            x={d.x}
            y={H - 8}
            fill="var(--color-text-3)"
            fontSize="9"
            textAnchor="middle"
            fontFamily="inherit"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  )
}
