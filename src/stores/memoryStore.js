// AI 코치 메모리 store — Firestore 기반 (사용자별 격리, 다기기 동기화)
import { create } from 'zustand'
import {
  fetchMemory, saveMemory,
  fetchAllBody, fetchWorkoutRange,
  fetchSchedule, fetchMeal,
} from '../services/csvService'

const todayYmd = () => new Date().toISOString().slice(0, 10).replace(/-/g, '')
const ymdMinusDays = (d) => {
  const date = new Date()
  date.setDate(date.getDate() - d)
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

// 한국어 토큰 추정: 글자수 ÷ 2 (대략적, 안전하게 overestimate)
export function estimateTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 2)
}

const LEGACY_KEY = 'gemini_api_key_v1'  // 이전 localStorage 키 (마이그레이션용)

export const useMemoryStore = create((set, get) => ({
  // ─── Firestore 동기화 필드 ───
  profile:      '',
  workoutPlan:  '',
  mealPlan:     '',
  coachPersona: '',
  apiKey:       '',          // Gemini API 키
  aiNotes:      [],  // [{ key, value, ts }]

  // ─── 자동 요약 캐시 (메모리만) ───
  recentBody:        [],
  recentWorkouts:    [],
  yesterdayInsights: [],   // 어제 미완료/이탈 자동 감지 (스케줄/운동/식단)

  // ─── 상태 ───
  isLoaded:  false,
  isLoading: false,
  isSaving:  false,
  loadedUid: null,

  // ─── 액션 ───
  load: async (uid) => {
    if (!uid) return
    if (get().loadedUid === uid && get().isLoaded) return  // 중복 로드 방지
    set({ isLoading: true })

    try {
      const data = await fetchMemory(uid)

      // 마이그레이션: 이전 localStorage API 키 → Firestore
      let migratedKey = ''
      try {
        const oldKey = localStorage.getItem(LEGACY_KEY)
        if (oldKey && !data?.apiKey) {
          migratedKey = oldKey
          localStorage.removeItem(LEGACY_KEY)
        }
      } catch {}

      set({
        profile:      data?.profile      || '',
        workoutPlan:  data?.workoutPlan  || '',
        mealPlan:     data?.mealPlan     || '',
        coachPersona: data?.coachPersona || '',
        apiKey:       data?.apiKey       || migratedKey,
        aiNotes:      Array.isArray(data?.aiNotes) ? data.aiNotes : [],
        isLoaded:     true,
        loadedUid:    uid,
      })

      if (migratedKey) {
        saveMemory(uid, { apiKey: migratedKey }).catch(() => {})
      }
    } catch (err) {
      console.error('[memoryStore.load]', err)
    } finally {
      set({ isLoading: false })
    }
  },

  save: async (uid, patch) => {
    if (!uid) throw new Error('UID 없음')
    set({ ...patch, isSaving: true })
    try {
      await saveMemory(uid, patch)
    } finally {
      set({ isSaving: false })
    }
  },

  addAiNote: async (uid, key, value) => {
    if (!uid) return
    const { aiNotes } = get()
    const next = [...aiNotes, { key, value, ts: Date.now() }].slice(-100)
    set({ aiNotes: next })
    try { await saveMemory(uid, { aiNotes: next }) } catch {}
  },

  removeAiNote: async (uid, index) => {
    if (!uid) return
    const { aiNotes } = get()
    const next = aiNotes.filter((_, i) => i !== index)
    set({ aiNotes: next })
    try { await saveMemory(uid, { aiNotes: next }) } catch {}
  },

  clearAiNotes: async (uid) => {
    if (!uid) return
    set({ aiNotes: [] })
    try { await saveMemory(uid, { aiNotes: [] }) } catch {}
  },

  clearAllMemory: async (uid) => {
    if (!uid) return
    const patch = { profile: '', workoutPlan: '', mealPlan: '', coachPersona: '', aiNotes: [] }
    set(patch)
    try { await saveMemory(uid, patch) } catch {}
  },

  // 자동 요약: 최근 14일 운동 + 체성분 + 어제 미완료 항목
  loadAutoSummary: async (uid) => {
    if (!uid) return
    try {
      const end = todayYmd()
      const start = ymdMinusDays(14)
      const yesterday = ymdMinusDays(1)

      const [workouts, body, ySchedule, yMeal, yWorkout] = await Promise.all([
        fetchWorkoutRange(uid, start, end),
        fetchAllBody(uid),
        fetchSchedule(uid, yesterday),
        fetchMeal(uid, yesterday),
        // 어제 운동은 workouts 안에 이미 있으니 별도 호출 X — 아래에서 추출
        Promise.resolve(null),
      ])

      const recentWorkouts = workouts.map((w) => {
        const rows = w.rows || []
        const completed = w.completedSets || {}
        const totalSets = rows.reduce((s, _, i) => s + (completed[i] || 0), 0)
        const expectedSets = rows.reduce((s, r) => s + (parseInt(r.sets) || 0), 0)
        const parts = [...new Set(rows.map((r) => r.body_part))].filter(Boolean)
        return {
          date: w.date,
          parts: parts.join(', ') || '-',
          exerciseCount: rows.length,
          setsDone: totalSets,
          setsTotal: expectedSets,
        }
      })

      const recentBody = body.slice(-5)

      // 어제 미완료 항목 분석
      const yesterdayInsights = []

      // 1) 어제 스케줄 중 completed=false
      if (Array.isArray(ySchedule)) {
        const skipped = ySchedule.filter((it) => !it.completed)
        if (skipped.length > 0) {
          yesterdayInsights.push({
            kind: 'schedule_skipped',
            count: skipped.length,
            items: skipped.map((s) => `${s.time} ${s.activity}`).slice(0, 5),
          })
        }
      }

      // 2) 어제 운동: 세트 완수율
      const yWorkoutSummary = recentWorkouts.find((w) => w.date === yesterday)
      if (yWorkoutSummary) {
        if (yWorkoutSummary.setsDone === 0 && yWorkoutSummary.setsTotal > 0) {
          yesterdayInsights.push({
            kind: 'workout_skipped',
            note: `계획된 ${yWorkoutSummary.setsTotal}세트 (${yWorkoutSummary.parts}) 중 한 세트도 안 함`,
          })
        } else if (yWorkoutSummary.setsDone < yWorkoutSummary.setsTotal * 0.5 && yWorkoutSummary.setsTotal > 0) {
          yesterdayInsights.push({
            kind: 'workout_partial',
            note: `${yWorkoutSummary.parts}: ${yWorkoutSummary.setsDone}/${yWorkoutSummary.setsTotal}세트만 완수`,
          })
        }
      }

      // 3) 어제 식단 기록 자체가 없으면
      if (!Array.isArray(yMeal) || yMeal.length === 0) {
        yesterdayInsights.push({ kind: 'meal_no_record', note: '식단 기록 없음' })
      }

      set({
        recentWorkouts, recentBody,
        yesterdayInsights,
      })
    } catch (err) {
      console.error('[memoryStore.loadAutoSummary]', err)
    }
  },

  // 로그아웃 시 호출
  reset: () => set({
    profile: '', workoutPlan: '', mealPlan: '', coachPersona: '',
    apiKey: '', aiNotes: [],
    recentBody: [], recentWorkouts: [], yesterdayInsights: [],
    isLoaded: false, loadedUid: null,
  }),
}))
