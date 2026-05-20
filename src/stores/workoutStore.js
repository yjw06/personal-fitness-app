import { create } from 'zustand'

export const useWorkoutStore = create((set, get) => ({
  // ─── 현재 날짜 ────────────────────────────────
  selectedDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),

  // ─── 데이터 ───────────────────────────────────
  workoutData: null,
  mealData:    null,
  loading:     false,
  error:       null,

  // ─── 운동 진행 상태 ───────────────────────────
  // phase: 'overview' | 'active' | 'rest' | 'pick_next'
  phase:           'overview',
  currentIndex:    0,
  currentSet:      1,
  completedSets:   {},   // { exerciseIndex: completedSetCount }
  restSecondsLeft: 0,
  restEndTime:     null,

  // ─── Actions ──────────────────────────────────
  setSelectedDate: (date) => set({ selectedDate: date }),
  setWorkoutData:  (data) => set({ workoutData: data }),
  setMealData:     (data) => set({ mealData: data }),
  setLoading:      (v)    => set({ loading: v }),
  setError:        (e)    => set({ error: e }),

  // 운동 시작 (첫 번째 미완료 운동부터)
  startWorkout: () => {
    const { workoutData, completedSets } = get()
    if (!workoutData?.length) return

    // 아직 완료하지 않은 첫 번째 운동 찾기
    let startIdx = 0
    for (let i = 0; i < workoutData.length; i++) {
      const totalSets = parseInt(workoutData[i]?.sets) || 3
      if ((completedSets[i] || 0) < totalSets) {
        startIdx = i
        break
      }
    }
    set({ phase: 'active', currentIndex: startIdx, currentSet: 1 })
  },

  // 세트 완료
  completeSet: () => {
    const { currentIndex, currentSet, workoutData, completedSets } = get()
    const exercise = workoutData?.[currentIndex]
    const totalSets = parseInt(exercise?.sets) || 3
    const restSec   = parseInt(exercise?.rest_seconds) || 60

    const newCompleted = {
      ...completedSets,
      [currentIndex]: (completedSets[currentIndex] || 0) + 1,
    }

    if (currentSet >= totalSets) {
      // ★ 마지막 세트 완료 → 휴식 없이 바로 다음 운동 선택!
      const hasRemaining = workoutData.some((ex, i) => {
        if (i === currentIndex) return false
        const ts = parseInt(ex?.sets) || 3
        return (newCompleted[i] || 0) < ts
      })

      set({
        completedSets: newCompleted,
        phase:         hasRemaining ? 'pick_next' : 'overview',
      })
    } else {
      // 아직 세트 남음 → 휴식 후 다음 세트
      set({
        completedSets:   newCompleted,
        currentSet:      currentSet + 1,
        phase:           'rest',
        restSecondsLeft: restSec,
        restEndTime:     Date.now() + restSec * 1000,
      })
    }
  },

  // 휴식 종료 → 같은 운동 다음 세트로
  afterRest: () => {
    set({ phase: 'active', restEndTime: null })
  },

  // 타이머 틱 (절대시간 기반 — remaining을 직접 받음)
  tickRest: (remaining) =>
    set({ restSecondsLeft: remaining }),

  // 다음 운동 선택 (pick_next에서)
  pickExercise: (index) =>
    set({ phase: 'active', currentIndex: index, currentSet: 1 }),

  // 운동 종료 → overview로 돌아가되 completedSets는 유지!
  resetWorkout: () =>
    set({ phase: 'overview', currentIndex: 0, currentSet: 1 }),

  // 오늘 운동 기록 완전 초기화 (새로운 날)
  clearAll: () =>
    set({ phase: 'overview', currentIndex: 0, currentSet: 1, completedSets: {} }),

  // 특정 운동이 완전히 끝났는지 확인
  isExerciseDone: (index) => {
    const { workoutData, completedSets } = get()
    const exercise = workoutData?.[index]
    const totalSets = parseInt(exercise?.sets) || 3
    return (completedSets[index] || 0) >= totalSets
  },
}))
