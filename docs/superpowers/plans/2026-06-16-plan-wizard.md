# 맞춤 마스터플랜 생성기 (PlanWizard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 5스텝 질문에 답하면 마스터플랜 4칸(profile/workoutPlan/mealPlan/coachPersona)을 자동으로 채워주는 위저드를 추가한다. 외부 AI 복붙·파싱 경로를 권장으로, Gemini 자동 경로를 선택지로 제공한다.

**Architecture:** 프롬프트 생성·파싱은 기존 `promptBuilder.js`에 순수 함수로 추가(단위 테스트). UI는 독립 모달 `PlanWizard`로 분리해 `CoachPage`(빈 상태 CTA)와 `SettingsModal`(버튼) 양쪽에서 재사용. Gemini 자동 경로는 기존 `aiCoach.js`의 호출 인프라를 재사용한다.

**Tech Stack:** React 19, Zustand, lucide-react, Vite. 테스트는 Vitest(신규 추가, 순수 함수 한정).

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `src/services/promptBuilder.js` | `buildPlanWizardPrompt(answers)`, `parsePlanWizardResponse(text, opts)` 순수 함수 추가 | 수정 |
| `src/services/promptBuilder.test.js` | 위 두 함수의 단위 테스트 | 신규 |
| `src/components/PlanWizard/PlanWizard.jsx` | 5스텝 질문 UI, 경로 선택, 미리보기·저장 오케스트레이션 | 신규 |
| `src/components/PlanWizard/PlanWizard.css` | 위저드 스타일 | 신규 |
| `src/components/PlanWizard/questions.js` | 질문/칩 옵션 정의(데이터) | 신규 |
| `src/pages/CoachPage.jsx` | 빈 상태에 "AI로 맞춤 플랜 만들기" CTA + PlanWizard 마운트 | 수정 |
| `src/components/Settings/SettingsModal.jsx` | 마스터플랜 섹션에 생성기 버튼 + PlanWizard 마운트 | 수정 |
| `vitest.config.js`, `package.json` | Vitest 설정/스크립트 | 신규/수정 |

`answers` 객체 형태(전 태스크 공통 계약):
```js
{
  gender: '남'|'여'|'비공개',
  age: number, heightCm: number, weightKg: number,
  experience: '입문'|'초급'|'중급'|'고급',
  goal: '근육 키우기'|'체지방 감량'|'근력 향상'|'체력·건강'|'체형 교정',
  goalDetail: string,                 // 선택, 빈 문자열 가능
  daysPerWeek: '2'|'3'|'4'|'5'|'6+',
  sessionMin: '30'|'45'|'60'|'90+',
  place: '헬스장'|'홈(덤벨·밴드)'|'맨몸만',
  injury: string,                     // 선택
  dietLevel: '엄격'|'대략'|'식단 빼기',
  mealPattern: '3끼'|'3끼+간식'|'2끼(간헐단식)'|'자유',
  dietNote: string,                   // 선택
  persona: '친근한 형·누나'|'엄격한 PT쌤'|'데이터 중심 담백'|'유쾌한 동기부여',
}
```

---

## Task 1: Vitest 설치 및 설정

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `vitest.config.js`

- [ ] **Step 1: Vitest 설치**

Run: `npm install -D vitest`
Expected: `package.json` devDependencies에 `vitest` 추가, 설치 성공.

- [ ] **Step 2: test 스크립트 추가**

`package.json`의 `scripts`에 한 줄 추가:
```json
"test": "vitest run",
```

- [ ] **Step 3: vitest.config.js 작성**

Create `vitest.config.js`:
```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
```

- [ ] **Step 4: 빈 실행으로 동작 확인**

Run: `npm test`
Expected: "No test files found" 경고가 떠도 OK(에러 종료 아님). 설정이 로드되는지만 확인.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js
git commit -m "chore: add vitest for unit testing pure functions"
```

---

## Task 2: `buildPlanWizardPrompt` — 위저드 답변 → 외부 AI 프롬프트

**Files:**
- Modify: `src/services/promptBuilder.js`
- Test: `src/services/promptBuilder.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/services/promptBuilder.test.js`:
```js
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `buildPlanWizardPrompt is not a function` (아직 export 안 됨).

- [ ] **Step 3: 함수 구현**

`src/services/promptBuilder.js` 파일 맨 끝에 추가:
```js
// ─── 맞춤 마스터플랜 생성기 (PlanWizard) ─────────────────────
const WIZARD_BLOCKS = {
  PROFILE: '사용자 프로필 (나이·키·체중·목표를 자연스러운 문장으로 정리)',
  WORKOUT: '주간 운동 마스터플랜 (분할법, 요일별 부위, 세트·반복 가이드를 산문으로)',
  MEAL:    '식단 마스터플랜 (목표 칼로리 방향, 끼니 구성, 단백질 목표를 산문으로)',
  PERSONA: '코치 톤·페르소나 (말투와 동기부여 방식을 1~2문장으로)',
}

export function buildPlanWizardPrompt(a) {
  const includeMeal = a.dietLevel !== '식단 빼기'
  const blockKeys = includeMeal
    ? ['PROFILE', 'WORKOUT', 'MEAL', 'PERSONA']
    : ['PROFILE', 'WORKOUT', 'PERSONA']

  const facts = [
    `- 성별: ${a.gender}`,
    `- 나이: ${a.age}세`,
    `- 키: ${a.heightCm}cm`,
    `- 현재 체중: ${a.weightKg}kg`,
    `- 운동 경력: ${a.experience}`,
    `- 가장 큰 목표: ${a.goal}`,
    a.goalDetail && `- 구체적 목표: ${a.goalDetail}`,
    `- 주당 운동 횟수: ${a.daysPerWeek}회`,
    `- 1회 운동 시간: ${a.sessionMin}분`,
    `- 운동 장소·장비: ${a.place}`,
    a.injury && `- 부상·제약·기피: ${a.injury}`,
    includeMeal && `- 식단 관리 수준: ${a.dietLevel}`,
    includeMeal && `- 하루 식사 패턴: ${a.mealPattern}`,
    includeMeal && a.dietNote && `- 식이 제약·선호: ${a.dietNote}`,
    `- 원하는 코치 말투: ${a.persona}`,
  ].filter(Boolean).join('\n')

  const outputSpec = blockKeys
    .map((k) => `===${k}===\n(${WIZARD_BLOCKS[k]})`)
    .join('\n')

  return `당신은 전문 피트니스·영양 코치입니다. 아래 사용자 정보를 바탕으로 개인 맞춤 코칭 마스터플랜을 작성하세요.

# 사용자 정보
${facts}

# 출력 규칙 (반드시 지킬 것)
- 아래 형식의 마커를 그대로 사용해 각 섹션을 작성합니다.
- 마커(===XXX===)는 줄 맨 앞에 단독으로 둡니다. 마커 외 추가 설명·인사말·코드블록은 넣지 마세요.
- 한국어로, 사용자 입력값(나이·키·체중·목표)을 그대로 반영하세요.
- 마지막에 ===END=== 한 줄로 마칩니다.

# 출력 형식
${outputSpec}
===END===`
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — `buildPlanWizardPrompt` 5개 케이스 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add src/services/promptBuilder.js src/services/promptBuilder.test.js
git commit -m "feat: add buildPlanWizardPrompt for plan wizard"
```

---

## Task 3: `parsePlanWizardResponse` — AI 응답 → 4필드 파싱

**Files:**
- Modify: `src/services/promptBuilder.js`
- Test: `src/services/promptBuilder.test.js`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/services/promptBuilder.test.js` 맨 끝에 추가:
```js
import { parsePlanWizardResponse } from './promptBuilder'

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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `parsePlanWizardResponse is not a function`.

- [ ] **Step 3: 함수 구현**

`src/services/promptBuilder.js` 맨 끝에 추가:
```js
// 마커: 줄 맨 앞 ===KEY=== 형태. 다음 마커 또는 ===END=== 전까지를 블록으로.
function extractWizardBlock(text, key) {
  const re = new RegExp(`^===${key}===\\s*$([\\s\\S]*?)(?=^===[A-Z]+===\\s*$|^===END===\\s*$)`, 'm')
  const m = text.match(re)
  return m ? m[1].trim() : ''
}

export function parsePlanWizardResponse(text, { includeMeal = true } = {}) {
  const safe = String(text || '')
  const profile      = extractWizardBlock(safe, 'PROFILE')
  const workoutPlan  = extractWizardBlock(safe, 'WORKOUT')
  const mealPlan     = includeMeal ? extractWizardBlock(safe, 'MEAL') : ''
  const coachPersona = extractWizardBlock(safe, 'PERSONA')

  const ok = !!(profile || workoutPlan || mealPlan || coachPersona)
  return { ok, fields: { profile, workoutPlan, mealPlan, coachPersona } }
}
```

> 정규식 주의: lookahead로 다음 `===XXX===` 또는 `===END===`를 만나기 전까지 캡처. 마지막 블록 뒤에는 항상 `===END===`가 오므로 모든 블록이 닫힌다. `m` 플래그로 `^`/`$`가 각 줄에 적용된다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — parse 케이스 5개 + 기존 build 케이스 5개 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add src/services/promptBuilder.js src/services/promptBuilder.test.js
git commit -m "feat: add parsePlanWizardResponse for plan wizard"
```

---

## Task 4: 질문 정의 데이터 (`questions.js`)

**Files:**
- Create: `src/components/PlanWizard/questions.js`

- [ ] **Step 1: 질문/옵션 데이터 작성**

Create `src/components/PlanWizard/questions.js`:
```js
// PlanWizard 5스텝 질문 정의. type: 'chip' | 'number' | 'text'
// chip 질문은 options 배열, number/text는 placeholder.
export const STEPS = [
  {
    title: '나에 대해',
    questions: [
      { key: 'gender', label: '성별', type: 'chip', options: ['남', '여', '비공개'], required: true },
      { key: 'age', label: '나이', type: 'number', placeholder: '예: 30', required: true },
      { key: 'heightCm', label: '키 (cm)', type: 'number', placeholder: '예: 175', required: true },
      { key: 'weightKg', label: '현재 체중 (kg)', type: 'number', placeholder: '예: 78', required: true },
      { key: 'experience', label: '운동 경력', type: 'chip',
        options: ['입문(~6개월)', '초급(~2년)', '중급(~5년)', '고급(5년+)'], required: true },
    ],
  },
  {
    title: '목표',
    questions: [
      { key: 'goal', label: '가장 큰 목표', type: 'chip',
        options: ['근육 키우기', '체지방 감량', '근력 향상', '체력·건강', '체형 교정'], required: true },
      { key: 'goalDetail', label: '구체적 목표·시한 (선택)', type: 'text',
        placeholder: '예: 3개월 5kg 감량, 벤치 100kg', required: false },
    ],
  },
  {
    title: '운동 환경',
    questions: [
      { key: 'daysPerWeek', label: '주당 운동 횟수', type: 'chip',
        options: ['2', '3', '4', '5', '6+'], required: true },
      { key: 'sessionMin', label: '1회 운동 시간(분)', type: 'chip',
        options: ['30', '45', '60', '90+'], required: true },
      { key: 'place', label: '장소·장비', type: 'chip',
        options: ['헬스장', '홈(덤벨·밴드)', '맨몸만'], required: true },
      { key: 'injury', label: '부상·기피 부위 (선택)', type: 'text',
        placeholder: '예: 허리 디스크, 무릎 안 좋음', required: false },
    ],
  },
  {
    title: '식단',
    questions: [
      { key: 'dietLevel', label: '식단 관리 수준', type: 'chip',
        options: ['엄격', '대략', '식단 빼기'], required: true },
      { key: 'mealPattern', label: '하루 식사 패턴', type: 'chip',
        options: ['3끼', '3끼+간식', '2끼(간헐단식)', '자유'], required: true,
        skipIf: (a) => a.dietLevel === '식단 빼기' },
      { key: 'dietNote', label: '식이 제약·알레르기·선호 (선택)', type: 'text',
        placeholder: '예: 유당불내증, 채식, 닭가슴살 질림', required: false,
        skipIf: (a) => a.dietLevel === '식단 빼기' },
    ],
  },
  {
    title: '코치 스타일',
    questions: [
      { key: 'persona', label: '코치 말투', type: 'chip',
        options: ['친근한 형·누나', '엄격한 PT쌤', '데이터 중심 담백', '유쾌한 동기부여'], required: true },
    ],
  },
]

// 한 스텝의 모든 필수 질문이 채워졌는지 (skipIf 적용)
export function isStepComplete(step, answers) {
  return step.questions.every((q) => {
    if (q.skipIf && q.skipIf(answers)) return true
    if (!q.required) return true
    const v = answers[q.key]
    return v !== undefined && v !== null && String(v).trim() !== ''
  })
}
```

- [ ] **Step 2: import 확인 (구문 오류 없음)**

Run: `npx eslint src/components/PlanWizard/questions.js`
Expected: 에러 없음(경고 허용).

- [ ] **Step 3: Commit**

```bash
git add src/components/PlanWizard/questions.js
git commit -m "feat: add plan wizard question definitions"
```

---

## Task 5: PlanWizard 컴포넌트 (UI + 오케스트레이션)

**Files:**
- Create: `src/components/PlanWizard/PlanWizard.jsx`
- Create: `src/components/PlanWizard/PlanWizard.css`

`SettingsModal`의 오버레이/모달 패턴(`settings-overlay` → `settings-modal`)과 toast/useAuth 사용법을 그대로 따른다.

- [ ] **Step 1: PlanWizard.jsx 작성**

Create `src/components/PlanWizard/PlanWizard.jsx`:
```jsx
import { useState } from 'react'
import { X, ArrowLeft, ArrowRight, Copy, Sparkles, Wand2, Save } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useMemoryStore } from '../../stores/memoryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { toast } from '../../stores/toastStore'
import { buildPlanWizardPrompt, parsePlanWizardResponse } from '../../services/promptBuilder'
import { callGeminiText } from '../../services/aiCoach'
import { STEPS, isStepComplete } from './questions'
import './PlanWizard.css'

// phase: 'questions' | 'route' | 'paste' | 'preview'
export default function PlanWizard({ open, onClose }) {
  const { user } = useAuth()
  const memory = useMemoryStore()
  const aiModel = useSettingsStore((s) => s.aiModel)

  const [phase, setPhase] = useState('questions')
  const [stepIdx, setStepIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [pasteText, setPasteText] = useState('')
  const [preview, setPreview] = useState(null) // { profile, workoutPlan, mealPlan, coachPersona }
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const includeMeal = answers.dietLevel !== '식단 빼기'
  const step = STEPS[stepIdx]
  const canNext = isStepComplete(step, answers)
  const isLastStep = stepIdx === STEPS.length - 1

  const reset = () => {
    setPhase('questions'); setStepIdx(0); setAnswers({})
    setPasteText(''); setPreview(null); setBusy(false)
  }
  const close = () => { reset(); onClose() }

  const setAnswer = (key, value) => setAnswers((a) => ({ ...a, [key]: value }))

  const goNext = () => {
    if (!canNext) return
    if (isLastStep) setPhase('route')
    else setStepIdx((i) => i + 1)
  }
  const goBack = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1)
  }

  const promptText = buildPlanWizardPrompt(answers)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText)
      toast.success('프롬프트를 복사했습니다. 외부 AI에 붙여넣으세요.')
    } catch {
      toast.error('복사 실패 — 아래 텍스트를 길게 눌러 직접 복사하세요.')
    }
  }

  const handleParse = () => {
    const r = parsePlanWizardResponse(pasteText, { includeMeal })
    if (!r.ok) {
      toast.error('형식을 못 읽었어요. AI 응답 전체를 다시 복사해 붙여넣어 주세요.')
      return
    }
    setPreview(r.fields)
    setPhase('preview')
  }

  const handleGemini = async () => {
    if (!memory.apiKey) { toast.error('설정에서 Gemini API 키를 먼저 등록하세요.'); return }
    setBusy(true)
    try {
      const text = await callGeminiText({ apiKey: memory.apiKey, model: aiModel, prompt: promptText })
      const r = parsePlanWizardResponse(text, { includeMeal })
      if (!r.ok) { toast.error('생성 결과를 못 읽었어요. 복붙 경로를 이용해 주세요.'); return }
      setPreview(r.fields)
      setPhase('preview')
    } catch (err) {
      toast.error(`생성 실패: ${err.message} — 복붙 경로를 이용해 주세요.`)
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    if (!user) { toast.error('로그인이 필요합니다.'); return }
    setBusy(true)
    try {
      const patch = {
        profile: preview.profile,
        workoutPlan: preview.workoutPlan,
        coachPersona: preview.coachPersona,
      }
      if (includeMeal) patch.mealPlan = preview.mealPlan
      await memory.save(user.uid, patch)
      toast.success('맞춤 마스터플랜을 저장했습니다.')
      close()
    } catch (err) {
      toast.error(`저장 실패: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pw-overlay" role="dialog" aria-modal="true" aria-label="맞춤 플랜 생성기">
      <div className="pw-modal animate-fadeInUp">
        <header className="pw-header">
          <h2><Sparkles size={16} /> 맞춤 플랜 생성기</h2>
          <button className="btn-icon" onClick={close} aria-label="닫기"><X size={18} /></button>
        </header>

        {phase === 'questions' && (
          <>
            <div className="pw-progress">{stepIdx + 1} / {STEPS.length} · {step.title}</div>
            <div className="pw-body">
              {step.questions
                .filter((q) => !(q.skipIf && q.skipIf(answers)))
                .map((q) => (
                <div key={q.key} className="pw-q">
                  <label className="pw-q-label">{q.label}</label>
                  {q.type === 'chip' && (
                    <div className="pw-chips">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`pw-chip ${answers[q.key] === opt ? 'on' : ''}`}
                          onClick={() => setAnswer(q.key, opt)}
                        >{opt}</button>
                      ))}
                    </div>
                  )}
                  {q.type === 'number' && (
                    <input className="pw-input" type="number" inputMode="numeric"
                      placeholder={q.placeholder}
                      value={answers[q.key] ?? ''}
                      onChange={(e) => setAnswer(q.key, e.target.value)} />
                  )}
                  {q.type === 'text' && (
                    <input className="pw-input" type="text"
                      placeholder={q.placeholder}
                      value={answers[q.key] ?? ''}
                      onChange={(e) => setAnswer(q.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
            <footer className="pw-footer">
              <button className="btn" onClick={goBack} disabled={stepIdx === 0}>
                <ArrowLeft size={14} /> 이전
              </button>
              <button className="btn btn-primary" onClick={goNext} disabled={!canNext}>
                {isLastStep ? '완료' : '다음'} <ArrowRight size={14} />
              </button>
            </footer>
          </>
        )}

        {phase === 'route' && (
          <>
            <div className="pw-body">
              <p className="pw-desc">생성 방법을 골라주세요.</p>

              <div className="pw-route pw-route-rec">
                <div className="pw-route-badge">권장</div>
                <h3><Copy size={15} /> 외부 AI에 복붙</h3>
                <p>ChatGPT·Claude·Gemini 등에 프롬프트를 붙여넣고, 답변을 다시 붙여넣으면 자동으로 채워집니다. API 키가 필요 없고 가장 안정적이에요.</p>
                <button className="btn btn-primary" onClick={() => setPhase('paste')}>이 방법으로</button>
              </div>

              <div className="pw-route">
                <h3><Wand2 size={15} /> 앱에서 바로 생성 (Gemini)</h3>
                <p>등록된 Gemini API 키로 즉시 생성합니다. 혼잡 시 실패할 수 있어요.</p>
                <button className="btn" onClick={handleGemini} disabled={busy || !memory.apiKey}>
                  {busy ? '생성 중…' : (memory.apiKey ? '바로 생성' : 'API 키 없음')}
                </button>
              </div>
            </div>
            <footer className="pw-footer">
              <button className="btn" onClick={() => setPhase('questions')}>
                <ArrowLeft size={14} /> 질문 다시
              </button>
            </footer>
          </>
        )}

        {phase === 'paste' && (
          <>
            <div className="pw-body">
              <p className="pw-desc">1) 아래 프롬프트를 복사해 외부 AI에 붙여넣으세요.</p>
              <textarea className="pw-prompt" readOnly value={promptText} rows={6} />
              <button className="btn btn-primary pw-copy" onClick={handleCopy}>
                <Copy size={14} /> 프롬프트 복사
              </button>
              <p className="pw-desc">2) AI의 답변 전체를 복사해 여기에 붙여넣으세요.</p>
              <textarea className="pw-paste" placeholder="AI 응답을 붙여넣기…"
                value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6} />
            </div>
            <footer className="pw-footer">
              <button className="btn" onClick={() => setPhase('route')}>
                <ArrowLeft size={14} /> 뒤로
              </button>
              <button className="btn btn-primary" onClick={handleParse} disabled={!pasteText.trim()}>
                분석해서 채우기 <ArrowRight size={14} />
              </button>
            </footer>
          </>
        )}

        {phase === 'preview' && preview && (
          <>
            <div className="pw-body">
              <p className="pw-desc">결과를 확인하고 필요하면 수정한 뒤 저장하세요.</p>
              <PreviewField label="사용자 프로필" value={preview.profile}
                onChange={(v) => setPreview((p) => ({ ...p, profile: v }))} />
              <PreviewField label="운동 마스터플랜" value={preview.workoutPlan}
                onChange={(v) => setPreview((p) => ({ ...p, workoutPlan: v }))} />
              {includeMeal && (
                <PreviewField label="식단 마스터플랜" value={preview.mealPlan}
                  onChange={(v) => setPreview((p) => ({ ...p, mealPlan: v }))} />
              )}
              <PreviewField label="코치 페르소나" value={preview.coachPersona}
                onChange={(v) => setPreview((p) => ({ ...p, coachPersona: v }))} />
            </div>
            <footer className="pw-footer">
              <button className="btn" onClick={() => setPhase('route')}>
                <ArrowLeft size={14} /> 다시 생성
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
                <Save size={14} /> {busy ? '저장 중…' : '저장'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

function PreviewField({ label, value, onChange }) {
  return (
    <div className="pw-q">
      <label className="pw-q-label">{label}</label>
      <textarea className="pw-input pw-preview" rows={4}
        value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
```

- [ ] **Step 2: PlanWizard.css 작성**

Create `src/components/PlanWizard/PlanWizard.css`:
```css
.pw-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.pw-modal {
  width: 100%; max-width: 480px; max-height: 90vh;
  display: flex; flex-direction: column;
  background: var(--surface, #1a1a1a); color: var(--text, #fff);
  border-radius: 16px; overflow: hidden;
}
.pw-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,.08);
}
.pw-header h2 { display: flex; align-items: center; gap: 6px; font-size: 16px; margin: 0; }
.pw-progress { padding: 10px 16px 0; font-size: 13px; opacity: .7; }
.pw-body { padding: 12px 16px; overflow-y: auto; flex: 1; }
.pw-desc { font-size: 13px; opacity: .8; margin: 4px 0 8px; }
.pw-q { margin-bottom: 14px; }
.pw-q-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.pw-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pw-chip {
  padding: 7px 12px; border-radius: 999px; font-size: 13px;
  border: 1px solid rgba(255,255,255,.18); background: transparent; color: inherit;
}
.pw-chip.on { background: var(--accent, #c6ff00); color: #000; border-color: transparent; }
.pw-input {
  width: 100%; padding: 9px 11px; border-radius: 10px; font-size: 14px;
  border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.04); color: inherit;
}
.pw-preview, .pw-prompt, .pw-paste {
  width: 100%; border-radius: 10px; font-size: 13px; resize: vertical;
  border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.04); color: inherit;
  padding: 9px 11px; font-family: inherit;
}
.pw-prompt { background: rgba(255,255,255,.02); margin-bottom: 8px; }
.pw-copy { margin-bottom: 14px; }
.pw-footer {
  display: flex; justify-content: space-between; gap: 8px;
  padding: 12px 16px; border-top: 1px solid rgba(255,255,255,.08);
}
.pw-route {
  border: 1px solid rgba(255,255,255,.14); border-radius: 12px;
  padding: 12px; margin-bottom: 12px; position: relative;
}
.pw-route h3 { display: flex; align-items: center; gap: 6px; font-size: 14px; margin: 0 0 6px; }
.pw-route p { font-size: 12px; opacity: .75; margin: 0 0 10px; }
.pw-route-rec { border-color: var(--accent, #c6ff00); }
.pw-route-badge {
  position: absolute; top: -9px; right: 12px;
  background: var(--accent, #c6ff00); color: #000;
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
}
```

- [ ] **Step 3: 빌드/린트로 구문 확인**

Run: `npx eslint src/components/PlanWizard/PlanWizard.jsx`
Expected: 에러 없음. (`callGeminiText` import는 Task 6에서 추가하므로, Task 6을 먼저 끝낸 뒤 이 단계를 실행하거나, 일시적 미사용 경고는 무시. Task 6 완료 후 `npm run build`로 최종 확인.)

- [ ] **Step 4: Commit**

```bash
git add src/components/PlanWizard/PlanWizard.jsx src/components/PlanWizard/PlanWizard.css
git commit -m "feat: add PlanWizard modal component"
```

---

## Task 6: `callGeminiText` — Gemini 자유 텍스트 호출 헬퍼

기존 `callGeminiJSON`은 `responseSchema`로 JSON만 받는다. 위저드는 마커 텍스트가 필요하므로 평문 텍스트를 받는 헬퍼를 추가한다. 기존 `callWithRetry` 인프라를 재사용한다.

**Files:**
- Modify: `src/services/aiCoach.js`

- [ ] **Step 1: 구현 추가**

`src/services/aiCoach.js`에서 `callGeminiJSON` export 함수 **바로 위**에 추가:
```js
// 평문 텍스트 응답용 (PlanWizard 등 — JSON 스키마 불필요)
export async function callGeminiText({ apiKey, model = DEFAULT_MODEL, prompt, maxOutputTokens = 8192 }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens,
      ...(thinkingConfigFor(model) ? { thinkingConfig: thinkingConfigFor(model) } : {}),
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  }
  const response = await callWithRetry({ apiKey, model, body })
  const candidate = response?.candidates?.[0]
  const parts = candidate?.content?.parts || []
  const text = parts.filter((p) => p.text).map((p) => p.text).join('')
  if (!text) throw new Error(emptyResponseMessage(candidate?.finishReason || ''))
  return text
}
```

> `callWithRetry`, `thinkingConfigFor`, `emptyResponseMessage`, `DEFAULT_MODEL`은 같은 파일에 이미 정의돼 있다(grep으로 확인됨).

- [ ] **Step 2: 빌드로 확인 + PlanWizard 연결 검증**

Run: `npm run build`
Expected: 빌드 성공(에러 없음). PlanWizard의 `callGeminiText` import가 해소된다.

- [ ] **Step 3: Commit**

```bash
git add src/services/aiCoach.js
git commit -m "feat: add callGeminiText helper for plain-text Gemini calls"
```

---

## Task 7: CoachPage 빈 상태 CTA 연결

**Files:**
- Modify: `src/pages/CoachPage.jsx` (empty 배지 ~487행, import 상단)

- [ ] **Step 1: import + state 추가**

`src/pages/CoachPage.jsx` 상단 import에 추가:
```jsx
import PlanWizard from '../components/PlanWizard/PlanWizard'
```
컴포넌트 함수 본문 상단(다른 useState 근처)에 추가:
```jsx
const [wizardOpen, setWizardOpen] = useState(false)
```

- [ ] **Step 2: 빈 상태 라벨을 CTA 버튼으로 교체**

`src/pages/CoachPage.jsx`의 다음 블록:
```jsx
          ) : (
            <span className="cmb-label">메모리 없음 — 설정에서 마스터플랜 등록</span>
          )}
```
을 아래로 교체:
```jsx
          ) : (
            <button className="cmb-cta" onClick={() => setWizardOpen(true)}>
              ✨ AI로 내 맞춤 플랜 만들기
            </button>
          )}
```

- [ ] **Step 3: PlanWizard 마운트**

`CoachPage` return 최상위 컨테이너 내부 끝(닫는 태그 직전)에 추가:
```jsx
      <PlanWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
```

- [ ] **Step 4: cmb-cta 스타일 추가**

`src/pages/CoachPage.css` 맨 끝에 추가:
```css
.cmb-cta {
  background: var(--accent, #c6ff00); color: #000;
  border: none; border-radius: 999px;
  padding: 5px 12px; font-size: 13px; font-weight: 700; cursor: pointer;
}
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 6: Commit**

```bash
git add src/pages/CoachPage.jsx src/pages/CoachPage.css
git commit -m "feat: launch PlanWizard from CoachPage empty state"
```

---

## Task 8: SettingsModal 진입점 연결

**Files:**
- Modify: `src/components/Settings/SettingsModal.jsx`

- [ ] **Step 1: import + state 추가**

상단 import에 추가:
```jsx
import PlanWizard from '../PlanWizard/PlanWizard'
```
state 선언부(`planExpanded` 근처)에 추가:
```jsx
const [wizardOpen, setWizardOpen] = useState(false)
```

- [ ] **Step 2: 마스터플랜 섹션에 생성기 버튼 추가**

`src/components/Settings/SettingsModal.jsx`의 다음 블록(설명 문단):
```jsx
            <p className="set-plan-desc">
              여기에 저장한 내용은 <strong>모든 AI 코치 대화에 자동 포함</strong>됩니다.
              .md/.txt 파일을 통째로 불러올 수 있어요.
            </p>
```
바로 아래에 추가:
```jsx
            <button className="btn btn-primary set-wizard-btn" onClick={() => setWizardOpen(true)}>
              <Sparkles size={14} /> 질문으로 맞춤 플랜 만들기
            </button>
```
(`Sparkles`는 이미 import됨 — 1~4행 확인.)

- [ ] **Step 3: PlanWizard 마운트**

`settings-overlay` div의 닫는 `</div>` 직전(모달 최상위 컨테이너 안)에 추가:
```jsx
        <PlanWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
```

- [ ] **Step 4: 버튼 여백 스타일**

`src/components/Settings/SettingsModal.css` 맨 끝에 추가:
```css
.set-wizard-btn { width: 100%; justify-content: center; margin-bottom: 12px; }
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings/SettingsModal.jsx src/components/Settings/SettingsModal.css
git commit -m "feat: add PlanWizard entry button in settings"
```

---

## Task 9: 수동 통합 검증

**Files:** (없음 — 수동 검증)

- [ ] **Step 1: dev 서버 실행 및 시나리오 점검**

Run: `npm run dev`
다음을 수동 확인:
1. 마스터플랜 4칸이 비었을 때 코치 화면에 "✨ AI로 내 맞춤 플랜 만들기" CTA가 보이고, 클릭 시 위저드가 열린다.
2. 5스텝을 모두 칩/숫자로 답하면 "다음"이 활성화되고, 마지막에 경로 선택 화면이 나온다.
3. "식단 빼기"를 고르면 STEP 4의 나머지 질문이 사라지고, 경로 화면 이후 미리보기에 식단 칸이 안 보인다.
4. 복붙 경로: 프롬프트 복사 → (외부 AI 답변 예시를 붙여넣어) 분석 → 미리보기 → 저장 → 토스트 성공.
5. 저장 후 코치 화면 배지가 "메모리 활성"으로 바뀌고 설정창 4칸에 내용이 채워져 있다.
6. 설정창의 "질문으로 맞춤 플랜 만들기" 버튼으로도 동일 위저드가 열린다.

- [ ] **Step 2: 전체 테스트 재실행**

Run: `npm test`
Expected: PASS (build/parse 케이스 전부).

- [ ] **Step 3: 최종 빌드**

Run: `npm run build`
Expected: 성공.

---

## Self-Review

**Spec coverage:**
- 4칸 전부 생성 + profile 입력값 그대로 → Task 2(facts에 입력값), Task 5(preview 4칸), 저장 patch. ✓
- 두 경로 + 복붙 권장 강조 → Task 5 'route' phase, `pw-route-rec`/`권장` 배지. ✓
- 단일 선택 목표 → Task 4 chip(단일). ✓
- 구분자 블록 파싱 + 폴백 → Task 3 `parsePlanWizardResponse`(ok:false 시 Task 5에서 토스트 재시도 안내). ✓
- 식단 빼기 분기 → Task 2(프롬프트), Task 3(파싱), Task 4(skipIf), Task 5(저장 patch). ✓
- 진입점 2곳 → Task 7(CoachPage), Task 8(Settings). ✓
- 미리보기·수정 → Task 5 'preview' phase. ✓

> 스펙의 "마커 없을 때 수동 배치 폴백 화면"은 본 계획에서 **토스트 재시도 안내**로 단순화했다(원문은 paste 화면에 그대로 남아 다시 시도 가능). 전용 수동배치 UI는 YAGNI로 제외 — 필요 시 후속 작업.

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. TBD/TODO 없음. ✓

**Type consistency:** `answers` 키(gender/age/heightCm/weightKg/experience/goal/goalDetail/daysPerWeek/sessionMin/place/injury/dietLevel/mealPattern/dietNote/persona)가 Task 4 정의와 Task 2 사용처에서 일치. `parsePlanWizardResponse` 반환 `{ ok, fields }` 형태가 Task 3 정의와 Task 5 사용처에서 일치. `callGeminiText({ apiKey, model, prompt })` 시그니처가 Task 6 정의와 Task 5 호출에서 일치. ✓
