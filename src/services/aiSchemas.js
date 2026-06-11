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
  description: "Today's workout routine",
  properties: {
    exercises: {
      type: 'array',
      description: 'List of exercises',
      items: {
        type: 'object',
        properties: {
          exercise_name: {
            type: 'string',
            description: 'Exercise name with equipment/grip (e.g. "인클라인 덤벨 컬"). Running: include pace and recovery (e.g. "400m 인터벌 런 (13-14km/h 질주 90초 + 6km/h 90초 회복)")',
          },
          body_part: {
            type: 'string',
            enum: ['가슴', '등', '하체', '어깨', '팔', '코어', '러닝'],
            description: 'Muscle group',
          },
          sets: {
            type: 'integer',
            description: 'Number of sets. Usually 3, finisher = 2, running = interval count',
          },
          reps_or_duration: {
            type: 'string',
            description: 'Rep range ("10-12"). Finisher = "최대 횟수". Running = total duration ("18-24분")',
          },
          rest_seconds: {
            type: 'integer',
            description: 'Rest between sets (sec). Usually 60, finisher 75-90, running = 0',
          },
          weight_kg: {
            type: 'number',
            description: 'REQUIRED for all barbell/dumbbell/machine/cable exercises. Omit ONLY for running and pure bodyweight (push-ups, pull-ups, plank). Use Progressive Overload Targets if listed; otherwise estimate from BW (squat 0.6×BW, bench 0.4×BW, deadlift 0.7×BW, OHP 0.3×BW, curl 0.2×BW, cable 15kg).',
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
  description: "Today's meal plan. One food per row. All macros required",
  properties: {
    protein_target: {
      type: 'number',
      description: 'Daily protein target (g). Weight × 1.6–2.2. Use memory value if provided',
    },
    carbs_target: { type: 'number', description: 'Daily carbs target (g). Optional' },
    fat_target:   { type: 'number', description: 'Daily fat target (g). Optional' },
    meals: {
      type: 'array',
      description: 'Meal items. One food = one item. Never combine multiple foods in one row',
      items: {
        type: 'object',
        properties: {
          meal_type: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack', 'supplement'],
            description: 'breakfast/lunch/dinner = main meals. snack = general snacks/fruits/drinks. supplement = workout supps only (WPI, creatine)',
          },
          meal_time: {
            type: 'string',
            description: 'HH:MM format (e.g. "08:00"). Same-meal foods share the same time',
          },
          food_name: {
            type: 'string',
            description: 'Food name + quantity (e.g. "백미밥 200g"). Never "A + B + C" format',
          },
          protein_g: { type: 'number', description: 'Protein g. Required — estimate if unknown' },
          carbs_g:   { type: 'number', description: 'Carbs g. Required' },
          fat_g:     { type: 'number', description: 'Fat g. Required' },
          calories:  { type: 'integer', description: 'kcal (integer). Required — use 4·4·9 formula if unknown' },
        },
        required: ['meal_type', 'meal_time', 'food_name', 'protein_g', 'carbs_g', 'fat_g', 'calories'],
      },
    },
  },
  required: ['meals'],
}

export const SCHEDULE_SCHEMA = {
  type: 'object',
  description: "Today's daily schedule (timeline)",
  properties: {
    items: {
      type: 'array',
      description: 'Schedule items in chronological order',
      items: {
        type: 'object',
        properties: {
          time: {
            type: 'string',
            description: 'HH:MM format (e.g. "08:00")',
          },
          activity: {
            type: 'string',
            description: 'Short activity label (e.g. "팔 웨이트 (이두/삼두)")',
          },
          detail: {
            type: 'string',
            description: 'Required. Concrete action guide — menu/body part/heart rate/sets. Never empty string',
          },
          completed: {
            type: 'boolean',
            description: 'Always false (new creation)',
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

// ─── 공통 컨텍스트 블록 (오늘 날짜 + 마스터플랜 + 어제 분석 + 오늘 특이사항) ───
function buildContextBlock(memory, autoSummary = {}, extraNotes = '', options = {}) {
  const { includeWorkoutTrend = true, insightKinds = null } = options
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
  const allInsights = autoSummary?.yesterdayInsights || memory?.yesterdayInsights || []
  const insights = insightKinds
    ? allInsights.filter((i) => insightKinds.includes(i.kind))
    : allInsights
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

  // 최근 운동 추세 (자동 요약) — 스케줄 prompt에서는 제외
  if (includeWorkoutTrend && autoSummary?.recentWorkouts?.length) {
    ctx += `\n# Recent Workout Trend\n`
    autoSummary.recentWorkouts.slice(-5).forEach((w) => {
      if (w.setsDone === 0) ctx += `- ${w.date}: rest\n`
      else ctx += `- ${w.date}: ${w.parts} · ${w.setsDone}/${w.setsTotal} sets\n`
    })
  }

  // 점진적 과부하 목표 중량 — weight_kg 설정 최우선 참고
  const pt = memory.progressTargets
  if (pt && typeof pt === 'object') {
    const entries = Object.entries(pt).filter(([, t]) => t?.targetKg != null).slice(0, 12)
    if (entries.length > 0) {
      ctx += `\n# Progressive Overload Targets (USE as weight_kg — highest priority)\n`
      entries.forEach(([name, t]) => {
        const tag = t.status === 'hold' ? '유지' : '목표'
        ctx += `- ${name}: ${tag} ${t.targetKg}kg (현재 ${t.currentKg ?? '?'}kg)\n`
      })
      ctx += `→ For exercises listed above, set weight_kg = targetKg. For others, estimate from profile.\n`
    }
  }

  // 오늘 특이사항 — 사용자가 직접 입력 (가장 우선순위 높게 반영)
  const notes = (extraNotes || '').trim()
  if (notes) {
    ctx += `\n# ⭐ Today's Special Notes (MUST REFLECT in the plan)\n${notes}\n`
    ctx += `→ The above notes are user-provided special conditions for TODAY only. They override the master plan when they conflict. Always reflect them in your output.\n`
  }

  return ctx
}

// ─── 작업별 시스템 프롬프트 빌더 ───────────────────────────
// 한 작업당 짧고 집중된 프롬프트 — 토큰 절감 + 모델 집중

export function buildWorkoutPrompt(memory = {}, autoSummary = {}, extraNotes = '') {
  const { dateStr, dayKo, dayEn } = todayMeta()
  const ctx = buildContextBlock(memory, autoSummary, extraNotes)
  const plan = memory.workoutPlan
    ? `\n# Workout Master Plan\n⚠️ TODAY IS ${dayKo}요일 (${dayEn}). If this plan splits workouts by weekday, you MUST generate ${dayKo}요일's exercises ONLY — not another day's.\n${memory.workoutPlan}\n`
    : ''

  return `You are this user's personal fitness coach. Generate TODAY's (${dayKo}요일, ${dayEn}, ${dateStr}) workout routine and return it as JSON matching the provided schema.

${ctx}${plan}
# Rules
- **TODAY IS ${dayKo}요일 (${dayEn}). You MUST match this weekday to the master plan's split. Do NOT generate a different day's workout.**
- Exercise names MUST be specific — include equipment/grip (e.g. "케이블 트라이셉스 푸시다운 (V바)", "인클라인 덤벨 컬").
- Reps as a range ("10-12", "12-15"). Finisher = "최대 횟수" with 2 sets + 75s rest.
- For running, write pace and recovery in the name (e.g. "400m 인터벌 런 (13-14km/h 질주 90초 + 6km/h 90초 회복)"). rest_seconds = 0. sets = interval count. reps_or_duration = total minutes.
- Default rest_seconds = 60.
- **weight_kg: REQUIRED for every non-bodyweight, non-running exercise. NEVER omit.** Priority:
  1. Progressive Overload Targets section above (targetKg) — use exactly if listed
  2. User Profile body weight × ratio: squat 0.6×BW, bench 0.4×BW, deadlift 0.7×BW, OHP 0.3×BW, curl 0.2×BW, cable/machine 0.15×BW
  3. Beginner defaults: bench 30kg, squat 40kg, deadlift 50kg, OHP 25kg, curl 10kg, cable/machine 15kg
  - Omit weight_kg ONLY for running and pure bodyweight (팔굽혀펴기, 턱걸이, 플랭크 etc.)

# Output Language
All string values (exercise_name etc.) MUST be in Korean.

Return JSON only — no extra text.`
}

export function buildMealPrompt(memory = {}, autoSummary = {}, extraNotes = '') {
  const { dateStr, dayKo, dayEn } = todayMeta()
  const ctx = buildContextBlock(memory, autoSummary, extraNotes, {
    insightKinds: ['meal_no_record'],
  })
  const plan = memory.mealPlan ? `\n# Meal Master Plan\n${memory.mealPlan}\n` : ''

  // mealPlan에 이미 영양 수치(g, kcal)가 명시되어 있으면 Macro Reference 생략
  const hasMacroData = memory.mealPlan && /\d+g|\d+kcal/i.test(memory.mealPlan)
  const macroRef = hasMacroData ? '' : `
# Macro Reference (when unknown)
- 백미밥 100g ≈ 150kcal / P3 / C33 / F0.5
- 닭가슴살 100g ≈ 110kcal / P23 / C0 / F1.5
- 계란 1개(55g) ≈ 78kcal / P6.3 / C0.6 / F5.3
- 우유 200ml ≈ 130kcal / P6.6 / C9.6 / F7.4
- 바나나 1개(120g) ≈ 105kcal / P1 / C27 / F0
- WPI 프로틴 1스쿱(30g) ≈ 110kcal / P23 / C2 / F1
`

  return `You are this user's personal fitness coach. Generate TODAY's (${dayKo}요일, ${dayEn}, ${dateStr}) meal plan and return it as JSON matching the provided schema.

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
- Always include protein_target AND carbs_target AND fat_target when user weight is known (P = W×1.6~2.2, C = W×3~4, F = W×0.8~1).
- Use short food_name (no unnecessary descriptions).
${macroRef}
# Output Language
All string values (food_name etc.) MUST be in Korean.

Return JSON only — no extra text.`
}

export function buildSchedulePrompt(memory = {}, autoSummary = {}, extraNotes = '') {
  const { dateStr, dayKo, dayEn } = todayMeta()
  const ctx = buildContextBlock(memory, autoSummary, extraNotes, {
    includeWorkoutTrend: false,
    insightKinds: ['schedule_skipped', 'workout_skipped', 'workout_partial'],
  })
  const plan = memory.workoutPlan || memory.mealPlan
    ? `\n# Reference Plans\n⚠️ TODAY IS ${dayKo}요일 (${dayEn}). Build the schedule around ${dayKo}요일's workout and meals from the plans below.\n${memory.workoutPlan ? `## Workout Plan\n${memory.workoutPlan}\n` : ''}${memory.mealPlan ? `## Meal Plan\n${memory.mealPlan}\n` : ''}`
    : ''

  return `You are this user's personal fitness coach. Generate TODAY's (${dayKo}요일, ${dayEn}, ${dateStr}) daily schedule (timeline) and return it as JSON matching the provided schema.

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
