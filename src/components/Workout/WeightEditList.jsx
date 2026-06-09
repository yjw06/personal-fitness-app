import { useState } from 'react'
import { X, Check } from 'lucide-react'
import './WeightEditList.css'

const PART_COLORS = {
  '가슴': '#6366f1', '등': '#22d3ee', '하체': '#10b981',
  '어깨': '#f59e0b', '팔': '#f97316', '코어': '#ec4899',
}

export default function WeightEditList({ exerciseEntries, onSave, onCancel }) {
  const [stepSize, setStepSize] = useState(2.5)
  const [weights, setWeights] = useState(
    exerciseEntries.map(({ exercise }) => exercise.weight_kg ?? null)
  )

  const step = (i, delta) => {
    setWeights((prev) => prev.map((w, j) => {
      if (j !== i) return w
      const curr = w ?? 0
      return Math.max(0, parseFloat((curr + delta).toFixed(1)))
    }))
  }

  const handleSave = () => {
    onSave(exerciseEntries.map(({ index }, i) => ({ index, weight: weights[i] })))
  }

  return (
    <div className="wel-root animate-fadeInUp">

      {/* ── 헤더 ── */}
      <div className="wel-header">
        <div className="wel-header-left">
          <p className="wel-title">중량 편집</p>
          <div className="wel-step-toggle">
            <button
              className={`wel-step-btn ${stepSize === 2.5 ? 'active' : ''}`}
              onClick={() => setStepSize(2.5)}
            >2.5</button>
            <button
              className={`wel-step-btn ${stepSize === 5 ? 'active' : ''}`}
              onClick={() => setStepSize(5)}
            >5</button>
            <span className="wel-step-unit">kg</span>
          </div>
        </div>
        <button className="wel-close" onClick={onCancel} aria-label="닫기">
          <X size={18} />
        </button>
      </div>

      {/* ── 운동 목록 ── */}
      <div className="wel-list">
        {exerciseEntries.map(({ exercise }, i) => {
          const w = weights[i]
          const color = PART_COLORS[exercise.body_part] ?? 'var(--color-primary)'
          return (
            <div key={i} className="wel-row">
              <div className="wel-info">
                <span className="wel-name">{exercise.exercise_name}</span>
                <span className="wel-badge" style={{ background: `${color}22`, color }}>
                  {exercise.body_part}
                </span>
              </div>
              <div className="wel-stepper">
                <button
                  className="wel-step-action"
                  onClick={() => step(i, -stepSize)}
                  aria-label={`-${stepSize}kg`}
                >−</button>
                <span className="wel-weight">
                  {w != null ? `${w}` : '─'}
                  {w != null && <span className="wel-weight-unit">kg</span>}
                </span>
                <button
                  className="wel-step-action"
                  onClick={() => step(i, stepSize)}
                  aria-label={`+${stepSize}kg`}
                >+</button>
              </div>
            </div>
          )
        })}
        {exerciseEntries.length === 0 && (
          <p className="wel-empty">중량 설정이 가능한 운동이 없습니다.</p>
        )}
      </div>

      {/* ── 저장 ── */}
      <button
        className="btn btn-primary btn-full wel-save"
        onClick={handleSave}
      >
        <Check size={16} /> 전체 저장
      </button>

    </div>
  )
}
