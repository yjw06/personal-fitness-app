// Gemini API 호출 — JSON Schema 모드 + Chat 모드 분기
// JSON 모드: responseSchema 기반 구조화 출력 (도구 환각 X)
// Chat 모드: 자유 대화 + save_to_memory 단일 도구

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'gemini-2.5-flash'

// 503 high demand 발생 시 자동 폴백 체인
const FALLBACK_CHAIN = {
  'gemini-2.5-pro':        ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  'gemini-2.5-flash':      ['gemini-2.5-flash-lite'],
  'gemini-2.5-flash-lite': [],
}

export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash',      label: 'Flash (균형, 권장)' },
  { id: 'gemini-2.5-pro',        label: 'Pro (최고 품질, 느림·혼잡)' },
  { id: 'gemini-2.5-flash-lite', label: 'Flash Lite (간단 대화용)' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504])

// gemini-2.5는 기본 thinking이 켜져 있어 생각 토큰이 maxOutputTokens를
// 잠식 → 빈 응답의 주원인. 구조화 생성/대화엔 thinking 불필요.
// pro는 thinking 비활성화 불가(최소 128) — flash 계열만 0으로 끈다.
function thinkingConfigFor(model) {
  if (model.includes('pro')) return undefined
  return { thinkingBudget: 0 }
}

// finishReason → 사용자용 에러 메시지
function emptyResponseMessage(finishReason) {
  switch (finishReason) {
    case 'SAFETY':     return 'AI 안전 필터에 걸렸어요. 표현을 바꿔 다시 시도해 주세요.'
    case 'RECITATION': return '인용 제한으로 응답이 중단됐어요. 다시 시도해 주세요.'
    case 'MAX_TOKENS': return '응답이 토큰 한도에서 잘렸어요. 다시 시도해 주세요.'
    default:           return 'AI가 빈 응답을 반환했어요. 잠시 후 다시 시도해 주세요.'
  }
}

export const COMPRESS_AT   = 16  // rawContents 이 길이 이상이면 압축
const        COMPRESS_KEEP = 8   // 최근 N개 entry는 유지

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

// 로컬 시간 기준 오늘 YYYYMMDD (UTC 변환 X)
export function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

// ─── Chat 모드용 단일 도구: save_to_memory ──────────────────
// JSON 모드는 도구 자체를 안 쓰지만, 자유 대화에선 이거 하나만 살림
export const CHAT_TOOLS = [
  {
    name: 'save_to_memory',
    description: 'Saves important information from the conversation to permanent memory. Use for: injuries, preferences, goal changes, schedule changes, physical condition. Referenced in all future conversations and plan generation.',
    parameters: {
      type: 'object',
      properties: {
        key:   { type: 'string', description: 'Memory category (e.g. injury, preference, goal_change, schedule_change, condition)' },
        value: { type: 'string', description: 'Content to remember (e.g. "left knee pain started 5/23")' },
      },
      required: ['key', 'value'],
    },
  },
]

// ─── Chat 모드용 간략 시스템 프롬프트 ──────────────────────
export function buildChatSystemInstruction(memory = {}, autoSummary = {}) {
  const today = new Date()
  const ymd = todayYmd()
  const dayName = DAY_NAMES[today.getDay()]
  const dateStr = today.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  let prompt = `You are this user's personal fitness coach (free chat mode).

# Output Language
Respond in natural Korean (자연스러운 존댓말). No "다나까" style.

# Today — 오늘은 ${dayName}요일입니다
${dateStr} (${dayName}요일) — YYYYMMDD: ${ymd}
When discussing plans, workouts, or schedules, always base them on ${dayName}요일 unless the user specifies otherwise.

# How to help
- Free conversation: answer the user's questions about training, nutrition, recovery, motivation, etc.
- When the user shares new persistent info (injury, schedule change, preference, condition), call \`save_to_memory\` so it's remembered for future plan generation.
- To generate workouts/meals/schedules, the user should use slash commands (/운동, /식단, /스케줄, /오늘) — those bypass chat and call structured generation directly. If they ask in chat, gently suggest the slash command.
- Keep responses short and useful. No code blocks, no long lists unless asked.
`

  if (memory.profile)      prompt += `\n# User Profile\n${memory.profile}\n`
  if (memory.coachPersona) prompt += `\n# Coach Persona\n${memory.coachPersona}\n`

  if (memory.aiNotes?.length) {
    prompt += `\n# Memory Notes\n`
    memory.aiNotes.forEach((n) => {
      const d = n.ts ? new Date(n.ts).toISOString().slice(0,10) : ''
      prompt += `- ${d ? `[${d}] ` : ''}${n.key}: ${n.value}\n`
    })
  }

  if (autoSummary?.recentBody?.length) {
    prompt += `\n# Recent Body Records\n`
    autoSummary.recentBody.forEach((r) => {
      const parts = []
      if (r.weight_kg)      parts.push(`weight ${r.weight_kg}kg`)
      if (r.body_fat_pct)   parts.push(`fat ${r.body_fat_pct}%`)
      if (r.muscle_mass_kg) parts.push(`muscle ${r.muscle_mass_kg}kg`)
      prompt += `- ${r.date || '-'}: ${parts.join(' / ')}\n`
    })
  }

  if (autoSummary?.recentWorkouts?.length) {
    prompt += `\n# Last 14 Days Workout\n`
    autoSummary.recentWorkouts.forEach((w) => {
      if (w.setsDone === 0) prompt += `- ${w.date}: rest\n`
      else prompt += `- ${w.date}: ${w.parts} · ${w.exerciseCount} ex · ${w.setsDone}/${w.setsTotal} sets\n`
    })
  }

  return prompt
}

// ─── 단일 호출 ──────────────────────────────────────────────
async function callOnce({ apiKey, model, body }) {
  const url = `${BASE_URL}/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    let msg = `Gemini API 오류 (${res.status})`
    let retryDelayMs = null
    try {
      const parsed = JSON.parse(errText)
      msg = parsed.error?.message || msg
      // 429 응답의 RetryInfo: { "retryDelay": "32s" }
      const retryInfo = parsed.error?.details?.find((d) => d['@type']?.includes('RetryInfo'))
      const delayStr = retryInfo?.retryDelay
      if (delayStr) retryDelayMs = Math.min(parseFloat(delayStr) * 1000 || 0, 10000)
    } catch { msg = errText.slice(0, 200) || msg }
    const err = new Error(msg)
    err.status = res.status
    if (retryDelayMs) err.retryDelayMs = retryDelayMs
    throw err
  }
  return res.json()
}

// ─── 재시도 + 폴백 wrapper ─────────────────────────────────
// 모델당 최대 2회 (백오프 + jitter, Retry-After 존중) → 실패 시 폴백 체인.
// overload(503/high demand)도 즉시 포기하지 않고 한 번 기다렸다 재시도.
async function callWithRetry({ apiKey, model, body, onModelSwitch }) {
  if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다. 설정에서 등록해주세요.')

  const chain = [model, ...(FALLBACK_CHAIN[model] || [])]
  let lastErr

  for (let m = 0; m < chain.length; m++) {
    const currentModel = chain[m]
    // 폴백 모델에 맞춰 thinkingConfig 갱신 (pro↔flash 차이)
    if (body.generationConfig) {
      const tc = thinkingConfigFor(currentModel)
      if (tc) body.generationConfig.thinkingConfig = tc
      else delete body.generationConfig.thinkingConfig
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callOnce({ apiKey, model: currentModel, body })
      } catch (err) {
        lastErr = err
        if (!TRANSIENT_STATUSES.has(err.status)) throw err
        if (attempt === 0) {
          // API가 알려준 대기시간 > 지수 백오프(1s) + jitter
          const wait = err.retryDelayMs ?? (1000 + Math.random() * 500)
          await sleep(wait)
          continue
        }
        // 2회 실패 → 다음 모델로 폴백
        if (m < chain.length - 1) {
          try { onModelSwitch?.(currentModel, chain[m + 1], err.message) } catch {}
        }
        break
      }
    }
  }
  throw lastErr || new Error('Gemini 호출 실패')
}

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

// ─── JSON 모드 ─────────────────────────────────────────────
// Gemini responseSchema로 구조화 출력 강제 → 도구 호출 X, 환각 X
// JSON 파싱 실패/응답 잘림 시 자동 재시도
export async function callGeminiJSON({
  apiKey, model = DEFAULT_MODEL,
  system, schema,
  onModelSwitch,
  maxOutputTokens = 16384,  // 식단처럼 긴 JSON 대응 — 기본을 넉넉히
}) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: '작업 시작' }] }],
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: schema,
      // flash 계열: thinking 끔 — 생각 토큰이 출력을 잠식해 빈 응답/잘림 유발
      ...(thinkingConfigFor(model) ? { thinkingConfig: thinkingConfigFor(model) } : {}),
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  }

  // 최대 2회 시도 (파싱 실패 / 잘림 시 한 번 재시도)
  let lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await callWithRetry({ apiKey, model, body, onModelSwitch })
      const candidate = response?.candidates?.[0]
      const finishReason = candidate?.finishReason || ''
      const parts = candidate?.content?.parts || []
      const text = parts.filter((p) => p.text).map((p) => p.text).join('')

      if (!text) {
        throw new Error(emptyResponseMessage(finishReason))
      }

      // 응답이 토큰 한계로 잘렸으면 — JSON 파싱 시도 후 실패하면 의미 있는 에러
      const wasTruncated = finishReason === 'MAX_TOKENS' || finishReason === 'OTHER'

      let data
      try {
        data = JSON.parse(text)
      } catch (parseErr) {
        // 잘렸을 가능성이 크면 부분 복구 시도 (배열 닫기)
        if (wasTruncated) {
          const repaired = tryRepairTruncatedJSON(text)
          if (repaired) {
            data = repaired
          } else {
            throw new Error(
              `AI 응답이 너무 길어 잘렸어요 (식단·스케줄이 큰 경우 흔함). ` +
              `더 큰 모델(Pro) 사용을 권장하거나 마스터플랜을 짧게 줄여 보세요.`
            )
          }
        } else {
          throw new Error(`AI 응답이 올바른 JSON이 아닙니다: ${parseErr.message}`)
        }
      }

      return { data, raw: text, truncated: wasTruncated }
    } catch (err) {
      lastErr = err
      // 다음 시도는 약간 더 큰 토큰 한도로
      if (attempt === 0) {
        body.generationConfig.maxOutputTokens = Math.min(32768, body.generationConfig.maxOutputTokens * 2)
      }
    }
  }
  throw lastErr
}

// 잘린 JSON 부분 복구 시도 — 마지막 완전한 객체까지만 살림
// 식단처럼 meals[]가 잘릴 때 효과적: 마지막 닫힌 } 까지만 keep + 배열·객체 닫기
function tryRepairTruncatedJSON(text) {
  // 마지막 완전한 객체 끝 (}) 위치 찾기
  let depth = 0
  let inString = false
  let escape = false
  let lastClean = -1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (escape) { escape = false; continue }
    if (c === '\\' && inString) { escape = true; continue }
    if (c === '"') inString = !inString
    if (inString) continue
    if (c === '{' || c === '[') depth++
    if (c === '}' || c === ']') {
      depth--
      if (depth === 1) lastClean = i  // 최상위 객체 내부의 마지막 닫힌 자식
    }
  }
  if (lastClean < 0) return null

  // 후보 = text[0..lastClean] + 필요한 닫기
  const head = text.slice(0, lastClean + 1)
  // head 안에서 열린 만큼 닫기
  let d = 0
  let s = false
  let esc = false
  const stack = []
  for (let i = 0; i < head.length; i++) {
    const c = head[i]
    if (esc) { esc = false; continue }
    if (c === '\\' && s) { esc = true; continue }
    if (c === '"') s = !s
    if (s) continue
    if (c === '{') { stack.push('}'); d++ }
    if (c === '[') { stack.push(']'); d++ }
    if (c === '}' || c === ']') { stack.pop(); d-- }
  }
  const closed = head + stack.reverse().join('')
  try {
    return JSON.parse(closed)
  } catch {
    return null
  }
}

// ─── Chat 모드 ─────────────────────────────────────────────
// 자유 대화 — save_to_memory 단일 도구만 사용 가능
export async function callGeminiChat({
  apiKey, model = DEFAULT_MODEL,
  contents, memory, autoSummary,
  onModelSwitch,
}) {
  const body = {
    contents,
    systemInstruction: { parts: [{ text: buildChatSystemInstruction(memory, autoSummary) }] },
    tools: [{ functionDeclarations: CHAT_TOOLS }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
      ...(thinkingConfigFor(model) ? { thinkingConfig: thinkingConfigFor(model) } : {}),
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  }

  // 빈 응답이면 1회 자동 재시도 (일시적 현상이 대부분)
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await callWithRetry({ apiKey, model, body, onModelSwitch })
    const extracted = extractChatResponse(response)
    if (extracted.text || extracted.functionCalls.length) return extracted
    if (attempt === 0) { await sleep(600); continue }
    throw new Error(emptyResponseMessage(extracted.finishReason))
  }
}

export function extractChatResponse(geminiResponse) {
  const candidate = geminiResponse?.candidates?.[0]
  if (!candidate) return { text: '', functionCalls: [], raw: null, finishReason: '' }
  const parts = candidate.content?.parts || []
  const text = parts.filter((p) => p.text).map((p) => p.text).join('')
  const functionCalls = parts
    .filter((p) => p.functionCall)
    .map((p) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }))
  return {
    text,
    functionCalls,
    raw: candidate.content,
    finishReason: candidate.finishReason || '',
  }
}

// ─── 슬라이딩 윈도우 압축 ──────────────────────────────────
// 오래된 rawContents를 요약 교환 쌍 + 최근 N개로 교체
// 실패 시 null 반환 → 호출측에서 원본 rawContents 유지
export async function compressConversation({
  rawContents, prevSummary = '', apiKey, model = 'gemini-2.5-flash-lite',
}) {
  if (!apiKey || rawContents.length < COMPRESS_AT) return null

  const toCompress = rawContents.slice(0, rawContents.length - COMPRESS_KEEP)
  const toKeep     = rawContents.slice(-COMPRESS_KEEP)

  // 텍스트 turn만 직렬화 (function call/response entry는 [tool] 로 표기)
  const dialogText = toCompress
    .map((c) => {
      const role = c.role === 'user' ? 'User' : 'AI'
      const textPart = c.parts?.find((p) => p.text)
      if (textPart) return `${role}: ${textPart.text}`
      const hasFn = c.parts?.some((p) => p.functionCall || p.functionResponse)
      return hasFn ? `${role}: [tool call]` : null
    })
    .filter(Boolean)
    .join('\n')

  if (!dialogText.trim()) return null

  const prevBlock = prevSummary
    ? `[Previous summary]\n${prevSummary}\n\n`
    : ''

  const compressPrompt = `${prevBlock}Summarize the following fitness coach conversation into 3-5 bullet points.
Focus on: injuries/physical conditions, user preferences, decisions made, important context.
Omit small talk. Output in Korean.

${dialogText}`

  try {
    const body = {
      contents: [{ role: 'user', parts: [{ text: compressPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    }
    const resp = await callOnce({ apiKey, model, body })
    const summaryText = resp?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!summaryText) return null

    // 요약을 fake 교환 쌍으로 주입 (모델이 이전 맥락으로 인식)
    const summaryPair = [
      { role: 'user',  parts: [{ text: `[Previous conversation summary]\n${summaryText}` }] },
      { role: 'model', parts: [{ text: '이전 대화 맥락 파악했습니다.' }] },
    ]

    return { newContents: [...summaryPair, ...toKeep], summaryText }
  } catch {
    return null
  }
}
