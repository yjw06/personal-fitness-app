import './ExerciseCard.css'
import { calcExerciseVolume, fmtVolume } from '../../utils/volumeUtils'

const PART_COLORS = {
  '가슴': '#6366f1',
  '등':   '#22d3ee',
  '하체': '#10b981',
  '어깨': '#f59e0b',
  '팔':   '#f97316',
  '코어': '#ec4899',
  '러닝': '#a78bfa',
}

/**
 * @param {{ exercise: object, index: number, isCompleted: boolean, isCurrent: boolean, onClick?: () => void }} props
 */
export default function ExerciseCard({ exercise, index, isCompleted, isCurrent, onClick }) {
  const color = PART_COLORS[exercise.body_part] ?? 'var(--color-primary)'
  const volume = calcExerciseVolume(exercise)

  return (
    <article
      className={`exercise-card animate-fadeInUp ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-done' : ''}`}
      style={{ '--part-color': color, animationDelay: `${index * 0.05}s` }}
      onClick={onClick}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      aria-label={`${exercise.exercise_name} ${isCompleted ? '(완료)' : ''}`}
    >
      {/* 번호 */}
      <div className="ex-order">
        {isCompleted ? '✓' : index + 1}
      </div>

      {/* 운동 정보 */}
      <div className="ex-info">
        <div className="ex-name-row">
          <h3 className="ex-name">{exercise.exercise_name}</h3>
          <span className="ex-part-badge" style={{ background: `${color}22`, color }}>
            {exercise.body_part}
          </span>
        </div>
        <p className="ex-meta">
          {exercise.sets}세트 × {exercise.reps_or_duration}
          {exercise.rest_seconds && (
            <span className="ex-rest"> · 휴식 {exercise.rest_seconds}초</span>
          )}
          {exercise.weight_kg != null && (
            <span className="ex-weight"> · {exercise.weight_kg}kg</span>
          )}
          {volume != null && (
            <span className="ex-volume"> · {fmtVolume(volume)}kg</span>
          )}
        </p>
      </div>

      {isCurrent && <div className="ex-current-dot" aria-hidden="true" />}
    </article>
  )
}
