import { create } from 'zustand'
import { saveWorkoutProgress } from '../services/csvService'

// localStorage에서 선택 날짜 복원 (탭 이동 후에도 유지)
const STORAGE_KEY = 'selectedDate_v1'
const todayYMD = () => new Date().toISOString().slice(0, 10).replace(/-/g, '')

const initialDate = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && /^\d{8}$/.test(stored)) return stored
  } catch {}
  return todayYMD()
})()

export const useWorkoutStore = create((set, get) => ({
  // ─── 현재 선택 날짜 (모든 페이지가 공유) ───────
  selectedDate: initialDate,

  // ─── 데이터 ───────────────────────────────────
  workoutData: null,
  mealData:    null,
  loading:     false,
  error:       null,
  uid:         null,

  // ─── 운동 진행 상태 ───────────────────────────
  phase:           'overview',
  currentIndex:    0,
  currentSet:      1,
  completedSets:   {},
  completedReps:   {},
  pendingPhase:    null,
  restSecondsLeft: 0,
  restEndTime:     null,

  // ─── Actions ──────────────────────────────────
  setSelectedDate: (date) => {
    try { localStorage.setItem(STORAGE_KEY, date) } catch {}
    set({ selectedDate: date })
  },
  resetSelectedDateToToday: () => {
    const today = todayYMD()
    try { localStorage.setItem(STORAGE_KEY, today) } catch {}
    set({ selectedDate: today })
  },
  setWorkoutData:  (data) => set({ workoutData: data }),
  setMealData:     (data) => set({ mealData: data }),
  setLoading:      (v)    => set({ loading: v }),
  setError:        (e)    => set({ error: e }),
  setUid:          (uid)  => set({ uid }),

  _persistProgress: (newCompleted, newReps) => {
    const { uid, selectedDate } = get()
    if (uid && selectedDate) {
      saveWorkoutProgress(uid, selectedDate, newCompleted, newReps).catch(() => {})
    }
  },

  startWorkout: () => {
    const { workoutData, completedSets } = get()
    if (!workoutData?.length) return
    let startIdx = 0
    for (let i = 0; i < workoutData.length; i++) {
      const totalSets = parseInt(workoutData[i]?.sets) || 3
      if ((completedSets[i] || 0) < totalSets) {
        startIdx = i
        break
      }
    }
    set({ phase: 'active', currentIndex: startIdx, currentSet: (completedSets[startIdx] || 0) + 1 })
  },

  completeSet: () => {
    const { currentIndex, currentSet, workoutData, completedSets, completedReps } = get()
    const exercise = workoutData?.[currentIndex]
    const totalSets = parseInt(exercise?.sets) || 3
    const restSec   = parseInt(exercise?.rest_seconds) || 60

    const newCompleted = {
      ...completedSets,
      [currentIndex]: (completedSets[currentIndex] || 0) + 1,
    }

    if (currentSet >= totalSets) {
      const hasRemaining = workoutData.some((ex, i) => {
        if (i === currentIndex) return false
        const ts = parseInt(ex?.sets) || 3
        return (newCompleted[i] || 0) < ts
      })

      set({
        completedSets: newCompleted,
        phase:         'log_reps',
        pendingPhase:  hasRemaining ? 'pick_next' : 'overview',
      })
    } else {
      set({
        completedSets:   newCompleted,
        currentSet:      currentSet + 1,
        phase:           'rest',
        restSecondsLeft: restSec,
        restEndTime:     Date.now() + restSec * 1000,
      })
    }

    get()._persistProgress(newCompleted, completedReps)
  },

  saveExerciseReps: (repsArray) => {
    const { currentIndex, completedSets, completedReps, pendingPhase } = get()
    const repsMap = {}
    repsArray.forEach((r, i) => { if (r != null) repsMap[i] = r })
    const newReps = { ...completedReps, [currentIndex]: repsMap }
    set({ completedReps: newReps, phase: pendingPhase, pendingPhase: null })
    get()._persistProgress(completedSets, newReps)
  },

  skipExerciseReps: () => {
    const { pendingPhase } = get()
    set({ phase: pendingPhase, pendingPhase: null })
  },

  afterRest: () => set({ phase: 'active', restEndTime: null }),

  tickRest: (remaining) => set({ restSecondsLeft: remaining }),

  // 휴식 시간 ± 조절
  extendRest: (deltaSec) => {
    const { restEndTime } = get()
    if (!restEndTime) return
    const newEnd = Math.max(Date.now() + 1000, restEndTime + deltaSec * 1000)
    set({ restEndTime: newEnd })
  },

  pickExercise: (index) => {
    const { completedSets } = get()
    set({ phase: 'active', currentIndex: index, currentSet: (completedSets[index] || 0) + 1 })
  },

  resetWorkout: () => set({ phase: 'overview', currentIndex: 0, currentSet: 1 }),

  clearAll: () => {
    set({ phase: 'overview', currentIndex: 0, currentSet: 1, completedSets: {}, completedReps: {} })
    get()._persistProgress({}, {})
  },

  isExerciseDone: (index) => {
    const { workoutData, completedSets } = get()
    const exercise = workoutData?.[index]
    const totalSets = parseInt(exercise?.sets) || 3
    return (completedSets[index] || 0) >= totalSets
  },
}))
