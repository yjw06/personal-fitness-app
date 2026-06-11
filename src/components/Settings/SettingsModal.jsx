import { useState, useEffect, useRef } from 'react'
import {
  X, Volume2, Vibrate, Bell, Sun, Sparkles, Eye, EyeOff,
  Brain, Upload, Save, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useMemoryStore, estimateTokens } from '../../stores/memoryStore'
import { useAIStore } from '../../stores/aiStore'
import { useAuth } from '../../hooks/useAuth'
import { requestNotifyPermission } from '../../services/restAlert'
import { AVAILABLE_MODELS } from '../../services/aiCoach'
import { toast } from '../../stores/toastStore'
import './SettingsModal.css'

export default function SettingsModal({ open, onClose }) {
  const { user } = useAuth()
  const settings = useSettingsStore()
  const memory = useMemoryStore()
  const clearChat = useAIStore((s) => s.clearChat)

  // 로컬 입력 버퍼 (저장 시 commit)
  const [keyInput, setKeyInput]                 = useState('')
  const [profileInput, setProfileInput]         = useState('')
  const [workoutPlanInput, setWorkoutPlanInput] = useState('')
  const [mealPlanInput, setMealPlanInput]       = useState('')
  const [personaInput, setPersonaInput]         = useState('')
  const [showKey, setShowKey] = useState(false)
  const [planExpanded, setPlanExpanded] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)

  // memory store 데이터가 로드되면 input에 반영
  useEffect(() => {
    if (open && memory.isLoaded) {
      setKeyInput(memory.apiKey)
      setProfileInput(memory.profile)
      setWorkoutPlanInput(memory.workoutPlan)
      setMealPlanInput(memory.mealPlan)
      setPersonaInput(memory.coachPersona)
    }
  }, [open, memory.isLoaded, memory.apiKey, memory.profile, memory.workoutPlan, memory.mealPlan, memory.coachPersona])

  // 모달 열릴 때 memory 로드
  useEffect(() => {
    if (open && user && !memory.isLoaded) {
      memory.load(user.uid)
    }
  }, [open, user])

  if (!open) return null

  const handleNotifyToggle = async () => {
    if (!settings.notifyEnabled) {
      const result = await requestNotifyPermission()
      if (result === 'granted') {
        settings.update({ notifyEnabled: true })
        toast.success('시스템 알림이 활성화되었습니다.')
      } else if (result === 'denied') {
        toast.error('알림이 차단되어 있습니다. 브라우저 설정에서 허용해 주세요.')
      } else if (result === 'unsupported') {
        toast.warning('이 브라우저는 알림을 지원하지 않습니다.')
      }
    } else {
      settings.update({ notifyEnabled: false })
    }
  }

  const handleSaveKey = async () => {
    if (!user) { toast.error('로그인이 필요합니다.'); return }
    try {
      await memory.save(user.uid, { apiKey: keyInput.trim() })
      toast.success(keyInput.trim() ? 'API 키가 저장되었습니다.' : 'API 키를 삭제했습니다.')
    } catch (err) {
      toast.error(`저장 실패: ${err.message}`)
    }
  }

  const handleSaveMemory = async () => {
    if (!user) { toast.error('로그인이 필요합니다.'); return }
    try {
      await memory.save(user.uid, {
        profile: profileInput,
        workoutPlan: workoutPlanInput,
        mealPlan: mealPlanInput,
        coachPersona: personaInput,
      })
      toast.success('마스터플랜이 저장되었습니다.')
    } catch (err) {
      toast.error(`저장 실패: ${err.message}`)
    }
  }

  const handleUploadMd = async (e, setter) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setter(text)
      toast.info(`${file.name} 불러옴 (저장 버튼 눌러야 적용)`)
    } catch {
      toast.error('파일을 읽지 못했습니다.')
    } finally {
      e.target.value = ''
    }
  }

  const handleClearMemory = async () => {
    if (!user) return
    if (!confirm('마스터플랜과 AI 메모를 모두 삭제할까요?')) return
    try {
      await memory.clearAllMemory(user.uid)
      setProfileInput('')
      setWorkoutPlanInput('')
      setMealPlanInput('')
      setPersonaInput('')
      toast.success('메모리를 초기화했습니다.')
    } catch (err) {
      toast.error(`초기화 실패: ${err.message}`)
    }
  }

  const handleRemoveNote = async (idx) => {
    if (!user) return
    await memory.removeAiNote(user.uid, idx)
  }

  // 토큰 카운트 (대략)
  const totalTokens =
    estimateTokens(profileInput) +
    estimateTokens(workoutPlanInput) +
    estimateTokens(mealPlanInput) +
    estimateTokens(personaInput) +
    estimateTokens(memory.aiNotes.map((n) => `${n.key}:${n.value}`).join('\n'))

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="설정">
      <div className="settings-modal animate-fadeInUp">
        <header className="set-header">
          <h2>⚙️ 설정</h2>
          <button className="btn-icon" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </header>

        {/* ─── UI 테마 버전 ─── */}
        <p className="set-section-label">UI 테마</p>
        <div className="set-ui-toggle" role="radiogroup" aria-label="UI 테마 버전">
          {[
            { id: 'v1', name: 'ver.1', desc: '네온 라임 클래식' },
            { id: 'v2', name: 'ver.2', desc: '인프라레드' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={settings.uiVersion === t.id}
              className={`set-ui-option ${t.id}${settings.uiVersion === t.id ? ' active' : ''}`}
              onClick={() => settings.update({ uiVersion: t.id })}
            >
              <span className={`set-ui-swatch ${t.id}`} aria-hidden="true" />
              <span className="set-ui-name">{t.name}</span>
              <span className="set-ui-desc">{t.desc}</span>
            </button>
          ))}
        </div>

        {/* ─── AI 코치 API 키 ─── */}
        <p className="set-section-label">
          <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} /> AI 코치 (Gemini)
        </p>

        <div className="set-key-row">
          <label className="set-key-label">
            <span>Gemini API 키</span>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="set-key-link"
            >
              발급받기 →
            </a>
          </label>
          <div className="set-key-input-row">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="AIza..."
              className="set-key-input"
              autoComplete="off"
              spellCheck="false"
            />
            <button
              type="button"
              className="btn-icon"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? '키 숨기기' : '키 보기'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="set-key-actions">
            <button className="btn btn-primary set-key-save" onClick={handleSaveKey}>
              <Save size={14} /> API 키 저장
            </button>
            {memory.apiKey && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (confirm('AI 대화 기록을 모두 삭제할까요?')) {
                    clearChat(user?.uid)
                    toast.success('대화를 초기화했습니다.')
                  }
                }}
              >
                대화 초기화
              </button>
            )}
          </div>
          <p className="set-key-hint">
            🔒 키는 Firebase에 본인 계정으로만 안전하게 저장됩니다.
          </p>

          {/* 모델 선택 */}
          <div className="set-model-row">
            <label className="set-key-label" htmlFor="ai-model-select">
              <span>AI 모델</span>
            </label>
            <select
              id="ai-model-select"
              className="set-model-select"
              value={settings.aiModel}
              onChange={(e) => settings.update({ aiModel: e.target.value })}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <p className="set-key-hint">
              💡 "high demand" 오류가 잦으면 Flash 또는 Flash Lite 선택. 혼잡 시 자동으로 가벼운 모델로 폴백됩니다.
            </p>
          </div>
        </div>

        {/* ─── 마스터플랜 메모리 ─── */}
        <button
          type="button"
          className="set-plan-toggle"
          onClick={() => setPlanExpanded(!planExpanded)}
        >
          <Brain size={14} />
          <span>마스터플랜 메모리 ({totalTokens.toLocaleString()} 토큰)</span>
          {planExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {planExpanded && (
          <div className="set-plan-section animate-fadeIn">
            <p className="set-plan-desc">
              여기에 저장한 내용은 <strong>모든 AI 코치 대화에 자동 포함</strong>됩니다.
              .md/.txt 파일을 통째로 불러올 수 있어요.
            </p>

            <PlanTextArea
              label="사용자 프로필"
              hint="나이, 키, 체중, 목표 등"
              value={profileInput}
              onChange={setProfileInput}
              onUpload={(e) => handleUploadMd(e, setProfileInput)}
            />

            <PlanTextArea
              label="기본 운동 가이드"
              hint="나만의 주간 운동 루틴이나 분할법 등"
              value={workoutPlanInput}
              onChange={setWorkoutPlanInput}
              onUpload={(e) => handleUploadMd(e, setWorkoutPlanInput)}
              rows={6}
            />

            <PlanTextArea
              label="기본 식단 가이드"
              hint="목표 칼로리나 요일별 식단표 등"
              value={mealPlanInput}
              onChange={setMealPlanInput}
              onUpload={(e) => handleUploadMd(e, setMealPlanInput)}
              rows={6}
            />

            <PlanTextArea
              label="코치 페르소나 (추가 지시)"
              hint='"엘리트 코치 톤으로", "친근하지만 단호하게" 등'
              value={personaInput}
              onChange={setPersonaInput}
              onUpload={(e) => handleUploadMd(e, setPersonaInput)}
              rows={3}
            />

            <div className="set-plan-actions">
              <button className="btn btn-primary" onClick={handleSaveMemory}>
                <Save size={14} /> 마스터플랜 저장
              </button>
              <button className="btn btn-danger" onClick={handleClearMemory}>
                <Trash2 size={14} /> 전체 초기화
              </button>
            </div>
          </div>
        )}

        {/* ─── AI 자체 메모 ─── */}
        {memory.aiNotes.length > 0 && (
          <>
            <button
              type="button"
              className="set-plan-toggle"
              onClick={() => setNotesExpanded(!notesExpanded)}
            >
              <Brain size={14} />
              <span>AI가 기억한 정보 ({memory.aiNotes.length}건)</span>
              {notesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {notesExpanded && (
              <div className="set-notes-section animate-fadeIn">
                {memory.aiNotes.slice().reverse().map((note, i) => {
                  const realIdx = memory.aiNotes.length - 1 - i
                  const date = note.ts ? new Date(note.ts).toLocaleDateString('ko-KR') : ''
                  return (
                    <div key={realIdx} className="set-note-item">
                      <div className="set-note-text">
                        <span className="set-note-key">{note.key}</span>
                        <span className="set-note-value">{note.value}</span>
                        {date && <span className="set-note-date">{date}</span>}
                      </div>
                      <button
                        className="btn-icon set-note-del"
                        onClick={() => handleRemoveNote(realIdx)}
                        aria-label="메모 삭제"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ─── 휴식 알림 ─── */}
        <p className="set-section-label" style={{ marginTop: 'var(--space-md)' }}>휴식 종료 알림</p>

        <ToggleRow
          icon={<Volume2 size={18} />}
          label="알림음"
          desc="휴식 종료 시 소리로 알림"
          checked={settings.soundEnabled}
          onChange={(v) => settings.update({ soundEnabled: v })}
        />

        <ToggleRow
          icon={<Vibrate size={18} />}
          label="진동"
          desc="모바일 기기에서 진동"
          checked={settings.vibrateEnabled}
          onChange={(v) => settings.update({ vibrateEnabled: v })}
        />

        <ToggleRow
          icon={<Bell size={18} />}
          label="시스템 알림"
          desc="다른 탭에 있어도 알림 (권한 필요)"
          checked={settings.notifyEnabled}
          onChange={handleNotifyToggle}
        />

        <ToggleRow
          icon={<Sun size={18} />}
          label="화면 켜둠"
          desc="휴식 중 화면 꺼짐 방지"
          checked={settings.wakeLockEnabled}
          onChange={(v) => settings.update({ wakeLockEnabled: v })}
        />

        <ToggleRow
          icon="🔁"
          label="알림 반복"
          desc="응답할 때까지 5초마다 반복"
          checked={settings.repeatAlert}
          onChange={(v) => settings.update({ repeatAlert: v })}
        />

        <div className="set-volume-row">
          <label className="set-volume-label">
            <span>🔊 음량</span>
            <span className="set-volume-val">{Math.round(settings.volume * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={(e) => settings.update({ volume: parseFloat(e.target.value) })}
            className="set-volume-slider"
            aria-label="알림 음량"
          />
        </div>

        <button className="btn btn-ghost btn-full" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

function PlanTextArea({ label, hint, value, onChange, onUpload, rows = 4 }) {
  const inputRef = useRef(null)
  return (
    <div className="set-plan-field">
      <div className="set-plan-field-header">
        <span className="set-plan-field-label">{label}</span>
        <label className="set-plan-upload-btn" title="파일 불러오기">
          <Upload size={12} />
          <input
            ref={inputRef}
            type="file"
            accept=".md,.txt"
            onChange={onUpload}
            hidden
          />
        </label>
      </div>
      <textarea
        className="set-plan-textarea"
        rows={rows}
        placeholder={hint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck="false"
      />
      {value && (
        <span className="set-plan-token-count">
          {estimateTokens(value).toLocaleString()} 토큰 · {value.length.toLocaleString()} 글자
        </span>
      )}
    </div>
  )
}

function ToggleRow({ icon, label, desc, checked, onChange }) {
  return (
    <label className="toggle-row">
      <span className="toggle-icon">{icon}</span>
      <div className="toggle-text">
        <span className="toggle-label">{label}</span>
        <span className="toggle-desc">{desc}</span>
      </div>
      <span className={`toggle-switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <span className="toggle-knob" />
      </span>
    </label>
  )
}
