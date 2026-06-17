import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../hooks/useAuth'
import { useWorkoutStore } from '../stores/workoutStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useMemoryStore } from '../stores/memoryStore'
import { fetchVolumeHistory } from '../services/csvService'
import { callGeminiChat, callGeminiJSON } from '../services/aiCoach'
import { computeProgression } from '../utils/progressionLocal'
import {
  aggregateVolumeByPart, totalVolume,
  calcExerciseVolume, calcRepVolume, isCardio, isAssistExercise, fmtVolume,
} from '../utils/volumeUtils'
import LineChart from '../components/Chart/LineChart'
import BarChart  from '../components/Chart/BarChart'
import ApiKeyNotice from '../components/Ai/ApiKeyNotice'
import { Sparkles, TrendingUp, Check, RefreshCw } from 'lucide-react'
import './VolumePage.css'

// 과부하 판정은 로컬 계산 (progressionLocal.js) — AI는 코멘트 보강에만 사용
const COMMENT_SCHEMA = {
  type: 'object',
  properties: {
    comments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          exercise_name: { type: 'string', description: 'Exact exercise name from the input' },
          comment:       { type: 'string', description: 'One Korean sentence: actionable coaching tip for this progression decision' },
        },
        required: ['exercise_name', 'comment'],
      },
    },
  },
  required: ['comments'],
}

const PART_COLORS = {
  '가슴': '#6366f1', '등': '#22d3ee', '하체': '#10b981',
  '어깨': '#f59e0b', '팔': '#f97316', '코어': '#ec4899', '러닝': '#a78bfa',
}

export default function VolumePage() {
  const { user } = useAuth()
  const workoutData  = useWorkoutStore((s) => s.workoutData)
  const selectedDate = useWorkoutStore((s) => s.selectedDate)
  const aiModel = useSettingsStore((s) => s.aiModel)
  const memory  = useMemoryStore()
  const apiKey  = memory.apiKey

  const recentBody = memory.recentBody
  const bodyWeight = recentBody?.length ? parseFloat(recentBody[recentBody.length - 1]?.weight_kg) || null : null

  const [history, setHistory]         = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [aiResponse, setAiResponse]   = useState('')
  const [aiLoading, setAiLoading]     = useState(false)
  const [aiError, setAiError]         = useState('')

  const [progression, setProgression]     = useState(null)
  const [progLoading, setProgLoading]     = useState(false)
  const [progError, setProgError]         = useState('')

  const [aiMode, setAiMode] = useState('volume')

  // 14일 히스토리 조회
  const loadHistory = useCallback(async () => {
    if (!user) return
    setHistLoading(true)
    try {
      const data = await fetchVolumeHistory(user.uid, 14)
      setHistory(data)
    } catch {
      // 히스토리 조회 실패는 조용히 처리
    } finally {
      setHistLoading(false)
    }
  }, [user])

  useEffect(() => { loadHistory() }, [loadHistory])

  // ─── 오늘 볼륨 계산 ──────────────────────────────────────────
  const todayExercises = workoutData ?? []
  const byPartToday    = aggregateVolumeByPart(todayExercises, bodyWeight)
  const totalToday     = totalVolume(todayExercises, bodyWeight)
  const hasWeightToday = totalToday > 0

  // ─── 14일 라인 차트 데이터 ───────────────────────────────────
  const lineData = history.map(({ date, rows }) => ({
    x: `${date.slice(4, 6)}/${date.slice(6, 8)}`,
    y: totalVolume(rows, bodyWeight),
  }))

  // ─── 최근 7일 부위별 막대 차트 데이터 ───────────────────────
  const last7 = history.slice(-7)
  const partTotals7 = {}
  for (const { rows } of last7) {
    const bp = aggregateVolumeByPart(rows, bodyWeight)
    for (const [p, v] of Object.entries(bp)) {
      partTotals7[p] = (partTotals7[p] ?? 0) + v
    }
  }
  const barData = Object.entries(partTotals7)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: PART_COLORS[label] }))

  // ─── AI 볼륨 분석 호출 ───────────────────────────────────────
  const handleAiAnalysis = useCallback(async () => {
    if (!apiKey) { setAiError('설정에서 Gemini API 키를 먼저 등록해 주세요.'); return }
    setAiLoading(true)
    setAiError('')
    setAiResponse('')

    const exerciseLines = todayExercises.length
      ? todayExercises.map((ex) => {
          const vol  = calcExerciseVolume(ex, bodyWeight)
          const wStr = ex.weight_kg != null ? `${ex.weight_kg}kg` : '중량 미설정'
          const vStr = vol != null ? ` → 볼륨 ${fmtVolume(vol)}kg` : ''
          return `- ${ex.exercise_name} (${ex.body_part}): ${ex.sets}세트 × ${ex.reps_or_duration} × ${wStr}${vStr}`
        }).join('\n')
      : '운동 기록 없음'

    const partLines = Object.entries(byPartToday).length
      ? Object.entries(byPartToday).map(([p, v]) => `- ${p}: ${fmtVolume(v)}kg`).join('\n')
      : '볼륨 계산 불가 (중량 미설정)'

    const weeklyLines = Object.entries(partTotals7).length
      ? Object.entries(partTotals7).map(([p, v]) => `- ${p}: ${fmtVolume(v)}kg`).join('\n')
      : '데이터 없음'

    const prompt = `오늘(${selectedDate}) 운동 볼륨을 분석하고 추천해줘.

[오늘 운동]
${exerciseLines}

[오늘 부위별 볼륨]
${partLines}
오늘 총 볼륨: ${fmtVolume(totalToday)}kg

[최근 7일 부위별 누적 볼륨]
${weeklyLines}

다음 4가지를 한국어로 답변해줘:
1. 오늘 볼륨이 근성장에 충분한지 부위별로 평가 (초급 기준 부위당 주 10-20세트)
2. 중량이 미설정된 운동에 초보자 시작 중량 구체적으로 제안 (예: "벤치프레스 → 40kg")
3. 다음 세션에서 볼륨을 늘리는 구체적 방법 (세트 수 또는 중량 기준)
4. 최근 7일 부위 편중이 있다면 균형 잡는 조언`

    try {
      const memSnap = {
        profile: memory.profile,
        workoutPlan: memory.workoutPlan,
        coachPersona: memory.coachPersona,
        aiNotes: memory.aiNotes,
      }
      const { text } = await callGeminiChat({
        apiKey,
        model: aiModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        memory: memSnap,
        autoSummary: {},
      })
      setAiResponse(text || '응답이 비었어요. 잠시 후 다시 시도해 주세요.')

      // Save volume summary to AI memory for future use
      if (text && user) {
        const summaryLine = `(${selectedDate}) 총볼륨 ${fmtVolume(totalToday)}kg` +
          (Object.keys(byPartToday).length
            ? `. 부위별: ${Object.entries(byPartToday).map(([p, v]) => `${p} ${fmtVolume(v)}kg`).join(', ')}`
            : '') +
          (Object.keys(partTotals7).length
            ? `. 7일누적: ${Object.entries(partTotals7).map(([p, v]) => `${p} ${fmtVolume(v)}kg`).join(', ')}`
            : '')
        await memory.addAiNote(user.uid, 'volume_summary', summaryLine).catch(() => {})
      }
    } catch (err) {
      setAiError(err.message || '분석 요청 중 오류가 발생했어요.')
    } finally {
      setAiLoading(false)
    }
  }, [apiKey, aiModel, memory, todayExercises, byPartToday, partTotals7, totalToday, selectedDate])

  const handleProgressionPlan = useCallback(async () => {
    setProgError('')

    // 1) 판정·목표 중량은 로컬 계산 — 즉시 표시, API 오류 불가능
    const local = computeProgression(history)
    setProgression(local)
    if (!local.length || !apiKey) return

    // 2) 코멘트만 선택적 AI 보강 — 실패해도 판정 결과는 유지
    setProgLoading(true)
    try {
      const lines = local.map((r) =>
        `- ${r.exercise_name}: ${r.current_kg}kg → ${r.target_kg}kg (${r.status}) / ${r.reason}`
      ).join('\n')

      const system = `너는 점진적 과부하 전문 피트니스 코치야.
아래는 앱이 규칙 기반으로 이미 확정한 운동별 중량 판정이야. 판정을 바꾸지 말고,
각 운동에 대해 사용자에게 실질적으로 도움이 되는 코칭 코멘트를 한국어 1문장으로 작성해.
(예: 보조 운동 추천, 자세 포인트, 호흡, 증량 시 주의점 등 — 판정 근거 반복 금지)

[확정된 판정]
${lines}`

      const { data } = await callGeminiJSON({
        apiKey, model: aiModel, system,
        schema: COMMENT_SCHEMA, maxOutputTokens: 2048,
      })
      const map = new Map((data?.comments ?? []).map((c) => [c.exercise_name, c.comment]))
      setProgression((prev) => (prev ?? []).map((r) =>
        map.get(r.exercise_name) ? { ...r, reason: `${r.reason} ${map.get(r.exercise_name)}` } : r
      ))
    } catch {
      // AI 코멘트 실패는 조용히 무시 — 로컬 판정이 이미 표시됨
    } finally {
      setProgLoading(false)
    }
  }, [apiKey, aiModel, history])

  return (
    <main className="page-content volume-page" role="main">

      {/* ── 섹션 1: 오늘의 볼륨 ── */}
      <section className="volume-section">
        <p className="volume-section-title">오늘의 볼륨</p>
        {hasWeightToday ? (
          <>
            <p className="vol-today-total">
              {fmtVolume(totalToday)}<span className="vol-today-unit"> kg</span>
            </p>
            <p className="vol-today-sub">{todayExercises.filter((e) => calcExerciseVolume(e, bodyWeight) != null).length}개 종목 집계</p>
            <div className="vol-part-chips">
              {Object.entries(byPartToday).map(([p, v]) => (
                <span key={p} className="vol-part-chip" style={{ '--chip-color': PART_COLORS[p] ?? 'var(--color-primary)' }}>
                  {p} {fmtVolume(v)}kg
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="vol-today-total" style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)' }}>
            {todayExercises.length > 0 ? '중량 미설정' : '운동 없음'}
          </p>
        )}

        <div className="vol-exercise-list">
          {todayExercises.map((ex, i) => {
            const vol = calcExerciseVolume(ex, bodyWeight)
            return (
              <div key={i} className="vol-exercise-row">
                <span className="vol-ex-name">{ex.exercise_name}</span>
                <span className="vol-ex-detail">
                  {ex.sets}×{ex.reps_or_duration}
                  {ex.weight_kg != null ? ` · ${ex.weight_kg}kg` : ''}
                </span>
                {vol != null && <span className="vol-ex-volume">{fmtVolume(vol)}kg</span>}
                {vol == null && !isCardio(ex) && ex.weight_kg == null && !isAssistExercise(ex) && (() => {
                  const rv = calcRepVolume(ex)
                  return rv != null ? <span className="vol-ex-volume" style={{ color: 'var(--color-text-muted)' }}>맨몸 {rv}회</span> : null
                })()}
              </div>
            )
          })}
        </div>

        {todayExercises.length > 0 && !hasWeightToday && (() => {
          const weightedCount = todayExercises.filter((e) => !isCardio(e)).length
          const bodyweightCount = todayExercises.filter((e) => !isCardio(e) && e.weight_kg == null).length
          if (weightedCount === 0) return null  // 모두 러닝
          if (bodyweightCount === weightedCount) {
            // 모두 맨몸 운동
            return <p className="vol-no-weight-hint">맨몸 운동은 kg 볼륨 대신 총 반복 횟수로 표시됩니다.</p>
          }
          // 일부 중량 미설정
          return <p className="vol-no-weight-hint">운동 탭에서 종목 편집 → 중량을 입력하면 볼륨이 자동 계산됩니다.</p>
        })()}
        {todayExercises.length === 0 && (
          <p className="vol-no-weight-hint">운동 탭에서 오늘의 운동을 추가하세요.</p>
        )}
      </section>

      {/* ── 섹션 2: 14일 볼륨 추이 ── */}
      <section className="volume-section">
        <p className="volume-section-title">14일 볼륨 추이</p>
        {histLoading ? (
          <div className="empty-state"><span className="spinner" /></div>
        ) : lineData.some((d) => d.y > 0) ? (
          <LineChart
            data={lineData}
            unit="kg"
            label=""
            color="var(--color-primary)"
            yMin={0}
          />
        ) : (
          <div className="vol-empty">중량이 설정된 운동 기록이 없습니다.</div>
        )}
      </section>

      {/* ── 섹션 3: 최근 7일 부위별 볼륨 ── */}
      <section className="volume-section">
        <p className="volume-section-title">최근 7일 부위별 볼륨</p>
        {histLoading ? (
          <div className="empty-state"><span className="spinner" /></div>
        ) : barData.length > 0 ? (
          <BarChart data={barData} unit="kg" />
        ) : (
          <div className="vol-empty">데이터가 없습니다.</div>
        )}
      </section>

      {/* ── 섹션 4+5 통합: AI 코치 ── */}
      <section className="volume-section">
        <div className="aic-panel">

          {/* 헤더 */}
          <div className="aic-header">
            <div className="aic-header-icon">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="aic-title">AI 코치</p>
              <p className="aic-subtitle">원하는 분석 모드를 선택하세요</p>
            </div>
          </div>

          {/* 모드 카드 */}
          <div className="aic-mode-grid">
            <button
              className={`aic-mode-card ${aiMode === 'volume' ? 'active' : ''}`}
              onClick={() => setAiMode('volume')}
            >
              <div className="aic-mode-icon"><Sparkles size={20} /></div>
              <p className="aic-mode-name">볼륨 분석</p>
              <p className="aic-mode-desc">오늘 운동 · 부위별 평가 · 추천</p>
              <span className="aic-mode-check"><Check size={11} strokeWidth={3} /></span>
            </button>
            <button
              className={`aic-mode-card ${aiMode === 'overload' ? 'active' : ''}`}
              onClick={() => setAiMode('overload')}
            >
              <div className="aic-mode-icon"><TrendingUp size={20} /></div>
              <p className="aic-mode-name">과부하 계획</p>
              <p className="aic-mode-desc">14일 기록 · 목표 중량 계산</p>
              <span className="aic-mode-check"><Check size={11} strokeWidth={3} /></span>
            </button>
          </div>

          {/* 컨텍스트 */}
          <div className="aic-context">
            <span className="aic-ctx-dot" />
            {aiMode === 'volume'
              ? todayExercises.length > 0
                ? `오늘 ${todayExercises.length}종목${hasWeightToday ? ` · 총 ${fmtVolume(totalToday)}kg` : ' · 중량 미설정'}`
                : '오늘 운동 기록 없음'
              : history.length > 0
                ? `${history.length}일 기록 분석 가능`
                : '운동 기록 없음 — 먼저 운동을 기록해 주세요'
            }
          </div>

          {/* 실행 버튼 */}
          <button
            className="btn btn-primary aic-run-btn"
            onClick={aiMode === 'volume' ? handleAiAnalysis : handleProgressionPlan}
            disabled={aiLoading || progLoading}
          >
            {(aiMode === 'volume' && aiLoading) || (aiMode === 'overload' && progLoading) ? (
              <><span className="spinner" style={{ width: 15, height: 15 }} /> 분석 중...</>
            ) : aiMode === 'volume' ? (
              <><Sparkles size={15} /> 볼륨 분석 시작하기</>
            ) : (
              <><TrendingUp size={15} /> 목표 중량 계산하기</>
            )}
          </button>

          {/* 키 없을 때 안내 (앱은 키 없이도 동작, AI 분석만 키 필요) */}
          {!apiKey && (
            <div style={{ marginTop: 12 }}>
              <ApiKeyNotice feature="AI 볼륨 분석" />
            </div>
          )}

          {/* 에러 */}
          {aiMode === 'volume' && aiError && (
            <p className="vol-ai-error">{aiError}</p>
          )}
          {aiMode === 'overload' && progError && (
            <p className="vol-ai-error">{progError}</p>
          )}

          {/* 볼륨 분석 결과 */}
          {aiMode === 'volume' && aiResponse && (
            <div className="aic-result animate-fadeInUp">
              <div className="aic-result-header">
                <span className="aic-result-label">
                  <Sparkles size={12} /> 볼륨 분석 결과
                </span>
                <button className="btn btn-ghost aic-result-rerun" onClick={handleAiAnalysis} disabled={aiLoading}>
                  <RefreshCw size={12} /> 다시 분석
                </button>
              </div>
              <div className="aic-result-body vol-ai-response">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* 과부하 계획 결과 */}
          {aiMode === 'overload' && progression && progression.length > 0 && (
            <div className="aic-result animate-fadeInUp">
              <div className="aic-result-header">
                <span className="aic-result-label">
                  <TrendingUp size={12} /> 과부하 계획
                </span>
                <button className="btn btn-ghost aic-result-rerun" onClick={handleProgressionPlan} disabled={progLoading}>
                  <RefreshCw size={12} /> 다시 계산
                </button>
              </div>
              <div className="aic-prog-list">
                {progression.map((r) => (
                  <div key={r.exercise_name} className="aic-prog-card" data-status={r.status}>
                    <div className="aic-prog-top">
                      <span className="aic-prog-name">{r.exercise_name}</span>
                      <span className={`aic-prog-badge aic-prog-badge--${r.status}`}>
                        {r.status === 'increase' ? '↑ 증량' : r.status === 'decrease' ? '↓ 감량' : r.status === 'new' ? '신규' : '= 유지'}
                      </span>
                    </div>
                    <div className="aic-prog-weight">
                      <span className="aic-prog-curr">{r.current_kg}kg</span>
                      <span className="aic-prog-arrow">→</span>
                      <span className="aic-prog-target">{r.target_kg}kg</span>
                    </div>
                    <p className="aic-prog-reason">{r.reason}</p>
                  </div>
                ))}
              </div>
              <div className="aic-result-footer">
                <button
                  className="btn btn-primary btn-full"
                  onClick={() => {
                    memory.applyProgressTargets(user.uid, progression)
                    setProgression(null)
                  }}
                >
                  <Check size={15} /> 목표 중량 저장
                </button>
              </div>
            </div>
          )}
          {aiMode === 'overload' && progression && progression.length === 0 && (
            <p className="vol-no-weight-hint">중량이 기록된 운동이 없어 계획을 수립할 수 없어요.</p>
          )}

        </div>
      </section>

    </main>
  )
}
