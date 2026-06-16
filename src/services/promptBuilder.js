// 외부 AI(ChatGPT/Claude/Gemini)에 붙여넣을 프롬프트 생성 + CSV 응답 파싱
// API 호출 X — 사용자가 직접 복붙

import Papa from 'papaparse'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const DAY_NAMES_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function todayInfo() {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const dayKo = DAY_NAMES[d.getDay()]
  const dayEn = DAY_NAMES_EN[d.getDay()]
  const dateStr = d.toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' })
  return { ymd, dayKo, dayEn, dateStr }
}

// ─── 마스터플랜 메모리 컨텍스트 빌더 ─────────────────────────
function buildContextBlock(memory) {
  const blocks = []
  if (memory.profile)      blocks.push(`## 내 프로필\n${memory.profile}`)
  if (memory.workoutPlan)  blocks.push(`## 운동 마스터플랜\n${memory.workoutPlan}`)
  if (memory.mealPlan)     blocks.push(`## 식단 마스터플랜\n${memory.mealPlan}`)
  if (memory.coachPersona) blocks.push(`## 코치 톤·페르소나\n${memory.coachPersona}`)
  if (memory.aiNotes?.length) {
    const lines = memory.aiNotes.map((n) => {
      const date = n.ts ? new Date(n.ts).toISOString().slice(0,10) : ''
      return `- ${date ? `[${date}] ` : ''}${n.key}: ${n.value}`
    }).join('\n')
    blocks.push(`## 그 외 기억해줘\n${lines}`)
  }
  return blocks.join('\n\n')
}

// ─── CSV 스키마 정의 (프롬프트 포함용) ──────────────────────
const SCHEMA_DOCS = {
  workout: `
**운동 CSV 스키마**
컬럼: \`exercise_name,body_part,sets,reps_or_duration,rest_seconds\`
- exercise_name: 도구·장비·그립 명시 (예: "인클라인 덤벨 컬", "케이블 푸시다운 (V바)")
- body_part: 반드시 "가슴" / "등" / "하체" / "어깨" / "팔" / "코어" / "러닝" 중 하나
- sets: 정수 (보통 3, 마무리는 2, 러닝은 인터벌 횟수)
- reps_or_duration: 범위 형식 ("8-10", "12-15") 또는 "20분", "최대 횟수"
- rest_seconds: 정수 (보통 60, 강도↑ 75-90, 러닝 0)

**예시 (이대로 컬럼·줄바꿈 형식 지켜서 작성):**
\`\`\`csv
exercise_name,body_part,sets,reps_or_duration,rest_seconds
인클라인 덤벨 컬,팔,3,10-12,60
케이블 트라이셉스 푸시다운 (V바),팔,3,12-15,60
클로즈 그립 푸시업,팔,2,최대 횟수,75
400m 인터벌 런 (13-14km/h 질주 90초 + 6km/h 90초 회복),러닝,6,18-24분,0
\`\`\`
`,
  meal: `
**식단 CSV 스키마**
컬럼: \`meal_type,meal_time,food_name,protein_g,carbs_g,fat_g,calories,protein_target\`
- meal_type: 반드시 "breakfast" / "lunch" / "dinner" / "snack" / "supplement" 중 하나
  - breakfast/lunch/dinner = 주요 식사
  - snack = 일반 간식/과일/음료 (바나나, 카페인, 사과 등)
  - supplement = 운동용 보충제만 (WPI, 크레아틴, BCAA 등)
- meal_time: HH:MM (예: "08:00")
- food_name: **음식 하나씩 한 줄** + 분량 포함 (예: "백미밥 200g", "계란 3개 (스크램블)")
  - ❌ "오트밀 50g + 우유 200ml" 같이 하나의 행에 여러 음식 합치지 마라
  - ✅ 같은 meal_time을 공유하는 여러 행으로 분리
- protein_g / carbs_g / fat_g: 그램 (소수 1자리 가능). **빈 칸 안 됨, 모르면 추정치라도 채워라**
- calories: 칼로리 정수. **빈 칸 안 됨**
- protein_target: 하루 단백질 목표 (체중 × 1.6~2.2 범위). **첫 행에만 입력, 나머지 행은 비워둠**

**예시:**
\`\`\`csv
meal_type,meal_time,food_name,protein_g,carbs_g,fat_g,calories,protein_target
breakfast,08:00,오트밀 50g,7,33,3,185,140
breakfast,08:00,우유 200ml,7,10,7,130,
breakfast,08:00,계란 2개 (스크램블),13,1,11,140,
lunch,13:00,백미밥 220g,7,73,1,330,
lunch,13:00,생닭가슴살 200g 1팩,45,0,3,220,
snack,17:00,바나나 1개,1,27,0,105,
supplement,19:15,WPI 프로틴 1스쿱,21,2,1,105,
\`\`\`
`,
  schedule: `
**스케줄 CSV 스키마**
컬럼: \`time,activity,detail,completed\`
- time: HH:MM
- activity: 짧은 라벨 (예: "팔 웨이트 (이두/삼두)", "고강도 인터벌 러닝", "점심 식사")
- detail: **반드시 채울 것** — 한두 문장의 구체적 행동 가이드 (메뉴/부위/심박수/세트 등)
- completed: 항상 \`false\`

**예시:**
\`\`\`csv
time,activity,detail,completed
08:00,기상 및 아침 식사,오트밀+우유+계란으로 든든하게,false
13:00,점심 식사,운동 전 고탄수화물 (백미밥 220g+닭가슴살 200g),false
17:45,팔 웨이트 (이두/삼두),40분 이내 팔 펌핑 완료,false
18:30,고강도 인터벌 러닝,400m 질주 인터벌 6~8세트 (심박수 170+),false
19:15,운동 후 보충제,WPI 1스쿱 및 크레아틴 5g,false
20:00,저녁 식사,일반식 (밥 반 공기 + 단백질 듬뿍),false
\`\`\`
`,
}

// ─── 프롬프트 생성 ─────────────────────────────────────────
// kind: 'workout' | 'meal' | 'schedule' | 'all'
// extraNotes: 사용자가 직접 입력한 오늘만의 특이사항 (선택)
export function buildPrompt(kind, memory = {}, extraNotes = '') {
  const { ymd, dayKo, dateStr } = todayInfo()
  const context = buildContextBlock(memory)
  const userNotes = (extraNotes || '').trim()

  const head = `오늘은 **${dateStr} (${dayKo}요일)** 입니다.
저는 오늘의 ${kindLabel(kind)}을 만들어달라고 부탁드립니다.

${context ? context + '\n\n' : ''}${userNotes ? `## ⭐ 오늘 특이사항 (반드시 반영해 주세요)\n${userNotes}\n\n` : ''}---

# 작업 지시

오늘 요일과 위 마스터플랜을 보고 ${kindLabel(kind)}을 만들어 주세요.

## ⚠️ 답변 형식 (매우 중요)
- **반드시 CSV 형식**으로만 답변해 주세요.
- CSV 외 다른 설명, 코드 블록 라벨, 인사말은 **답변 첫 줄이나 끝에 짧게**만.
- CSV는 \`\`\`csv ... \`\`\` 코드 블록으로 감싸 주세요.
- 컬럼명은 영어 그대로, 값은 한국어 OK (음식 이름, 운동 이름 등).
`

  let body = ''
  if (kind === 'all') {
    body = `
**3개의 CSV를 차례로** 답변에 포함해주세요. 각 CSV는 별도 \`\`\`csv 코드 블록으로:
1. 먼저 운동(workout)
2. 다음 식단(meal)
3. 마지막 스케줄(schedule)

${SCHEMA_DOCS.workout}
${SCHEMA_DOCS.meal}
${SCHEMA_DOCS.schedule}
`
  } else {
    body = SCHEMA_DOCS[kind]
  }

  const tail = `

날짜 표시는 화면에선 \`${ymd}\` 이지만 CSV에 직접 들어가지는 않습니다 (앱이 자동 처리).

그럼 부탁드립니다 💪`

  return head + body + tail
}

function kindLabel(kind) {
  return ({
    workout:  '운동 루틴',
    meal:     '식단',
    schedule: '스케줄 (타임라인)',
    all:      '운동·식단·스케줄 (3가지 모두)',
  })[kind] || kind
}

// ─── AI 응답에서 CSV 추출 ──────────────────────────────────
// 코드 블록 ```...``` 안의 내용 또는 헤더가 있는 표를 추출
// 반환: { workout, meal, schedule } — 각자 CSV 텍스트 또는 null
export function extractCSVs(text) {
  const result = { workout: null, meal: null, schedule: null }
  if (!text) return result

  // 1) 모든 코드 블록 추출
  const blocks = []
  const fenceRe = /```(?:csv|CSV|Csv)?\s*\n([\s\S]*?)```/g
  let m
  while ((m = fenceRe.exec(text)) !== null) {
    blocks.push(m[1].trim())
  }

  // 코드 블록 없으면 전체 텍스트도 후보로
  if (blocks.length === 0) {
    blocks.push(text.trim())
  }

  // 2) 각 블록의 헤더 줄로 종류 판별
  for (const block of blocks) {
    const firstLine = block.split('\n')[0].toLowerCase()
    if (firstLine.includes('exercise_name') && firstLine.includes('body_part')) {
      result.workout = block
    } else if (firstLine.includes('meal_type') && firstLine.includes('food_name')) {
      result.meal = block
    } else if (firstLine.includes('activity') && firstLine.includes('time')) {
      result.schedule = block
    }
  }

  return result
}

// 종류 1개의 CSV만 기대할 때 — kind를 명시해 우선 매칭
export function extractSingleCSV(text, kind) {
  const all = extractCSVs(text)
  return all[kind] || null
}

// ─── CSV 텍스트 → 행 배열 (PapaParse) ─────────────────────
export function parseCSVRows(csvText) {
  if (!csvText) return []
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  return (result.data || []).filter((row) => {
    // 빈 행 + 모든 값이 빈 문자열인 행 제외
    return Object.values(row).some((v) => v != null && String(v).trim() !== '')
  })
}

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

// 마커: 줄 맨 앞 ===KEY=== 형태. 다음 마커 또는 ===END=== 전까지를 블록으로.
function extractWizardBlock(text, key) {
  const re = new RegExp(`^===${key}===\\s*$([\\s\\S]*?)(?=^===[A-Z]+===\\s*$|^===END===\\s*$|$(?![\\s\\S]))`, 'm')
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
