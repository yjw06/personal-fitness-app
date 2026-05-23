// AI 응답 검증/정규화 헬퍼 + Chat 모드용 save_to_memory 실행
// JSON Schema 방식으로 전환 후 단순화됨 — CoachPage가 직접 호출

import { saveWorkoutData, saveMealData, saveScheduleData } from './csvService'
import { useMemoryStore } from '../stores/memoryStore'

const VALID_BODY_PARTS = ['가슴', '등', '하체', '어깨', '팔', '코어', '러닝']
const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'supplement']

// ─── 운동 행 정규화 ─────────────────────────────────────────
export function normalizeWorkoutRow(row, idx) {
  const r = { ...row }
  if (!VALID_BODY_PARTS.includes(r.body_part)) {
    throw new Error(`#${idx + 1}번 운동: body_part가 잘못됨 "${r.body_part}". 가능: ${VALID_BODY_PARTS.join(', ')}`)
  }
  r.sets         = String(r.sets ?? 3)
  r.rest_seconds = String(r.rest_seconds ?? 60)
  return r
}

// ─── 식단 행 정규화 ─────────────────────────────────────────
export function normalizeMealRow(row, idx) {
  const r = { ...row }
  if (!VALID_MEAL_TYPES.includes(r.meal_type)) {
    throw new Error(`#${idx + 1}번 식사: meal_type이 잘못됨 "${r.meal_type}". 가능: ${VALID_MEAL_TYPES.join(', ')}`)
  }
  return r
}

// ─── 합쳐진 음식 자동 분리 (안전망) ─────────────────────────
// "오트밀 50g + 우유 200ml + 계란 2개" → 3개 행
export function splitCompositeFood(row) {
  const name = row.food_name || ''
  if (!name.includes('+')) return [row]
  const parts = name.split('+').map((s) => s.trim()).filter(Boolean)
  if (parts.length <= 1) return [row]

  const n = parts.length
  const div = (v) => {
    if (v == null || v === '') return v
    const num = parseFloat(v)
    if (isNaN(num)) return v
    return Math.round((num / n) * 10) / 10
  }

  return parts.map((p, i) => {
    const sub = { ...row, food_name: p }
    if (row.calories  != null) sub.calories  = div(row.calories)
    if (row.protein_g != null) sub.protein_g = div(row.protein_g)
    if (row.carbs_g   != null) sub.carbs_g   = div(row.carbs_g)
    if (row.fat_g     != null) sub.fat_g     = div(row.fat_g)
    if (i > 0) {
      delete sub.protein_target
      delete sub.carbs_target
      delete sub.fat_target
      delete sub.calorie_target
    }
    return sub
  })
}

// ─── JSON 응답 → Firestore 저장 ─────────────────────────────
// AI가 반환한 구조화 데이터(JSON)를 검증·정규화 후 저장
// 반환: { ok, count, summary } 또는 throw

export async function persistWorkout(uid, date, data) {
  const exercises = data?.exercises || []
  if (!exercises.length) throw new Error('운동 종목이 비어있어요.')

  const rows = exercises.map((ex, i) => normalizeWorkoutRow(ex, i))
  await saveWorkoutData(uid, date, rows)
  return { ok: true, count: rows.length, summary: `운동 ${rows.length}종목 저장됨` }
}

export async function persistMeal(uid, date, data) {
  const meals = data?.meals || []
  if (!meals.length) throw new Error('식사 항목이 비어있어요.')

  // 정규화 + '+' 합쳐진 음식 자동 분리 (안전망)
  const normalized = meals.map((m, i) => normalizeMealRow(m, i))
  const rows = normalized.flatMap(splitCompositeFood)

  // target 메타를 첫 행에 합치기 (CSV 스키마 호환)
  if (data.protein_target) rows[0].protein_target = data.protein_target
  if (data.carbs_target)   rows[0].carbs_target   = data.carbs_target
  if (data.fat_target)     rows[0].fat_target     = data.fat_target

  await saveMealData(uid, date, rows)
  return { ok: true, count: rows.length, summary: `식단 ${rows.length}끼 저장됨` }
}

export async function persistSchedule(uid, date, data) {
  const items = data?.items || []
  if (!items.length) throw new Error('스케줄 항목이 비어있어요.')

  // detail 빈 값 보정 (UI에서 안 보이는 것보다 activity 재사용이 나음)
  const rows = items.map((it) => ({
    time:      it.time,
    activity:  it.activity,
    detail:    (it.detail && it.detail.trim()) || it.activity,
    completed: it.completed === true,
  }))

  await saveScheduleData(uid, date, rows)
  return { ok: true, count: rows.length, summary: `스케줄 ${rows.length}개 저장됨` }
}

// kind 디스패치
export async function persistByKind(kind, uid, date, data) {
  if (kind === 'workout')  return persistWorkout(uid, date, data)
  if (kind === 'meal')     return persistMeal(uid, date, data)
  if (kind === 'schedule') return persistSchedule(uid, date, data)
  throw new Error(`알 수 없는 작업 종류: ${kind}`)
}

// ─── Chat 모드용: save_to_memory 단일 도구 실행 ────────────
export async function executeChatTool(name, args, ctx) {
  const { uid } = ctx
  if (!uid) return { ok: false, error: '로그인이 필요합니다.' }

  if (name === 'save_to_memory') {
    const { key, value } = args || {}
    if (!key || !value) return { ok: false, error: 'key와 value 필요' }
    try {
      await useMemoryStore.getState().addAiNote(uid, key, value)
      return { ok: true, summary: `메모 저장: ${key} → ${value}`, data: { key, value } }
    } catch (err) {
      return { ok: false, error: err.message || String(err) }
    }
  }

  // 알 수 없는 이름 — 환각 보정 (snake_case·접두사 매칭)
  const snake = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  if (snake.startsWith('save_to_memory') || snake === 'savetomemory' || snake.startsWith('save')) {
    return executeChatTool('save_to_memory', args, ctx)
  }

  return { ok: false, error: `알 수 없는 도구: ${name} (Chat 모드는 save_to_memory만 지원)` }
}
