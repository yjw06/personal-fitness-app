import { useState } from 'react'
import { useWorkoutStore } from '../../stores/workoutStore'
import './LogReps.css'

export default function LogReps() {
  const { workoutData, currentIndex, saveExerciseReps, skipExerciseReps } = useWorkoutStore()
  const exercise = workoutData?.[currentIndex]
  if (!exercise) return null

  const totalSets  = parseInt(exercise.sets) || 3
  const targetReps = parseInt(exercise.reps_or_duration)
  const isNumeric  = Number.isFinite(targetReps)

  const [values, setValues] = useState(
    Array.from({ length: totalSets }, () => isNumeric ? targetReps : 0)
  )

  const adjust = (i, delta) =>
    setValues((prev) => prev.map((v, j) => j === i ? Math.max(0, v + delta) : v))

  const handleInput = (i, raw) => {
    const n = parseInt(raw, 10)
    setValues((prev) => prev.map((v, j) => j === i ? (Number.isFinite(n) && n >= 0 ? n : v) : v))
  }

  const handleSave = () => saveExerciseReps(values.map((v) => (v > 0 ? v : null)))

  const hitCount  = isNumeric ? values.filter((v) => v >= targetReps).length : 0
  const avgReps   = values.filter((v) => v > 0).length
    ? (values.filter((v) => v > 0).reduce((a, b) => a + b, 0) / values.filter((v) => v > 0).length).toFixed(1)
    : null

  return (
    <div className="log-reps animate-fadeInUp">

      {/* ── 완료 세레모니 헤더 ── */}
      <div className="lr-hero">
        <div className="lr-hero-glow" />
        <div className="lr-hero-inner">
          <span className="lr-hero-label">완료</span>
          <h2 className="lr-hero-name">{exercise.exercise_name}</h2>
          <p className="lr-hero-meta">
            {isNumeric ? `목표 ${targetReps}회` : exercise.reps_or_duration}
            <span className="lr-hero-dot" />
            {totalSets}세트
          </p>
        </div>
      </div>

      {/* ── 실제 기록 입력 ── */}
      <div className="lr-scorecard">
        <p className="lr-scorecard-title">실제 기록</p>

        {values.map((v, i) => {
          const hit  = isNumeric && v >= targetReps
          const miss = isNumeric && v > 0 && v < targetReps
          const diff = isNumeric ? targetReps - v : 0
          return (
            <div key={i}>
              <div className={`lr-row ${hit ? 'hit' : miss ? 'miss' : ''}`}>
                <span className="lr-row-label">SET {i + 1}</span>

                <div className="lr-stepper">
                  <button className="lr-step" onClick={() => adjust(i, -1)} aria-label="감소">−</button>
                  <input
                    className="lr-num"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={v === 0 ? '' : v}
                    placeholder="0"
                    onChange={(e) => handleInput(i, e.target.value)}
                  />
                  <button className="lr-step" onClick={() => adjust(i, 1)} aria-label="증가">+</button>
                </div>

                <span className={`lr-badge ${hit ? 'hit' : miss ? 'miss' : 'empty'}`}>
                  {hit  && '✓'}
                  {miss && `−${diff}회`}
                  {!hit && !miss && '·'}
                </span>
              </div>
              {i < totalSets - 1 && <div className="lr-divider" />}
            </div>
          )
        })}
      </div>

      {/* ── 요약 통계 ── */}
      {isNumeric && avgReps && (
        <div className="lr-stats">
          <div className="lr-stat">
            <span className="lr-stat-val">{hitCount}<span className="lr-stat-total">/{totalSets}</span></span>
            <span className="lr-stat-label">달성</span>
          </div>
          <div className="lr-stat-divider" />
          <div className="lr-stat">
            <span className="lr-stat-val">{avgReps}<span className="lr-stat-unit">회</span></span>
            <span className="lr-stat-label">평균</span>
          </div>
          <div className="lr-stat-divider" />
          <div className="lr-stat">
            <span className="lr-stat-val">{targetReps}<span className="lr-stat-unit">회</span></span>
            <span className="lr-stat-label">목표</span>
          </div>
        </div>
      )}

      {/* ── 액션 ── */}
      <div className="lr-actions">
        <button className="btn btn-ghost lr-skip" onClick={skipExerciseReps}>건너뛰기</button>
        <button className="btn btn-primary lr-save" onClick={handleSave}>저장하고 계속</button>
      </div>

    </div>
  )
}
