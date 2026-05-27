import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMemoryStore } from '../stores/memoryStore'
import { useWorkoutStore } from '../stores/workoutStore'
import { toast } from '../stores/toastStore'
import {
  buildPrompt, extractCSVs, parseCSVRows,
} from '../services/promptBuilder'
import {
  saveWorkoutData, saveMealData, saveScheduleData,
} from '../services/csvService'
import { parseAndValidate } from '../services/csvSchema'
import {
  Copy, Check, ExternalLink, Save, ArrowLeft,
  Dumbbell, Apple, CalendarDays, Sparkles, ClipboardPaste,
} from 'lucide-react'
import './AssistantPage.css'

const TASKS = [
  { id: 'all',      icon: '🎯', title: '오늘 통째로',  desc: '운동 + 식단 + 스케줄을 한꺼번에' },
  { id: 'workout',  icon: '🏋️', title: '운동 루틴',    desc: '오늘의 운동만' },
  { id: 'meal',     icon: '🥗', title: '식단',         desc: '오늘의 식단만' },
  { id: 'schedule', icon: '📅', title: '하루 스케줄',  desc: '오늘의 타임라인만' },
]

const EXTERNAL_AIS = [
  { id: 'chatgpt', label: 'ChatGPT', emoji: '💬', url: 'https://chatgpt.com/',         color: '#10a37f' },
  { id: 'claude',  label: 'Claude',  emoji: '🧠', url: 'https://claude.ai/new',         color: '#cc785c' },
  { id: 'gemini',  label: 'Gemini',  emoji: '✨', url: 'https://gemini.google.com/app', color: '#4285f4' },
]

function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
}

export default function AssistantPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const selectedDate = useWorkoutStore((s) => s.selectedDate)
  const memory = useMemoryStore()
  const { load: loadMemory, isLoaded } = memory

  const [task, setTask]         = useState(null)       // 'workout' | 'meal' | 'schedule' | 'all'
  const [prompt, setPrompt]     = useState('')
  const [extraNotes, setExtraNotes] = useState('')     // 사용자가 직접 적는 오늘 특이사항
  const [copied, setCopied]     = useState(false)
  const [aiOutput, setAiOutput] = useState('')
  const [saving, setSaving]     = useState(false)

  // 사용자 메모리 로드
  useEffect(() => {
    if (user && !isLoaded) loadMemory(user.uid)
  }, [user, isLoaded, loadMemory])

  // 작업 선택 또는 특이사항 변경 시 프롬프트 다시 생성
  useEffect(() => {
    if (!task) { setPrompt(''); return }
    const memData = {
      profile: memory.profile,
      workoutPlan: memory.workoutPlan,
      mealPlan: memory.mealPlan,
      coachPersona: memory.coachPersona,
      aiNotes: memory.aiNotes,
    }
    setPrompt(buildPrompt(task, memData, extraNotes))
    setCopied(false)
  }, [task, extraNotes,
      memory.profile, memory.workoutPlan, memory.mealPlan, memory.coachPersona, memory.aiNotes])

  // 작업 바뀔 때 입력 필드 리셋
  useEffect(() => {
    setExtraNotes('')
    setAiOutput('')
  }, [task])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      toast.success('프롬프트를 복사했어요! 이제 AI에게 붙여넣으세요.')
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error('자동 복사 실패 — 직접 텍스트 박스에서 복사해주세요.')
    }
  }, [prompt])

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        toast.warning('클립보드가 비어있어요.')
        return
      }
      setAiOutput(text)
      toast.success('클립보드에서 가져왔어요. 저장 버튼을 눌러주세요.')
    } catch {
      toast.error('자동 붙여넣기 실패 — 텍스트 박스에 직접 붙여넣어 주세요.')
    }
  }

  const handleSave = useCallback(async () => {
    if (!user) { toast.error('로그인이 필요합니다.'); return }
    if (!aiOutput.trim()) { toast.warning('AI가 준 답변을 먼저 붙여넣어 주세요.'); return }

    setSaving(true)
    try {
      const csvs = extractCSVs(aiOutput)
      const today = todayYmd()
      const results = []

      // task에 따라 어떤 CSV를 저장할지 결정
      const targets = task === 'all'
        ? ['workout', 'meal', 'schedule']
        : [task]

      for (const kind of targets) {
        const csv = csvs[kind]
        if (!csv) {
          results.push({ kind, ok: false, error: `${labelOf(kind)} CSV를 찾지 못했어요.` })
          continue
        }
        // 스키마 검증
        const validated = parseAndValidate(csv, kind)
        if (!validated.ok) {
          results.push({ kind, ok: false, error: validated.error })
          continue
        }
        // 저장
        try {
          const rows = validated.rows
          if (kind === 'workout')  await saveWorkoutData(user.uid, today, rows)
          if (kind === 'meal')     await saveMealData(user.uid, today, rows)
          if (kind === 'schedule') await saveScheduleData(user.uid, today, rows)
          results.push({ kind, ok: true, count: rows.length })
        } catch (e) {
          results.push({ kind, ok: false, error: e.message || '저장 실패' })
        }
      }

      // 결과 요약 토스트
      const ok = results.filter((r) => r.ok)
      const fail = results.filter((r) => !r.ok)

      if (ok.length > 0) {
        ok.forEach((r) => toast.success(`✅ ${labelOf(r.kind)} ${r.count}개 저장됨`))
      }
      if (fail.length > 0) {
        fail.forEach((r) => toast.error(`✕ ${labelOf(r.kind)}: ${r.error}`))
      }

      if (ok.length > 0 && fail.length === 0) {
        // 전체 성공 — 해당 페이지로 이동
        setAiOutput('')
        const goto = task === 'all' ? '/schedule' :
                     task === 'workout' ? '/workout' :
                     task === 'meal' ? '/meal' : '/schedule'
        setTimeout(() => navigate(goto), 800)
      }
    } catch (err) {
      toast.error(`저장 중 오류: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }, [user, aiOutput, task, navigate])

  // ─── 단계 0: 작업 선택 ──────────────────────────────────
  if (!task) {
    return (
      <main className="page-content assistant-page" role="main">
        <header className="assist-header animate-fadeInUp">
          <h2><Sparkles size={18} /> AI 도우미</h2>
          <p>무료 AI (ChatGPT, Claude, Gemini)를 활용해서<br/>오늘의 운동·식단·스케줄을 만들어 보세요.</p>
        </header>

        <p className="assist-section-label">무엇을 만들까요?</p>

        <div className="task-grid">
          {TASKS.map((t) => (
            <button
              key={t.id}
              className={`task-card ${t.id === 'all' ? 'task-card-primary' : ''}`}
              onClick={() => setTask(t.id)}
            >
              <span className="task-icon">{t.icon}</span>
              <div className="task-body">
                <span className="task-title">{t.title}</span>
                <span className="task-desc">{t.desc}</span>
              </div>
            </button>
          ))}
        </div>

        {!hasAnyPlan(memory) && (
          <div className="assist-hint card animate-fadeInUp">
            <p><strong>💡 더 좋은 결과를 위해</strong></p>
            <p>설정 ⚙️ → 마스터플랜 메모리에 본인의 주간 운동·식단 가이드를 등록하면, AI가 그걸 참고해서 더 정확한 답변을 만들어줘요.</p>
          </div>
        )}
      </main>
    )
  }

  // ─── 단계 1 ~ 3: 마법사 ──────────────────────────────────
  const taskInfo = TASKS.find((t) => t.id === task)

  return (
    <main className="page-content assistant-page" role="main">
      <header className="assist-header animate-fadeInUp">
        <button className="assist-back" onClick={() => setTask(null)} aria-label="뒤로">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2>{taskInfo.icon} {taskInfo.title} 만들기</h2>
          <p className="assist-sub">{taskInfo.desc}</p>
        </div>
      </header>

      {/* STEP 1 */}
      <section className="assist-step card animate-fadeInUp">
        <h3 className="assist-step-title"><span className="step-num">1</span> 프롬프트 복사하기</h3>
        <p className="assist-step-desc">
          아래 텍스트를 통째로 복사한 다음, AI(ChatGPT/Claude/Gemini)에 붙여넣으세요.
        </p>

        {/* 사용자 직접 입력 — 오늘 특이사항 (선택) */}
        <div className="assist-extra-notes">
          <label className="assist-extra-label" htmlFor="assist-extra-input">
            <span>⭐ 오늘만의 특이사항 (선택)</span>
            <span className="assist-extra-hint">아래 프롬프트에 자동 반영돼요</span>
          </label>
          <textarea
            id="assist-extra-input"
            className="assist-extra-input"
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder={'예: "오늘 컨디션 안 좋아 강도 낮춰줘"\n예: "어제 점심에 라면 먹어서 오늘 단백질 더"\n예: "왼쪽 어깨 시큰 — 프레스 종목 빼고"'}
            rows={3}
            spellCheck="false"
          />
        </div>

        <textarea
          className="assist-prompt-box"
          value={prompt}
          readOnly
          rows={8}
          spellCheck="false"
        />
        <button
          className={`btn ${copied ? 'btn-success-state' : 'btn-primary'} btn-full assist-big-btn`}
          onClick={handleCopy}
        >
          {copied ? <><Check size={18} /> 복사됨!</> : <><Copy size={18} /> 클립보드에 복사하기</>}
        </button>
      </section>

      {/* STEP 2 */}
      <section className="assist-step card animate-fadeInUp">
        <h3 className="assist-step-title"><span className="step-num">2</span> AI 사이트 열기</h3>
        <p className="assist-step-desc">
          아래 중 마음에 드는 AI를 새 탭에서 열고, 채팅창에 <strong>방금 복사한 프롬프트를 붙여넣기</strong>한 다음 보내세요.
        </p>
        <div className="ai-link-grid">
          {EXTERNAL_AIS.map((ai) => (
            <a
              key={ai.id}
              href={ai.url}
              target="_blank"
              rel="noreferrer"
              className="ai-link-card"
              style={{ '--ai-color': ai.color }}
            >
              <span className="ai-link-emoji">{ai.emoji}</span>
              <span className="ai-link-label">{ai.label}</span>
              <ExternalLink size={14} className="ai-link-icon" />
            </a>
          ))}
        </div>
        <p className="assist-tip">
          💡 무료로 다 쓸 수 있어요. AI는 답변을 CSV 표 형식으로 만들어줄 거예요.
        </p>
      </section>

      {/* STEP 3 */}
      <section className="assist-step card animate-fadeInUp">
        <h3 className="assist-step-title"><span className="step-num">3</span> AI 답변을 여기에 붙여넣기</h3>
        <p className="assist-step-desc">
          AI가 준 답변 <strong>전체를 통째로</strong> 복사해서 아래에 붙여넣으세요. 앱이 알아서 분석해 저장합니다.
        </p>
        <div className="assist-paste-actions">
          <button className="btn btn-ghost" onClick={handlePasteFromClipboard}>
            <ClipboardPaste size={14} /> 클립보드에서 가져오기
          </button>
        </div>
        <textarea
          className="assist-output-box"
          value={aiOutput}
          onChange={(e) => setAiOutput(e.target.value)}
          rows={10}
          placeholder="AI가 보내준 답변 전체를 여기에 붙여넣으세요…"
          spellCheck="false"
        />
        <button
          className="btn btn-primary btn-full assist-big-btn"
          onClick={handleSave}
          disabled={saving || !aiOutput.trim()}
        >
          {saving
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> 저장 중…</>
            : <><Save size={18} /> 저장하기</>
          }
        </button>
      </section>

      {/* 도움말 */}
      <details className="assist-help card">
        <summary>잘 안 될 때 살펴보기</summary>
        <ul>
          <li>AI 답변에 <code>```csv … ```</code> 코드 블록이 없으면 다시 "CSV 형식으로 답해줘" 라고 요청해 보세요.</li>
          <li>"오늘 통째로" 모드는 답변에 3개의 코드 블록(운동/식단/스케줄)이 모두 있어야 합니다.</li>
          <li>저장이 실패한 항목만 콕 집어서 알려드려요. 한 번 더 시도하거나, 해당 항목만 따로 만들어 보세요.</li>
        </ul>
      </details>
    </main>
  )
}

function labelOf(kind) {
  return ({ workout: '운동', meal: '식단', schedule: '스케줄' })[kind] || kind
}

function hasAnyPlan(memory) {
  return !!(memory.profile || memory.workoutPlan || memory.mealPlan)
}
