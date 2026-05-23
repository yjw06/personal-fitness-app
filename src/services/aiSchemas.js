// JSON Schema 정의 + 작업별 시스템 프롬프트 빌더
// Gemini의 responseSchema와 함께 사용 → Function Calling 환각 문제 해결
//
// 핵심: 한 호출당 한 가지 작업만. 시스템 프롬프트는 짧게.

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토']
const DAY_NAMES_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
}

function todayMeta() {
  const d = new Date()
  const ymd = todayYmd()
  const dayKo = DAY_NAMES_KO[d.getDay()]
  const dayEn = DAY_NAMES_EN[d.getDay()]
  const dateStr = d.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })
  return { ymd, dayKo, dayEn, dateStr }
}

// ─── JSON Schema 3종 ──────────────────────────────────────
// Gemini responseSchema는 OpenAPI 3.0 Schema 형식 일부 (type, properties, items, required, description, enum)

export const WORKOUT_SCHEMA = {
  type: 'object',
  description: '오늘의 운동 루틴',
  properties: {
    exercises: {
      type: 'array',
      description: '운동 종목 목록',
      items: {
        type: 'object',
        properties: {
          exercise_name: {
            type: 'string',
            description: '운동 이름. 도구·장비·그립까지 명시 (예: "인클라인 덤벨 컬", "케이블 트라이셉스 푸시다운 (V바)"). 러닝은 속도·시간·회복까지 (예: "400m 인터벌 런 (13-14km/h 질주 90초 + 6km/h 90초 회복)")',
          },
          body_part: {
            type: 'string',
            enum: ['가슴', '등', '하체', '어깨', '팔', '코어', '러닝'],
            description: '운동 부위',
          },
          sets: {
            type: 'integer',
            description: '세트 수. 보통 3, 마무리는 2, 러닝은 인터벌 횟수',
          },
          reps_or_duration: {
            type: 'string',
            description: '반복 수는 범위로 ("10-12", "12-15"). 마무리는 "최대 횟수". 러닝은 총 시간 ("18-24분")',
          },
          rest_seconds: {
            type: 'integer',
            description: '세트 간 휴식(초). 보통 60, 마무리 75-90, 러닝은 0',
          },
        },
        required: ['exercise_name', 'body_part', 'sets', 'reps_or_duration', 'rest_seconds'],
      },
    },
  },
  required: ['exercises'],
}

export const MEAL_SCHEMA = {
  type: 'object',
  description: '오늘의 식단. 모든 음식은 한 행씩 분리. 모든 매크로 필수',
  properties: {
    protein_target: {
      type: 'number',
      description: '하루 단백질 목표(g). 사용자 체중 × 1.6~2.2 범위 — 메모리에 명시되어 있으면 그 값 우선',
    },
    carbs_target: { type: 'number', description: '하루 탄수화물 목표(g). 선택' },
    fat_target:   { type: 'number', description: '하루 지방 목표(g). 선택' },
    meals: {
      type: 'array',
      description: '식사 항목들. 한 음식 = 한 항목으로 분리. "오트밀+우유+계란" 같이 합치지 말 것',
      items: {
        type: 'object',
        properties: {
          meal_type: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack', 'supplement'],
            description: '주요 식사는 breakfast/lunch/dinner. 일반 간식·과일·음료(바나나, 사과, 카페인)는 snack. 운동용 보충제(WPI, 크레아틴)만 supplement',
          },
          meal_time: {
            type: 'string',
            description: 'HH:MM 형식 (예: "08:00"). 같은 끼니의 여러 음식은 동일 시간 공유',
          },
          food_name: {
            type: 'string',
            description: '음식명 + 분량 필수 (예: "백미밥 200g", "계란 3개 (스크램블)"). 절대 "A + B + C" 형태 X',
          },
          protein_g: { type: 'number', description: '단백질 g. 필수, 모르면 추정치라도 채울 것' },
          carbs_g:   { type: 'number', description: '탄수화물 g. 필수' },
          fat_g:     { type: 'number', description: '지방 g. 필수' },
          calories:  { type: 'integer', description: '칼로리 kcal (정수). 필수, 모르면 4·4·9 공식으로 계산' },
        },
        required: ['meal_type', 'meal_time', 'food_name', 'protein_g', 'carbs_g', 'fat_g', 'calories'],
      },
    },
  },
  required: ['meals'],
}

export const SCHEDULE_SCHEMA = {
  type: 'object',
  description: '오늘의 일일 스케줄(타임라인)',
  properties: {
    items: {
      type: 'array',
      description: '시간 순서대로 정렬된 일정 항목',
      items: {
        type: 'object',
        properties: {
          time: {
            type: 'string',
            description: 'HH:MM (예: "08:00")',
          },
          activity: {
            type: 'string',
            description: '짧은 활동 라벨 (예: "팔 웨이트 (이두/삼두)", "운동 전 간식")',
          },
          detail: {
            type: 'string',
            description: '필수. 구체적 행동 가이드 — 메뉴/부위/심박수/세트 등 측정 가능한 정보 (예: "400m 질주 인터벌 6~8세트 (심박수 170+)", "WPI 1스쿱 및 크레아틴 5g 섭취"). 빈 문자열 금지',
          },
          completed: {
            type: 'boolean',
            description: '항상 false (신규 생성)',
          },
        },
        required: ['time', 'activity', 'detail', 'completed'],
      },
    },
  },
  required: ['items'],
}

export const SCHEMAS = {
  workout:  WORKOUT_SCHEMA,
  meal:     MEAL_SCHEMA,
  schedule: SCHEDULE_SCHEMA,
}

// ─── 공통 컨텍스트 블록 (오늘 날짜 + 마스터플랜 + 어제 분석) ───
function buildContextBlock(memory, autoSummary = {}) {
  const { dateStr, ymd, dayKo, dayEn } = todayMeta()

  let ctx = `# Today
Date: ${dateStr} (${dayEn})
YYYYMMDD: ${ymd} — Weekday: ${dayKo}요일 (${dayEn})
`

  if (memory.profile) {
    ctx += `\n# User Profile\n${memory.profile}\n`
  }
  if (memory.coachPersona) {
    ctx += `\n# Coach Persona (extra tone/style)\n${memory.coachPersona}\n`
  }
  if (memory.aiNotes?.length) {
    ctx += `\n# Memory Notes (info recorded in past conversations — always reference)\n`
    memory.aiNotes.forEach((n) => {
      const date = n.ts ? new Date(n.ts).toISOString().slice(0,10) : ''
      ctx += `- ${date ? `[${date}] ` : ''}${n.key}: ${n.value}\n`
    })
  }

  // 어제 미완료/이탈 자동 감지 (AI가 오늘 계획에 반영하도록)
  const insights = autoSummary?.yesterdayInsights || memory?.yesterdayInsights || []
  if (insights.length > 0) {
    ctx += `\n# Yesterday's Deviations (use this to adjust today's plan)\n`
    insights.forEach((ins) => {
      if (ins.kind === 'schedule_skipped') {
        ctx += `- Skipped ${ins.count} scheduled items: ${ins.items.join(' / ')}\n`
      } else if (ins.kind === 'workout_skipped') {
        ctx += `- Workout fully skipped: ${ins.note}\n`
      } else if (ins.kind === 'workout_partial') {
        ctx += `- Workout partially done: ${ins.note}\n`
      } else if (ins.kind === 'meal_no_record') {
        ctx += `- Meal: ${ins.note}\n`
      }
    })
    ctx += `→ Consider these when planning today: adjust intensity if rested, add what was missed, etc.\n`
  }

  // 최근 운동 추세 (자동 요약)
  if (autoSummary?.recentWorkouts?.length) {
    ctx += `\n# Last 14 Days Workout Trend\n`
    autoSummary.recentWorkouts.slice(-7).forEach((w) => {
      if (w.setsDone === 0) ctx += `- ${w.date}: rest\n`
      else ctx += `- ${w.date}: ${w.parts} · ${w.setsDone}/${w.setsTotal} sets\n`
    })
  }

  return ctx
}

// ─── 작업별 시스템 프롬프트 빌더 ───────────────────────────
// 한 작업당 짧고 집중된 프롬프트 — 토큰 절감 + 모델 집중

export function buildWorkoutPrompt(memory = {}, autoSummary = {}) {
  const ctx = buildContextBlock(memory, autoSummary)
  const plan = memory.workoutPlan ? `\n# Workout Master Plan\n${memory.workoutPlan}\n` : ''

  return `You are this user's personal fitness coach. Generate today's workout routine and return it as JSON matching the provided schema.

${ctx}${plan}
# Rules
- Match today's weekday with the user's master plan workout split if provided.
- Exercise names MUST be specific — include equipment/grip (e.g. "케이블 트라이셉스 푸시다운 (V바)", "인클라인 덤벨 컬").
- Reps as a range ("10-12", "12-15"). Finisher = "최대 횟수" with 2 sets + 75s rest.
- For running, write pace and recovery in the name (e.g. "400m 인터벌 런 (13-14km/h 질주 90초 + 6km/h 90초 회복)"). rest_seconds = 0. sets = interval count. reps_or_duration = total minutes.
- Default rest_seconds = 60.

# Output Language
All string values (exercise_name etc.) MUST be in Korean.

Return JSON only — no extra text.`
}

export function buildMealPrompt(memory = {}, autoSummary = {}) {
  const ctx = buildContextBlock(memory, autoSummary)
  const plan = memory.mealPlan ? `\n# Meal Master Plan\n${memory.mealPlan}\n` : ''

  return `You are this user's personal fitness coach. Generate today's meal plan and return it as JSON matching the provided schema.

${ctx}${plan}
# Critical Rules
- **ONE food per row.** Never combine with "+" (e.g. NEVER "오트밀 50g + 우유 200ml" in one food_name).
  - Right: 3 separate rows sharing meal_time "08:00" — "오트밀 50g" / "우유 200ml" / "계란 2개"
- **food_name MUST include quantity** (e.g. "백미밥 200g", "계란 3개 (스크램블)", "WPI 프로틴 1스쿱").
- **All 4 macro fields (calories/protein_g/carbs_g/fat_g) MUST be filled** — even with estimates.
- meal_type classification:
  - breakfast/lunch/dinner = main meals
  - snack = general snacks/fruits/drinks (바나나, 사과, 카페인, 차)
  - supplement = workout supplements only (WPI, 크레아틴, BCAA, 비타민)
- protein_target = user weight × 1.6~2.2 g (use memory value if present).

# Output Size Limit (IMPORTANT — keep response compact)
- Total food items across all meals: **maximum 14**. Aim for 10-12 items.
- Main meals (breakfast/lunch/dinner): 2-3 foods each
- Snack: 1-2 items max
- Supplement: 1-2 items max
- Skip optional protein_target/carbs_target/fat_target if user weight unknown.
- Use short food_name (no unnecessary descriptions).

# Macro Reference (when unknown)
- 백미밥 100g ≈ 150kcal / P3 / C33 / F0.5
- 닭가슴살 100g ≈ 110kcal / P23 / C0 / F1.5
- 계란 1개(55g) ≈ 78kcal / P6.3 / C0.6 / F5.3
- 우유 200ml ≈ 130kcal / P6.6 / C9.6 / F7.4
- 바나나 1개(120g) ≈ 105kcal / P1 / C27 / F0
- WPI 프로틴 1스쿱(30g) ≈ 110kcal / P23 / C2 / F1

# Output Language
All string values (food_name etc.) MUST be in Korean.

Return JSON only — no extra text.`
}

export function buildSchedulePrompt(memory = {}, autoSummary = {}) {
  const ctx = buildContextBlock(memory, autoSummary)
  const plan = memory.workoutPlan || memory.mealPlan
    ? `\n# Reference Plans\n${memory.workoutPlan ? `## Workout\n${memory.workoutPlan}\n` : ''}${memory.mealPlan ? `## Meal\n${memory.mealPlan}\n` : ''}`
    : ''

  return `You are this user's personal fitness coach. Generate today's daily schedule (timeline) and return it as JSON matching the provided schema.

${ctx}${plan}
# Rules
- Build a chronological timeline covering wake-up → meals → workout → recovery → sleep.
- **\`detail\` is REQUIRED** — must be concrete and actionable (1-2 sentences with menu, body part, sets, heart rate, etc.). Never empty.
- Activity = short label (workout rows can use parens for body part: "팔 웨이트 (이두/삼두)").
- Place pre-workout snack/carbs, post-workout supplement around training time logically.
- completed always = false.

# Category-specific detail guide
- Workout → body part + key exercises + time limit (e.g. "40분 이내 팔 펌핑 완료")
- Running → distance + pace + heart rate + sets (e.g. "400m 질주 인터벌 6~8세트 (심박수 170+)")
- Meal → menu (e.g. "닭가슴살 200g + 백미밥 1공기 + 야채")
- Supplement → type + dose (e.g. "WPI 1스쿱 및 크레아틴 5g 섭취")
- Rest → recommended action (e.g. "스트레칭 10분 또는 짧은 낮잠")

# Output Language
All string values (activity, detail) MUST be in Korean.

Return JSON only — no extra text.`
}

// 작업 종류 → 빌더/스키마 매핑
export function getJobConfig(kind) {
  switch (kind) {
    case 'workout':  return { schema: WORKOUT_SCHEMA,  buildPrompt: buildWorkoutPrompt }
    case 'meal':     return { schema: MEAL_SCHEMA,     buildPrompt: buildMealPrompt }
    case 'schedule': return { schema: SCHEDULE_SCHEMA, buildPrompt: buildSchedulePrompt }
    default:
      throw new Error(`Unknown job kind: ${kind}`)
  }
}

// 작업 종류 → 한글 라벨
export function kindLabel(kind) {
  return ({ workout: '운동', meal: '식단', schedule: '스케줄' })[kind] || kind
}
