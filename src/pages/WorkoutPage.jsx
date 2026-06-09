import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  fetchWorkout, deleteWorkout, uploadWorkoutCSV, readFileAsText,
  saveWorkoutData,
} from '../services/csvService'
import { useWorkoutStore } from '../stores/workoutStore'
import { toast } from '../stores/toastStore'
import { unlockAudio } from '../services/restAlert'
import { useSelection } from '../hooks/useSelection'
import EntryModal from '../components/EntryModal/EntryModal'
import ExerciseForm from '../components/EntryModal/ExerciseForm'
import ExerciseCard from '../components/Workout/ExerciseCard'
import ActiveExercise from '../components/Workout/ActiveExercise'
import RestTimer from '../components/Workout/RestTimer'
import LogReps from '../components/Workout/LogReps'
import WeightEditList from '../components/Workout/WeightEditList'
import { isCardio } from '../utils/volumeUtils'
import { useMemoryStore } from '../stores/memoryStore'
import { Upload, RefreshCw, Play, Check, Plus, Pencil, SlidersHorizontal, CheckSquare, Square, Trash2 } from 'lucide-react'
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
    setUid,
  } = useWorkoutStore()

  const recentBody = useMemoryStore((s) => s.recentBody)
  const bodyWeight = recentBody?.length ? parseFloat(recentBody[recentBody.length - 1]?.weight_kg) || null : null

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    setUid(user.uid)
    try {
      const result = await fetchWorkout(user.uid, selectedDate)
      if (result) {
        setWorkoutData(result.rows ?? [])
        useWorkoutStore.setState({
          completedSets: result.completedSets && Object.keys(result.completedSets).length > 0 ? result.completedSets : {},
          completedReps: result.completedReps || {},
        })
      } else {
        setWorkoutData([])
        useWorkoutStore.setState({ completedSets: {}, completedReps: {} })
      }
    } catch (err) {
      setError('운동 데이터를 불러오지 못했습니다.')
      toast.error('운동 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [user, selectedDate])

  useEffect(() => { load() }, [load])

  // 선택 상태 (index 기준)
  const allIndices = useMemo(
    () => (workoutData ?? []).map((_, i) => i),
    [workoutData],
  )
  const selection = useSelection(allIndices)

  // 선택된 운동 중량 편집 모드
  const [weightEditMode, setWeightEditMode] = useState(false)

  // 선택된 비-카디오 운동 엔트리 [{index, exercise}]
  const selectedEntries = (!selection.enabled || !workoutData)
    ? []
    : Array.from(selection.selected)
        .filter(i => workoutData[i] && !isCardio(workoutData[i]))
        .sort((a, b) => a - b)
        .map(i => ({ index: i, exercise: workoutData[i] }))

  const handleQuickWeightStep = async (index, delta) => {
    if (!workoutData) return
    const ex = workoutData[index]
    if (isCardio(ex)) return
    const curr = ex.weight_kg ?? 0
    const next = Math.max(0, parseFloat((curr + delta).toFixed(1)))
    const newRows = workoutData.map((r, i) => i === index ? { ...r, weight_kg: next } : r)
    setWorkoutData(newRows)
    try {
      await saveWorkoutData(user.uid, selectedDate, newRows)
    } catch {
      toast.error('저장 실패')
      setWorkoutData(workoutData)
    }
  }

  const handleSaveSelectedWeights = async (weightEntries) => {
    // weightEntries: [{index, weight}]
    const newRows = workoutData.map((ex, i) => {
      const entry = weightEntries.find(e => e.index === i)
      return (entry && entry.weight != null) ? { ...ex, weight_kg: entry.weight } : ex
    })
    try {
      await saveWorkoutData(user.uid, selectedDate, newRows)
      setWorkoutData(newRows)
      toast.success('중량 저장 완료')
    } catch {
      toast.error('저장 실패')
    }
    setWeightEditMode(false)
    selection.disable()
  }

  // 추가/편집 모달
  const [modalOpen, setModalOpen] = useState(false)
  const [editIndex, setEditIndex] = useState(null)   // null = 추가, number = 편집

  const openAdd  = () => { setEditIndex(null); setModalOpen(true) }
  const openEdit = (i) => { setEditIndex(i); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditIndex(null) }

  const handleSaveEntry = async (row) => {
    try {
      let newRows
      if (editIndex == null) {
        newRows = [...(workoutData ?? []), row]
      } else {
        newRows = (workoutData ?? []).map((r, i) => (i === editIndex ? row : r))
      }
      await saveWorkoutData(user.uid, selectedDate, newRows)
      setWorkoutData(newRows)
      toast.success(editIndex == null ? '운동을 추가했습니다.' : '운동을 수정했습니다.')
      closeModal()
      if (editIndex != null) selection.disable()
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const text = await readFileAsText(file)
      const result = await uploadWorkoutCSV(user.uid, selectedDate, text)
      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success(`운동 ${result.count}개 업로드 완료`)
        await load()
        clearAll()
      }
    } catch {
      toast.error('업로드에 실패했습니다.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  // 선택된 운동 인덱스들 삭제 (completedSets는 인덱스 재매핑)
  const handleDeleteSelected = async () => {
    const removeSet = selection.selected
    if (!removeSet.size) return
    const newRows = (workoutData ?? []).filter((_, i) => !removeSet.has(i))

    try {
      if (newRows.length === 0) {
        await deleteWorkout(user.uid, selectedDate)
        setWorkoutData([])
        clearAll()
      } else {
        // completedSets 인덱스 시프트
        const newCompleted = {}
        let newIdx = 0
        workoutData.forEach((_, oldIdx) => {
          if (removeSet.has(oldIdx)) return
          if (completedSets[oldIdx] != null) newCompleted[newIdx] = completedSets[oldIdx]
          newIdx++
        })
        await saveWorkoutData(user.uid, selectedDate, newRows)
        setWorkoutData(newRows)
        useWorkoutStore.setState({ completedSets: newCompleted })
      }
      toast.success(`운동 ${removeSet.size}개 삭제 완료`)
      selection.disable()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const isFullyDone = (i) => {
    const totalSets = parseInt(workoutData?.[i]?.sets) || 3
    return (completedSets[i] || 0) >= totalSets
  }

  const completedCount = workoutData
    ? workoutData.filter((_, i) => isFullyDone(i)).length
    : 0

  const allDone = workoutData?.length > 0 && completedCount === workoutData.length

  // 사용자 인터랙션 시 audio context 활성화 (자동재생 정책)
  const handleStart = () => {
    unlockAudio()
    startWorkout()
  }

  if (phase === 'active') return (
    <main className="page-content workout-page" role="main">
      <ActiveExercise />
    </main>
  )

  if (phase === 'rest') return (
    <main className="page-content workout-page" role="main">
      <RestTimer />
    </main>
  )

  if (phase === 'log_reps') return (
    <main className="page-content workout-page" role="main">
      <LogReps />
    </main>
  )

  // ─── phase: pick_next (개선: 첫번째 운동 = 추천) ──
  if (phase === 'pick_next') {
    const remaining = workoutData
      ?.map((ex, i) => ({ ex, i }))
      .filter(({ i }) => !isFullyDone(i)) ?? []

    return (
      <main className="page-content workout-page" role="main">
        <div className="pick-next-header animate-fadeInUp">
          <span className="pick-done-emoji">✅</span>
          <h2>운동 완료!</h2>
          <p className="pick-next-sub">다음 운동을 선택하세요</p>
        </div>

        {remaining.length > 0 && (
          <>
            <p className="pick-next-recommended">⭐ 추천 다음 운동</p>
            <div className="exercise-list pick-next-list">
              <div className="pick-recommended-wrap">
                <ExerciseCard
                  key={remaining[0].i}
                  exercise={remaining[0].ex}
                  index={remaining[0].i}
                  isCompleted={false}
                  isCurrent={true}
                  onClick={() => pickExercise(remaining[0].i)}
                  bodyWeight={bodyWeight}
                />
              </div>

              {remaining.length > 1 && (
                <>
                  <p className="pick-next-rest-label">또는 다른 운동</p>
                  {remaining.slice(1).map(({ ex, i }) => (
                    <ExerciseCard
                      key={i}
                      exercise={ex}
                      index={i}
                      isCompleted={false}
                      isCurrent={false}
                      onClick={() => pickExercise(i)}
                      bodyWeight={bodyWeight}
                    />
                  ))}
                </>
              )}
            </div>
          </>
        )}

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

  // 선택 모드에서 1개만 선택됐을 때 편집 버튼 활성화용 인덱스
  const singleSelectedIdx = selection.enabled && selection.size === 1
    ? Array.from(selection.selected)[0]
    : null

  return (
    <main className="page-content workout-page" role="main">
      <div className="workout-toolbar">
        {/* Row 1: 항상 표시 */}
        <div className="wt-main">
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> 운동 추가
          </button>
          <label id="btn-upload-workout" className="btn btn-ghost upload-label wt-icon-btn" role="button" aria-label="CSV 업로드">
            <Upload size={16} />
            <span className="wt-btn-label">CSV</span>
            <input type="file" accept=".csv" onChange={handleUpload} hidden />
          </label>
          <button id="btn-refresh-workout" className="btn btn-ghost wt-icon-btn" onClick={load} disabled={loading} aria-label="새로고침">
            <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
          </button>
          {workoutData?.length > 0 && (
            <button
              className={`btn wt-icon-btn ${selection.enabled ? 'wt-sel-active' : 'btn-ghost'}`}
              onClick={selection.enabled ? selection.disable : selection.enable}
              aria-label={selection.enabled ? '선택 취소' : '선택'}
            >
              <CheckSquare size={16} />
              <span className="wt-btn-label">{selection.enabled ? '취소' : '선택'}</span>
            </button>
          )}
        </div>

        {/* Row 2: 선택 모드일 때만 */}
        {selection.enabled && !weightEditMode && (
          <div className="wt-sel-row animate-fadeInUp">
            {selectedEntries.length > 0 && (
              <button className="btn btn-ghost wt-sel-btn" onClick={() => setWeightEditMode(true)}>
                <SlidersHorizontal size={14} /> 중량
              </button>
            )}
            <button
              className={`btn wt-sel-btn ${selection.isAllSelected ? 'wt-sel-btn-active' : 'btn-ghost'}`}
              onClick={() => selection.toggleAll()}
            >
              {selection.isAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              전체
            </button>
            <span className="wt-sel-count">
              <strong>{selection.size}</strong> / {workoutData.length}
            </span>
            {singleSelectedIdx != null && (
              <button className="btn btn-ghost wt-sel-btn" onClick={() => openEdit(singleSelectedIdx)}>
                <Pencil size={14} /> 편집
              </button>
            )}
            <button
              className="btn btn-danger wt-sel-btn"
              onClick={handleDeleteSelected}
              disabled={selection.size === 0}
            >
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        )}
      </div>

      <EntryModal
        open={modalOpen}
        onClose={closeModal}
        title={editIndex == null ? '운동 추가' : '운동 편집'}
      >
        <ExerciseForm
          initial={editIndex != null ? workoutData?.[editIndex] : null}
          onSubmit={handleSaveEntry}
          onCancel={closeModal}
          workoutRows={workoutData ?? []}
        />
      </EntryModal>

      {error && <p className="error-msg" role="alert">{error}</p>}
      {loading && <div className="empty-state"><span className="spinner" /></div>}

      {!loading && workoutData !== null && workoutData.length === 0 && (
        <div className="empty-state">
          <span style={{ fontSize: '2.5rem' }}>🏋️</span>
          <p>운동 데이터가 없어요.</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
            상단 "운동 추가" 또는 CSV 업로드로 시작하세요.
          </p>
        </div>
      )}

      {!loading && workoutData?.length > 0 && (
        <>
          <div className="workout-summary card">
            <span className="ws-label">운동 진행</span>
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

          {weightEditMode ? (
            <WeightEditList
              exerciseEntries={selectedEntries}
              onSave={handleSaveSelectedWeights}
              onCancel={() => setWeightEditMode(false)}
            />
          ) : (
            <div className="exercise-list">
              {workoutData.map((ex, i) => {
                const checked = selection.isSelected(i)
                if (selection.enabled) {
                  return (
                    <div
                      key={i}
                      className={`exercise-select-wrap ${checked ? 'selected' : ''}`}
                      onClick={() => selection.toggle(i)}
                      role="checkbox"
                      aria-checked={checked}
                    >
                      <span className={`sel-checkbox ${checked ? 'checked' : ''}`}>
                        {checked && <Check size={16} strokeWidth={3} />}
                      </span>
                      <div className="exercise-select-card">
                        <ExerciseCard
                          exercise={ex}
                          index={i}
                          isCompleted={isFullyDone(i)}
                          isCurrent={false}
                          bodyWeight={bodyWeight}
                        />
                      </div>
                    </div>
                  )
                }
                return (
                  <ExerciseCard
                    key={i}
                    exercise={ex}
                    index={i}
                    isCompleted={isFullyDone(i)}
                    isCurrent={false}
                    onWeightStep={(delta) => handleQuickWeightStep(i, delta)}
                    bodyWeight={bodyWeight}
                  />
                )
              })}
            </div>
          )}

          {!allDone && !selection.enabled && (
            <div className="workout-start-btns">
              <button
                id="btn-start-workout"
                className="btn btn-primary btn-full"
                onClick={handleStart}
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
              <h2>운동 완료!</h2>
              <p>수고하셨어요! 회복과 영양 보충 잊지 마세요.</p>
            </div>
          )}
        </>
      )}
    </main>
  )
}
