import { useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchWorkout, deleteWorkout, uploadWorkoutCSV, readFileAsText } from '../services/csvService'
import { useWorkoutStore } from '../stores/workoutStore'
import ExerciseCard from '../components/Workout/ExerciseCard'
import ActiveExercise from '../components/Workout/ActiveExercise'
import RestTimer from '../components/Workout/RestTimer'
import { Upload, RefreshCw, Play } from 'lucide-react'
import './WorkoutPage.css'

export default function WorkoutPage() {
  const { user } = useAuth()
  const {
    selectedDate,
    workoutData, setWorkoutData,
    loading, setLoading,
    error, setError,
    phase, completedSets,
    startWorkout, pickExercise, resetWorkout, clearAll,
  } = useWorkoutStore()

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWorkout(user.uid, selectedDate)
      setWorkoutData(data ?? [])
    } catch {
      setError('운동 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [user, selectedDate])

  useEffect(() => { load() }, [load])

  // ─── 수동 CSV 업로드 ─────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const text = await readFileAsText(file)
      await uploadWorkoutCSV(user.uid, selectedDate, text)
      await load()
      clearAll()
    } catch {
      setError('업로드에 실패했습니다.')
    } finally {
      e.target.value = ''
    }
  }

  // ─── 전체 삭제 ───────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm('오늘 운동 일정 전체를 삭제할까요?')) return
    try {
      await deleteWorkout(user.uid, selectedDate)
      setWorkoutData([])
      clearAll()
    } catch {
      setError('삭제에 실패했습니다.')
    }
  }

  // ─── 완료 판별 헬퍼 ──────────────────────────────────
  const isFullyDone = (i) => {
    const totalSets = parseInt(workoutData?.[i]?.sets) || 3
    return (completedSets[i] || 0) >= totalSets
  }

  const completedCount = workoutData
    ? workoutData.filter((_, i) => isFullyDone(i)).length
    : 0

  const allDone = workoutData?.length > 0 && completedCount === workoutData.length

  // ─── phase: active ──────────────────────────────────
  if (phase === 'active') return (
    <main className="page-content workout-page" role="main">
      <ActiveExercise />
    </main>
  )

  // ─── phase: rest ────────────────────────────────────
  if (phase === 'rest') return (
    <main className="page-content workout-page" role="main">
      <RestTimer />
    </main>
  )

  // ─── phase: pick_next (모든 세트 완료 후 다음 운동 선택) ──
  if (phase === 'pick_next') {
    const remaining = workoutData
      ?.map((ex, i) => ({ ex, i }))
      .filter(({ i }) => !isFullyDone(i)) ?? []

    return (
      <main className="page-content workout-page" role="main">
        <div className="pick-next-header animate-fadeInUp">
          <span className="pick-done-emoji">✅</span>
          <h2>운동 완료!</h2>
          <p className="pick-next-sub">다음으로 할 운동을 선택하세요</p>
        </div>

        <div className="exercise-list">
          {remaining.map(({ ex, i }) => (
            <ExerciseCard
              key={i}
              exercise={ex}
              index={i}
              isCompleted={false}
              isCurrent={false}
              onClick={() => pickExercise(i)}
            />
          ))}
        </div>

        <button
          id="btn-stop-from-pick"
          className="btn btn-ghost btn-full"
          onClick={resetWorkout}
          style={{ marginTop: '12px' }}
        >
          오늘 운동 종료하기
        </button>
      </main>
    )
  }

  // ─── phase: overview (기본 화면) ────────────────────
  return (
    <main className="page-content workout-page" role="main">
      {/* 툴바 */}
      <div className="workout-toolbar">
        <label id="btn-upload-workout" className="btn btn-ghost upload-label" role="button">
          <Upload size={16} /> CSV 업로드
          <input type="file" accept=".csv" onChange={handleUpload} hidden />
        </label>
        <button id="btn-refresh-workout" className="btn btn-ghost" onClick={load} disabled={loading} aria-label="새로고침">
          <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
        </button>
        {workoutData?.length > 0 && (
          <button id="btn-delete-workout" className="btn btn-danger" onClick={handleDelete}>
            🗑️ 삭제
          </button>
        )}
      </div>

      {error && <p className="error-msg" role="alert">{error}</p>}
      {loading && <div className="empty-state"><span className="spinner" /></div>}

      {!loading && workoutData !== null && workoutData.length === 0 && (
        <div className="empty-state">
          <span style={{ fontSize: '2.5rem' }}>🏋️</span>
          <p>오늘 운동 데이터가 없어요.</p>
          <label className="btn btn-primary" role="button">
            CSV 업로드하기
            <input type="file" accept=".csv" onChange={handleUpload} hidden />
          </label>
        </div>
      )}

      {!loading && workoutData?.length > 0 && (
        <>
          {/* 진행 요약 */}
          <div className="workout-summary card">
            <span className="ws-label">오늘 운동</span>
            <span className="ws-count">
              <strong>{completedCount}</strong> / {workoutData.length} 완료
            </span>
            <div className="progress-bar" style={{ flex: 1 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${Math.round((completedCount / workoutData.length) * 100)}%`,
                  background: allDone ? 'var(--color-success)' : 'var(--color-primary)',
                }}
              />
            </div>
          </div>

          {/* 운동 목록 */}
          <div className="exercise-list">
            {workoutData.map((ex, i) => (
              <ExerciseCard
                key={i}
                exercise={ex}
                index={i}
                isCompleted={isFullyDone(i)}
                isCurrent={false}
              />
            ))}
          </div>

          {/* 시작 버튼 */}
          {!allDone && (
            <div className="workout-start-btns">
              <button
                id="btn-start-workout"
                className="btn btn-primary btn-full"
                onClick={() => startWorkout()}
              >
                <Play size={18} fill="currentColor" />
                {completedCount > 0 ? '이어서 시작' : '운동 시작'}
              </button>
              {completedCount > 0 && (
                <button
                  id="btn-clear-progress"
                  className="btn btn-ghost btn-full"
                  onClick={() => {
                    if (confirm('운동 진행상황을 초기화할까요?')) clearAll()
                  }}
                >
                  🔄 진행상황 초기화
                </button>
              )}
            </div>
          )}

          {allDone && (
            <div className="all-done-banner animate-fadeInUp">
              <span style={{ fontSize: '2rem' }}>🎉</span>
              <h2>오늘 운동 완료!</h2>
              <p>수고했어! 프로틴 챙겨 먹자!</p>
            </div>
          )}
        </>
      )}
    </main>
  )
}
