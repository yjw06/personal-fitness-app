import { useRef, useState } from 'react'
import './ExerciseCard.css'
import { calcExerciseVolume, calcRepVolume, isCardio, isAssistExercise, fmtVolume } from '../../utils/volumeUtils'

const PART_COLORS = {
  '가슴': '#6366f1', '등': '#22d3ee', '하체': '#10b981',
  '어깨': '#f59e0b', '팔': '#f97316', '코어': '#ec4899', '러닝': '#a78bfa',
}

const REVEAL_W = 116

export default function ExerciseCard({ exercise, index, isCompleted, isCurrent, onClick, onWeightStep, bodyWeight = null }) {
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const startDragX  = useRef(0)
  const dragDir     = useRef(null)

  const [dragX,     setDragX]     = useState(0)
  const [settling,  setSettling]  = useState(false)

  const swipeEnabled = !!onWeightStep && !isCardio(exercise)

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    startDragX.current  = dragX
    dragDir.current     = null
    setSettling(false)
  }

  const onTouchMove = (e) => {
    if (touchStartX.current == null) return
    const dx = touchStartX.current - e.touches[0].clientX
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)

    if (dragDir.current == null) {
      if (Math.abs(dx) < 5 && dy < 5) return
      dragDir.current = Math.abs(dx) > dy ? 'h' : 'v'
    }
    if (dragDir.current !== 'h') return

    e.preventDefault()
    setDragX(Math.max(0, Math.min(REVEAL_W, startDragX.current + dx)))
  }

  const onTouchEnd = () => {
    if (dragDir.current !== 'h') { touchStartX.current = null; return }
    setSettling(true)
    setDragX((prev) => (prev > REVEAL_W * 0.35 ? REVEAL_W : 0))
    touchStartX.current = null
  }

  const closeSwipe = () => { setSettling(true); setDragX(0) }

  const color  = PART_COLORS[exercise.body_part] ?? 'var(--color-primary)'
  const volume = calcExerciseVolume(exercise, bodyWeight)
  const isAssist = isAssistExercise(exercise)

  const cardContent = (
    <>
      <div className="ex-order">{isCompleted ? '✓' : index + 1}</div>
      <div className="ex-info">
        <div className="ex-name-row">
          <h3 className="ex-name">{exercise.exercise_name}</h3>
          <span className="ex-part-badge" style={{ background: `${color}22`, color }}>
            {exercise.body_part}
          </span>
        </div>
        <p className="ex-meta">
          {exercise.sets}세트 × {exercise.reps_or_duration}
          {exercise.rest_seconds && <span className="ex-rest"> · 휴식 {exercise.rest_seconds}초</span>}
          {exercise.weight_kg != null && (
            <span className="ex-weight">
              {' · '}
              {isAssist ? `보조 ${exercise.weight_kg}kg` : `${exercise.weight_kg}kg`}
            </span>
          )}
          {volume != null && <span className="ex-volume"> · {fmtVolume(volume)}kg</span>}
          {isAssist && exercise.weight_kg != null && volume == null && (
            <span className="ex-bodyweight"> · 체중 미등록</span>
          )}
          {exercise.weight_kg == null && !isCardio(exercise) && (() => {
            const rv = calcRepVolume(exercise)
            return rv != null ? <span className="ex-bodyweight"> · 맨몸 {rv}회</span> : null
          })()}
        </p>
      </div>
      {isCurrent && <div className="ex-current-dot" aria-hidden="true" />}
    </>
  )

  if (!swipeEnabled) {
    return (
      <article
        className={`exercise-card animate-fadeInUp ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-done' : ''}`}
        style={{ '--part-color': color, animationDelay: `${index * 0.05}s` }}
        onClick={onClick}
        role={onClick ? 'button' : 'article'}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        aria-label={`${exercise.exercise_name}${isCompleted ? ' (완료)' : ''}`}
      >
        {cardContent}
      </article>
    )
  }

  const trackStyle = {
    transform:  `translateX(-${dragX}px)`,
    transition: settling ? 'transform 0.22s cubic-bezier(0.4,0,0.2,1)' : 'none',
  }

  return (
    <div
      className={`ex-swipe-wrap animate-fadeInUp`}
      style={{ animationDelay: `${index * 0.05}s` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="ex-swipe-track" style={trackStyle}>

        {/* 카드 본체 */}
        <article
          className={`exercise-card ex-card-part ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-done' : ''}`}
          style={{ '--part-color': color }}
          onClick={onClick ? () => { closeSwipe(); onClick() } : undefined}
          role={onClick ? 'button' : 'article'}
          tabIndex={onClick ? 0 : undefined}
          onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
          aria-label={`${exercise.exercise_name}${isCompleted ? ' (완료)' : ''}`}
        >
          {cardContent}
        </article>

        {/* 스와이프 패널 */}
        <div className="ex-swipe-panel">
          <button
            className="ex-sp-btn"
            onClick={() => { onWeightStep(-2.5); closeSwipe() }}
            aria-label="-2.5kg"
          >−</button>
          <div className="ex-sp-center">
            <span className="ex-sp-val">
              {exercise.weight_kg != null ? exercise.weight_kg : '─'}
            </span>
            {exercise.weight_kg != null && <span className="ex-sp-unit">kg</span>}
          </div>
          <button
            className="ex-sp-btn"
            onClick={() => { onWeightStep(2.5); closeSwipe() }}
            aria-label="+2.5kg"
          >+</button>
        </div>

      </div>
    </div>
  )
}
