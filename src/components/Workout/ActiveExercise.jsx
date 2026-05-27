import { useWorkoutStore } from '../../stores/workoutStore'
import { unlockAudio } from '../../services/restAlert'
import './ActiveExercise.css'

const PART_COLORS = {
  '가슴': '#6366f1', '등': '#22d3ee', '하체': '#10b981',
  '어깨': '#f59e0b', '팔': '#f97316', '코어': '#ec4899', '러닝': '#a78bfa',
}

export default function ActiveExercise() {
  const {
    workoutData, currentIndex, currentSet,
    completedSets, completeSet, resetWorkout,
  } = useWorkoutStore()

  const exercise = workoutData?.[currentIndex]
  if (!exercise) return null

  const totalSets    = parseInt(exercise.sets) || 3
  const doneSetCount = completedSets[currentIndex] || 0
  const color        = PART_COLORS[exercise.body_part] ?? 'var(--color-primary)'
  const progress     = Math.round((doneSetCount / totalSets) * 100)

  return (
    <div className="active-exercise animate-fadeInUp" style={{ '--part-color': color }}>

      {/* 상단: 부위 + 진행률 */}
      <div className="ae-top">
        <span className="ae-part-badge">{exercise.body_part}</span>
        <span className="ae-progress-text">
          {currentIndex + 1} / {workoutData.length}
        </span>
      </div>

      {/* 운동 이름 */}
      <h2 className="ae-name">{exercise.exercise_name}</h2>

      {/* 세트 / 반복 표시 */}
      <div className="ae-info-row">
        <div className="ae-info-card">
          <span className="ae-info-val">{currentSet}</span>
          <span className="ae-info-label">현재 세트</span>
        </div>
        <span className="ae-slash">/</span>
        <div className="ae-info-card">
          <span className="ae-info-val">{totalSets}</span>
          <span className="ae-info-label">총 세트</span>
        </div>
        <div className="ae-info-card ae-reps">
          <span className="ae-info-val ae-reps-val">{exercise.reps_or_duration}</span>
          <span className="ae-info-label">반복/시간</span>
        </div>
      </div>

      {/* 세트 진행 바 */}
      <div className="ae-sets-row" aria-label="세트 진행 상황">
        {Array.from({ length: totalSets }, (_, i) => (
          <div
            key={i}
            className={`ae-set-pip ${i < doneSetCount ? 'done' : i === doneSetCount ? 'current' : ''}`}
          />
        ))}
      </div>

      {/* 완료 버튼 */}
      <button
        id="btn-complete-set"
        className="btn btn-primary btn-full ae-complete-btn"
        onClick={() => { unlockAudio(); completeSet() }}
      >
        ✓ 세트 완료
      </button>

      {/* 종료 버튼 */}
      <button
        id="btn-stop-workout"
        className="btn btn-ghost btn-full"
        onClick={resetWorkout}
      >
        운동 종료
      </button>
    </div>
  )
}
