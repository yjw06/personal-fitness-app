import { describe, it, expect } from 'vitest'
import { buildPlanWizardPrompt, parsePlanWizardResponse } from './promptBuilder'

const base = {
  gender: '남', age: 30, heightCm: 175, weightKg: 78,
  experience: '초급', goal: '근육 키우기', goalDetail: '',
  daysPerWeek: '4', sessionMin: '60', place: '헬스장', injury: '',
  dietLevel: '엄격', mealPattern: '3끼+간식', dietNote: '',
  persona: '엄격한 PT쌤',
}

describe('buildPlanWizardPrompt', () => {
  it('포함 시 4개 출력 마커를 모두 요청한다', () => {
    const p = buildPlanWizardPrompt(base)
    expect(p).toContain('===PROFILE===')
    expect(p).toContain('===WORKOUT===')
    expect(p).toContain('===MEAL===')
    expect(p).toContain('===PERSONA===')
    expect(p).toContain('===END===')
  })

  it('사용자 입력값(나이/키/체중/목표)을 프롬프트에 담는다', () => {
    const p = buildPlanWizardPrompt(base)
    expect(p).toContain('30')
    expect(p).toContain('175')
    expect(p).toContain('78')
    expect(p).toContain('근육 키우기')
    expect(p).toContain('엄격한 PT쌤')
  })

  it('식단 빼기 선택 시 MEAL 마커를 요청하지 않는다', () => {
    const p = buildPlanWizardPrompt({ ...base, dietLevel: '식단 빼기' })
    expect(p).not.toContain('===MEAL===')
    expect(p).toContain('===WORKOUT===')
    expect(p).toContain('===PERSONA===')
  })

  it('선택 입력(goalDetail/injury/dietNote)이 비면 해당 라벨을 넣지 않는다', () => {
    const p = buildPlanWizardPrompt(base)
    expect(p).not.toContain('부상·제약')
  })

  it('선택 입력이 있으면 프롬프트에 반영한다', () => {
    const p = buildPlanWizardPrompt({ ...base, injury: '허리 디스크' })
    expect(p).toContain('허리 디스크')
  })
})

const fullResp = `여기 결과입니다
===PROFILE===
30세 남성, 175cm 78kg, 근비대 목표.
===WORKOUT===
4분할 루틴. 월 가슴, 화 등...
===MEAL===
하루 2600kcal, 단백질 150g.
===PERSONA===
엄격한 PT쌤 말투로 단호하게.
===END===`

describe('parsePlanWizardResponse', () => {
  it('4블록을 각 필드로 파싱한다', () => {
    const r = parsePlanWizardResponse(fullResp, { includeMeal: true })
    expect(r.ok).toBe(true)
    expect(r.fields.profile).toContain('30세 남성')
    expect(r.fields.workoutPlan).toContain('4분할')
    expect(r.fields.mealPlan).toContain('2600kcal')
    expect(r.fields.coachPersona).toContain('엄격한 PT쌤')
  })

  it('마커 앞뒤 잡음을 제거하고 trim한다', () => {
    const r = parsePlanWizardResponse(fullResp, { includeMeal: true })
    expect(r.fields.profile.startsWith('30세')).toBe(true)
    expect(r.fields.coachPersona.includes('===END===')).toBe(false)
  })

  it('식단 제외 시 mealPlan은 빈 문자열', () => {
    const noMeal = `===PROFILE===
프로필
===WORKOUT===
운동
===PERSONA===
페르소나
===END===`
    const r = parsePlanWizardResponse(noMeal, { includeMeal: false })
    expect(r.ok).toBe(true)
    expect(r.fields.mealPlan).toBe('')
    expect(r.fields.workoutPlan).toBe('운동')
  })

  it('마커가 하나도 없으면 ok:false (폴백)', () => {
    const r = parsePlanWizardResponse('아무 마커 없는 평범한 글', { includeMeal: true })
    expect(r.ok).toBe(false)
  })

  it('일부 블록만 있으면 있는 것만 채우고 ok:true', () => {
    const partial = `===PROFILE===
프로필만 있음
===END===`
    const r = parsePlanWizardResponse(partial, { includeMeal: true })
    expect(r.ok).toBe(true)
    expect(r.fields.profile).toBe('프로필만 있음')
    expect(r.fields.workoutPlan).toBe('')
  })
})
