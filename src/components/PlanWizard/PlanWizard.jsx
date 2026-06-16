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
