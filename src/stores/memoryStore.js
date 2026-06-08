// AI 코치 메모리 store — Firestore 기반 (사용자별 격리, 다기기 동기화)
import { create } from 'zustand'
import {
  fetchMemory, saveMemory,
  fetchAllBody, fetchWorkoutRange,
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
  progressTargets: {},  // { [exercise_name]: { currentKg, targetKg, status, updatedAt } }

  // ─── 자동 요약 캐시 (메모리만) ───
  recentBody:        [],
  recentWorkouts:    [],
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
        progressTargets: (data?.progressTargets && typeof data.progressTargets === 'object' && !Array.isArray(data.progressTargets))
          ? data.progressTargets
          : {},
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

  applyProgressTargets: async (uid, recommendations) => {
    if (!uid) return
    const { progressTargets } = get()
    const next = { ...progressTargets }
    for (const r of (recommendations ?? [])) {
      if (!r.exercise_name) continue
      if (r.status === 'increase' || r.status === 'new' || r.status === 'decrease') {
        next[r.exercise_name] = {
          currentKg: r.current_kg ?? null,
          targetKg: r.target_kg ?? null,
          status: 'pending',
          updatedAt: Date.now(),
        }
      } else if (r.status === 'hold') {
        if (next[r.exercise_name]) {
          next[r.exercise_name] = { ...next[r.exercise_name], status: 'hold', updatedAt: Date.now() }
        }
      }
    }
    set({ progressTargets: next })
    try { await saveMemory(uid, { progressTargets: next }) } catch {}
  },

  clearAllMemory: async (uid) => {
    if (!uid) return
    const patch = { profile: '', workoutPlan: '', mealPlan: '', coachPersona: '', aiNotes: [], progressTargets: {} }
    set(patch)
    try { await saveMemory(uid, patch) } catch {}
  },

  loadAutoSummary: async (uid) => {
    if (!uid) return
    try {
      const end = todayYmd()
      const start = ymdMinusDays(14)

      const [workouts, body] = await Promise.all([
        fetchWorkoutRange(uid, start, end),
        fetchAllBody(uid),
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

      set({ recentWorkouts, recentBody })
    } catch (err) {
      console.error('[memoryStore.loadAutoSummary]', err)
    }
  },

  // 로그아웃 시 호출
  reset: () => set({
    profile: '', workoutPlan: '', mealPlan: '', coachPersona: '',
    apiKey: '', aiNotes: [], progressTargets: {},
    recentBody: [], recentWorkouts: [],
    isLoaded: false, loadedUid: null,
  }),
}))
