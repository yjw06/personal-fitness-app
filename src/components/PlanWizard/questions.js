// PlanWizard 5스텝 질문 정의. type: 'chip' | 'number' | 'text'
// chip 질문은 options 배열, number/text는 placeholder.
export const STEPS = [
  {
    title: '나에 대해',
    questions: [
      { key: 'gender', label: '성별', type: 'chip', options: ['남', '여', '비공개'], required: true },
      { key: 'age', label: '나이 (만 나이)', type: 'number', placeholder: '예: 만 30세', required: true },
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
