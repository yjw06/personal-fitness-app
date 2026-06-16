// AI 생성 데이터 검증 + 결정적 자동 보정 레이어
// 원칙: 산수는 LLM을 믿지 않고 앱이 직접 계산한다.
// 각 fixer는 { data, issues } 반환 — issues는 사용자에게 보여줄 보정 내역.

import { BODYWEIGHT_KEYWORDS } from '../utils/volumeUtils'

const LOWER_BODY_PARTS = ['하체']
// 볼륨은 없지만 중량도 필요 없는 종목 (volumeUtils 리스트에 더해 중량 보정만 제외)
const NO_WEIGHT_KEYWORDS = ['스트레칭']

// 운동명 → 체중 대비 추정 비율 (스키마 프롬프트와 동일 기준)
const WEIGHT_RATIO_RULES = [
  { re: /스쿼트/,                ratio: 0.6 },
  { re: /데드\s*리프트|데드리프트/, ratio: 0.7 },
  { re: /벤치\s*프레스|벤치프레스/, ratio: 0.4 },
  { re: /오버헤드|숄더\s*프레스|밀리터리/, ratio: 0.3 },
  { re: /컬/,                   ratio: 0.2 },
  { re: /로우|풀\s*다운|풀다운/,  ratio: 0.3 },
]

const round1 = (v) => Math.round(v * 10) / 10
export const roundToPlate = (v) => Math.round(v / 2.5) * 2.5  // 2.5kg 단위

function num(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

// ─── 체중 추론: 최근 체성분 → 프로필 텍스트 순 ──────────────
export function inferBodyWeight(memory = {}) {
  const recent = memory.recentBody
  if (Array.isArray(recent) && recent.length) {
    const w = num(recent[recent.length - 1]?.weight_kg)
    if (w && w > 30 && w < 250) return w
  }
  const profile = memory.profile || ''
  // "체중 72kg", "72.5kg" 등에서 첫 매치
  const m = profile.match(/(\d{2,3}(?:\.\d+)?)\s*kg/)
  if (m) {
    const w = parseFloat(m[1])
    if (w > 30 && w < 250) return w
  }
  return null
}

export function isBodyweightExercise(name = '') {
  const n = name.toLowerCase()
  return BODYWEIGHT_KEYWORDS.some((k) => n.includes(k)) ||
    NO_WEIGHT_KEYWORDS.some((k) => n.includes(k))
}

// ─── 식단 보정 ──────────────────────────────────────────────
// - 매크로 숫자 강제 변환, 누락 시 0 + 이슈 기록
// - 칼로리는 4·4·9로 앱이 재계산 (모델 값이 30% 이상 어긋나면 교체)
// - 목표치(protein/carbs/fat_target) 누락 시 체중 기반 자동 계산
export function fixMealData(data, { bodyWeight = null } = {}) {
  const issues = []
  const out = { ...data }
  const meals = Array.isArray(out.meals) ? out.meals : []

  out.meals = meals.map((row) => {
    const r = { ...row }
    let p = num(r.protein_g)
    let c = num(r.carbs_g)
    let f = num(r.fat_g)
    const given = num(r.calories)

    const missing = []
    if (p == null) missing.push(['단백질', 4])
    if (c == null) missing.push(['탄수화물', 4])
    if (f == null) missing.push(['지방', 9])

    // 매크로 1개만 누락 + 칼로리 존재 → 칼로리에서 역산 (4P+4C+9F)
    if (missing.length === 1 && given != null) {
      const known = (p ?? 0) * 4 + (c ?? 0) * 4 + (f ?? 0) * 9
      const [label, kcalPerG] = missing[0]
      const inferred = Math.max(0, round1((given - known) / kcalPerG))
      if (p == null) p = inferred
      else if (c == null) c = inferred
      else f = inferred
      issues.push(`"${r.food_name}" ${label} 누락 → ${inferred}g 역산`)
    } else if (missing.length === 3) {
      issues.push(`"${r.food_name}" 영양 정보 누락 (직접 입력 필요)`)
    } else if (missing.length > 0) {
      issues.push(`"${r.food_name}" ${missing.map((m) => m[0]).join('·')} 누락 → 0으로 채움`)
    }

    r.protein_g = p ?? 0
    r.carbs_g   = c ?? 0
    r.fat_g     = f ?? 0

    // 칼로리 검증 — 매크로가 온전한 행만 재계산 (누락 행은 모델 값 보존)
    const macrosComplete = missing.length === 0 || (missing.length === 1 && given != null)
    const calc = Math.round(r.protein_g * 4 + r.carbs_g * 4 + r.fat_g * 9)
    if (macrosComplete && calc > 0) {
      if (given == null || Math.abs(given - calc) / calc > 0.3) {
        if (given != null && missing.length === 0) {
          issues.push(`"${r.food_name}" 칼로리 ${given} → ${calc}kcal 재계산`)
          r.calories = calc
        } else if (given == null) {
          r.calories = calc
        } else {
          r.calories = Math.round(given)
        }
      } else {
        r.calories = Math.round(given)
      }
    } else if (given != null) {
      r.calories = Math.round(given)
    }

    return r
  })

  // 목표치 — 모델이 생략하면 체중 기반으로 앱이 계산
  const pT = num(out.protein_target)
  const cT = num(out.carbs_target)
  const fT = num(out.fat_target)
  if (bodyWeight) {
    if (pT == null) { out.protein_target = round1(bodyWeight * 1.8); issues.push(`단백질 목표 ${out.protein_target}g 자동 계산 (체중×1.8)`) }
    if (cT == null) { out.carbs_target   = Math.round(bodyWeight * 3.5) }
    if (fT == null) { out.fat_target     = Math.round(bodyWeight * 0.9) }
  }

  return { data: out, issues }
}

// ─── 운동 보정 ──────────────────────────────────────────────
// - sets/rest 기본값, weight_kg 누락 시 체중 비율로 추정 + 이슈 기록
export function fixWorkoutData(data, { bodyWeight = null, progressTargets = {} } = {}) {
  const issues = []
  const out = { ...data }
  const exercises = Array.isArray(out.exercises) ? out.exercises : []

  out.exercises = exercises.map((row) => {
    const r = { ...row }
    if (num(r.sets) == null) r.sets = 3
    if (num(r.rest_seconds) == null) r.rest_seconds = r.body_part === '러닝' ? 0 : 60

    const needsWeight =
      r.body_part !== '러닝' &&
      r.body_part !== '코어' &&   // volumeUtils와 동일 — 코어는 중량 미지정 시 맨몸 취급
      !isBodyweightExercise(r.exercise_name || '')

    if (needsWeight && num(r.weight_kg) == null) {
      // 1순위: 과부하 목표 중량
      const target = progressTargets?.[r.exercise_name]?.targetKg
      if (num(target) != null) {
        r.weight_kg = num(target)
        issues.push(`"${r.exercise_name}" 중량 누락 → 과부하 목표 ${r.weight_kg}kg 적용`)
      } else if (bodyWeight) {
        const rule = WEIGHT_RATIO_RULES.find((w) => w.re.test(r.exercise_name || ''))
        r.weight_kg = rule ? roundToPlate(bodyWeight * rule.ratio) : 15
        issues.push(`"${r.exercise_name}" 중량 누락 → ${r.weight_kg}kg 추정`)
      } else {
        r.weight_kg = 15
        issues.push(`"${r.exercise_name}" 중량 누락 → 기본 15kg (체중 정보 없음)`)
      }
    }
    return r
  })

  return { data: out, issues }
}

// ─── 스케줄 보정 ────────────────────────────────────────────
// - time HH:MM 강제, detail 빈 값은 persist 단계에서 이미 보정됨
export function fixScheduleData(data) {
  const issues = []
  const out = { ...data }
  const items = Array.isArray(out.items) ? out.items : []

  out.items = items.map((row) => {
    const r = { ...row }
    const t = String(r.time || '').trim()
    const m = t.match(/^(\d{1,2}):?(\d{2})$/)
    if (m) {
      r.time = `${m[1].padStart(2, '0')}:${m[2]}`
    } else if (t) {
      issues.push(`"${r.activity}" 시간 형식 이상 ("${t}")`)
    }
    return r
  })

  return { data: out, issues }
}

// kind 디스패치
export function validateAndFix(kind, data, ctx = {}) {
  if (kind === 'meal')     return fixMealData(data, ctx)
  if (kind === 'workout')  return fixWorkoutData(data, ctx)
  if (kind === 'schedule') return fixScheduleData(data)
  return { data, issues: [] }
}
