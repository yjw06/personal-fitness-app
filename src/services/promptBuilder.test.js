import { describe, it, expect } from 'vitest'
import { buildPlanWizardPrompt } from './promptBuilder'

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
