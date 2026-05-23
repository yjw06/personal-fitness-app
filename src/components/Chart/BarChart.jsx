// 가로 막대 차트 (부위별 볼륨 등)
// data: [{ label: string, value: number, color?: string }, ...]

export default function BarChart({ data, unit = '' }) {
  if (!data?.length) return <div className="chart-empty">데이터 없음</div>

  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-row">
          <span className="bar-label">{d.label}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color || 'var(--color-primary)',
              }}
            />
          </div>
          <span className="bar-val">{Math.round(d.value)}{unit}</span>
        </div>
      ))}
    </div>
  )
}
