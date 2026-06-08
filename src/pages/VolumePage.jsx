import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../hooks/useAuth'
import { useWorkoutStore } from '../stores/workoutStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useMemoryStore } from '../stores/memoryStore'
import { fetchVolumeHistory } from '../services/csvService'
import { callGeminiChat } from '../services/aiCoach'
import {
  aggregateVolumeByPart, totalVolume,
  calcExerciseVolume, fmtVolume,
} from '../utils/volumeUtils'
import LineChart from '../components/Chart/LineChart'
import BarChart  from '../components/Chart/BarChart'
import { Sparkles } from 'lucide-react'
import './VolumePage.css'

const PART_COLORS = {
  '가슴': '#6366f1', '등': '#22d3ee', '하체': '#10b981',
  '어깨': '#f59e0b', '팔': '#f97316', '코어': '#ec4899', '러닝': '#a78bfa',
}

export default function VolumePage() {
  const { user } = useAuth()
  const workoutData  = useWorkoutStore((s) => s.workoutData)
  const selectedDate = useWorkoutStore((s) => s.selectedDate)
  const apiKey  = useSettingsStore((s) => s.apiKey)
  const aiModel = useSettingsStore((s) => s.aiModel)
  const memory  = useMemoryStore()

  const [history, setHistory]         = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [aiResponse, setAiResponse]   = useState('')
  const [aiLoading, setAiLoading]     = useState(false)
  const [aiError, setAiError]         = useState('')

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
  const byPartToday    = aggregateVolumeByPart(todayExercises)
  const totalToday     = totalVolume(todayExercises)
  const hasWeightToday = totalToday > 0

  // ─── 14일 라인 차트 데이터 ───────────────────────────────────
  const lineData = history.map(({ date, rows }) => ({
    x: `${date.slice(4, 6)}/${date.slice(6, 8)}`,
    y: totalVolume(rows),
  }))

  // ─── 최근 7일 부위별 막대 차트 데이터 ───────────────────────
  const last7 = history.slice(-7)
  const partTotals7 = {}
  for (const { rows } of last7) {
    const bp = aggregateVolumeByPart(rows)
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
          const vol  = calcExerciseVolume(ex)
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
            <p className="vol-today-sub">{todayExercises.filter((e) => calcExerciseVolume(e) != null).length}개 종목 집계</p>
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
            const vol = calcExerciseVolume(ex)
            return (
              <div key={i} className="vol-exercise-row">
                <span className="vol-ex-name">{ex.exercise_name}</span>
                <span className="vol-ex-detail">
                  {ex.sets}×{ex.reps_or_duration}
                  {ex.weight_kg != null ? ` · ${ex.weight_kg}kg` : ''}
                </span>
                {vol != null && (
                  <span className="vol-ex-volume">{fmtVolume(vol)}kg</span>
                )}
              </div>
            )
          })}
        </div>

        {todayExercises.length > 0 && !hasWeightToday && (
          <p className="vol-no-weight-hint">
            운동 탭에서 종목 편집 → 중량을 입력하면 볼륨이 자동 계산됩니다.
          </p>
        )}
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

      {/* ── 섹션 4: AI 볼륨 코치 ── */}
      <section className="volume-section">
        <p className="volume-section-title">AI 볼륨 코치</p>
        <button
          className="btn btn-primary vol-ai-btn"
          onClick={handleAiAnalysis}
          disabled={aiLoading}
        >
          {aiLoading
            ? <><span className="spinner" style={{ width: 14, height: 14 }} /> 분석 중...</>
            : <><Sparkles size={14} /> AI에게 볼륨 분석 요청</>}
        </button>
        {aiError && <p className="vol-ai-error">{aiError}</p>}
        {aiResponse && (
          <div className="vol-ai-response">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
          </div>
        )}
      </section>

    </main>
  )
}
