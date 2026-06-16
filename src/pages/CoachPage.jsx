import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../hooks/useAuth'
import { useAIStore } from '../stores/aiStore'
import { useMemoryStore } from '../stores/memoryStore'
import { useWorkoutStore } from '../stores/workoutStore'
import { useSettingsStore } from '../stores/settingsStore'
import { toast } from '../stores/toastStore'
import {
  callGeminiJSON, callGeminiChat, todayYmd,
  compressConversation, COMPRESS_AT,
} from '../services/aiCoach'
import { persistByKind, executeChatTool } from '../services/aiTools'
import { getJobConfig, kindLabel } from '../services/aiSchemas'
import {
  COMMANDS, parseCommand, searchCommands, buildHelpMessage,
} from '../services/aiCommands'
import { Send, Trash2, Sparkles, AlertCircle, Brain, RefreshCw, ExternalLink, Wrench } from 'lucide-react'
import PlanWizard from '../components/PlanWizard/PlanWizard'
import './CoachPage.css'

export default function CoachPage() {
  const { user } = useAuth()
  const setUid = useWorkoutStore((s) => s.setUid)
  const aiModel = useSettingsStore((s) => s.aiModel)

  // AI store (채팅 — localStorage)
  const {
    messages, rawContents, summaryContext, isLoading,
    loadForUser, addMessage, updateLastMessage,
    setRawContents, setSummaryContext, setLoading, setError, clearChat,
  } = useAIStore()

  // Memory store (Firestore)
  const memory = useMemoryStore()
  const {
    apiKey, profile, workoutPlan, mealPlan, coachPersona, aiNotes,
    isLoaded,
    load: loadMemory, loadAutoSummary,
  } = memory

  const [input, setInput] = useState('')
  const [extraNotes, setExtraNotes] = useState('')   // 오늘만의 특이사항 (빈 채팅 화면 textarea)
  const [cmdMenuOpen, setCmdMenuOpen] = useState(false)
  const [cmdMenuIdx, setCmdMenuIdx]   = useState(0)
  const [wizardOpen, setWizardOpen] = useState(false)
  const scrollRef = useRef(null)
  const inputRef  = useRef(null)

  const parsed = parseCommand(input)
  const cmdMatches = parsed.isCommand ? searchCommands(parsed.query) : []

  useEffect(() => {
    if (!user) return
    setUid(user.uid)
    loadForUser(user.uid)
    loadMemory(user.uid)
    loadAutoSummary(user.uid)
  }, [user, setUid, loadForUser, loadMemory, loadAutoSummary])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const hasMemory = !!(profile || workoutPlan || mealPlan || coachPersona)
  const memoryItems = []
  if (profile)      memoryItems.push('프로필')
  if (workoutPlan)  memoryItems.push('운동플랜')
  if (mealPlan)     memoryItems.push('식단플랜')
  if (coachPersona) memoryItems.push('페르소나')
  if (aiNotes.length) memoryItems.push(`AI메모 ${aiNotes.length}건`)

  // 최신 memory snapshot
  const getMemSnapshot = () => {
    const m = useMemoryStore.getState()
    return {
      profile: m.profile,
      workoutPlan: m.workoutPlan,
      mealPlan: m.mealPlan,
      coachPersona: m.coachPersona,
      aiNotes: m.aiNotes,
      progressTargets: m.progressTargets,
    }
  }
  const getSummarySnapshot = () => {
    const m = useMemoryStore.getState()
    return {
      recentBody: m.recentBody,
      recentWorkouts: m.recentWorkouts,
    }
  }

  // ─── JSON 모드: 단일 작업 호출 ────────────────────────────
  // 사용자 메시지에 운동/식단/스케줄 칩 1개 추가 + 호출 + 저장
  const runJsonJob = useCallback(async (kind, notes = '') => {
    const date = todayYmd()
    const { schema, buildPrompt } = getJobConfig(kind)
    const system = buildPrompt(getMemSnapshot(), getSummarySnapshot(), notes)

    // 진행 칩 "running"
    updateLastMessage(user.uid, {
      pending: true,
      toolCalls: [{ kind, status: 'running' }],
    })

    try {
      const { data, truncated } = await callGeminiJSON({
        apiKey, model: aiModel, system, schema,
        onModelSwitch: (from, to) => {
          toast.warning(`${from.replace('gemini-2.5-', '')} → ${to.replace('gemini-2.5-', '')} 자동 전환`)
        },
      })
      const result = await persistByKind(kind, user.uid, date, data)
      updateLastMessage(user.uid, {
        pending: false,
        toolCalls: [{ kind, status: 'success', summary: result.summary }],
      })
      toast.success(`✓ ${result.summary}`)
      if (truncated) toast.warning(`${kindLabel(kind)} 응답이 잘려 일부만 저장됐어요. Pro 모델 사용을 권장해요.`)
      return { ok: true, summary: result.summary }
    } catch (err) {
      const msg = err.message || String(err)
      updateLastMessage(user.uid, {
        pending: false,
        toolCalls: [{ kind, status: 'error', summary: msg }],
      })
      toast.error(`${kindLabel(kind)} 실패: ${msg}`)
      return { ok: false, error: msg }
    }
  }, [apiKey, aiModel, user, updateLastMessage])

  // ─── JSON-multi 모드: 여러 작업 순차 호출 ─────────────────
  const runJsonMulti = useCallback(async (kinds, notes = '') => {
    const date = todayYmd()
    const results = []

    // 칩 초기 상태 (모두 pending)
    const initialChips = kinds.map((k) => ({ kind: k, status: 'pending' }))
    updateLastMessage(user.uid, { pending: true, toolCalls: initialChips, text: '' })

    for (let i = 0; i < kinds.length; i++) {
      const kind = kinds[i]
      const { schema, buildPrompt } = getJobConfig(kind)
      const system = buildPrompt(getMemSnapshot(), getSummarySnapshot(), notes)

      // 현재 작업 running으로 갱신
      const chipsRunning = kinds.map((k, idx) => ({
        kind: k,
        status: idx < i ? results[idx]?.ok ? 'success' : 'error'
              : idx === i ? 'running'
              : 'pending',
        summary: idx < i ? (results[idx]?.summary || results[idx]?.error) : undefined,
      }))
      updateLastMessage(user.uid, { pending: true, toolCalls: chipsRunning })

      try {
        const { data, truncated } = await callGeminiJSON({
          apiKey, model: aiModel, system, schema,
          onModelSwitch: (from, to) => {
            toast.warning(`${from.replace('gemini-2.5-', '')} → ${to.replace('gemini-2.5-', '')} 자동 전환`)
          },
        })
        const result = await persistByKind(kind, user.uid, date, data)
        results.push({ ok: true, summary: result.summary })
        toast.success(`✓ ${result.summary}`)
        if (truncated) toast.warning(`${kindLabel(kind)} 응답이 일부 잘렸어요. Pro 모델 권장.`)
      } catch (err) {
        const msg = err.message || String(err)
        results.push({ ok: false, error: msg })
        toast.error(`${kindLabel(kind)} 실패: ${msg}`)
      }
    }

    // 최종 칩 + 메시지
    const finalChips = kinds.map((k, idx) => ({
      kind: k,
      status: results[idx]?.ok ? 'success' : 'error',
      summary: results[idx]?.summary || results[idx]?.error,
    }))
    const okCount = results.filter((r) => r.ok).length
    const finalText = okCount === kinds.length
      ? `✅ 오늘의 계획 ${okCount}개를 모두 저장했어요!`
      : okCount > 0
        ? `⚠️ ${okCount}/${kinds.length}개 저장됨. 실패한 항목은 다시 시도해 주세요.`
        : `❌ 모두 실패했어요. API 키나 네트워크를 확인해 주세요.`

    updateLastMessage(user.uid, {
      pending: false,
      toolCalls: finalChips,
      text: finalText,
    })
  }, [apiKey, aiModel, user, updateLastMessage])

  // ─── Chat 모드: 자유 대화 (save_to_memory 도구만) ─────────
  const runChat = useCallback(async (userText, aiPromptOverride, notes = '') => {
    let aiText = aiPromptOverride ?? userText
    if (notes && notes.trim()) {
      // 자유 대화는 시스템 프롬프트 분리되어 있어 user 메시지 앞에 prepend
      aiText = `[오늘 특이사항: ${notes.trim()}]\n${aiText}`
    }

    // ─── 슬라이딩 윈도우: 오래된 대화 롤링 요약 압축 ────────
    let currentRaw = rawContents
    if (rawContents.length >= COMPRESS_AT) {
      try {
        const result = await compressConversation({
          rawContents,
          prevSummary: summaryContext,
          apiKey,
          model: 'gemini-2.5-flash-lite',
        })
        if (result) {
          currentRaw = result.newContents
          setRawContents(user.uid, result.newContents)
          setSummaryContext(user.uid, result.summaryText)
          toast.info('대화 맥락을 압축했습니다.')
        }
      } catch { /* 압축 실패 시 원본 유지 */ }
    }
    // ─────────────────────────────────────────────────────────

    let contents = [...currentRaw, { role: 'user', parts: [{ text: aiText }] }]

    try {
      const memData = getMemSnapshot()
      const summary = getSummarySnapshot()

      // multi-turn — save_to_memory 호출 시 후속 처리
      for (let turn = 0; turn < 3; turn++) {
        let response, text, functionCalls, raw
        let finishReason = ''
        for (let retry = 0; retry < 3; retry++) {
          ;({ text, functionCalls, raw, finishReason } = await callGeminiChat({
            apiKey, model: aiModel, contents,
            memory: memData, autoSummary: summary,
            onModelSwitch: (from, to) => {
              toast.warning(`${from.replace('gemini-2.5-', '')} → ${to.replace('gemini-2.5-', '')} 자동 전환`)
            },
          }))
          if (text || functionCalls.length) break
          if (retry < 2) await new Promise((r) => setTimeout(r, 600))
        }
        if (raw) contents = [...contents, raw]

        if (!functionCalls.length) {
          let emptyMsg = ''
          if (!text) {
            if (finishReason === 'SAFETY') {
              emptyMsg = '안전 정책으로 응답이 차단됐어요. 다른 표현으로 다시 시도해 주세요.'
            } else {
              emptyMsg = 'API 응답이 비었어요. 잠시 후 다시 시도해 주세요.'
            }
          }
          updateLastMessage(user.uid, {
            text: text || '',
            error: emptyMsg || undefined,
            pending: false,
          })
          setRawContents(user.uid, contents)
          return
        }

        // 도구 호출 (save_to_memory만 허용)
        updateLastMessage(user.uid, {
          text, pending: true,
          toolCalls: functionCalls.map((fc) => ({ name: fc.name, status: 'running' })),
        })

        const functionResponses = []
        for (let i = 0; i < functionCalls.length; i++) {
          const fc = functionCalls[i]
          const result = await executeChatTool(fc.name, fc.args, { uid: user.uid })

          updateLastMessage(user.uid, {
            toolCalls: functionCalls.map((c, idx) => ({
              name: c.name,
              status: idx < i ? 'success' : idx === i ? (result.ok ? 'success' : 'error') : 'running',
              summary: idx === i ? (result.summary || result.error) : undefined,
            })),
          })

          if (result.ok && result.summary) toast.success(result.summary)
          else if (!result.ok) toast.error(`${fc.name} 실패: ${result.error}`)

          functionResponses.push({
            functionResponse: {
              name: fc.name,
              response: result.ok
                ? { result: result.data, summary: result.summary }
                : { error: result.error },
            },
          })
        }

        contents = [...contents, { role: 'user', parts: functionResponses }]
        addMessage(user.uid, { role: 'assistant', text: '', pending: true })
      }
    } catch (err) {
      const msg = err.message || String(err)
      updateLastMessage(user.uid, { text: '', pending: false, error: msg })
      setError(msg)
      toast.error(`AI 오류: ${msg}`)
    }
  }, [apiKey, aiModel, user, rawContents, summaryContext, addMessage, updateLastMessage, setRawContents, setSummaryContext, setError])

  // ─── 재시도 핸들러: 오류 버블을 in-place로 리셋 ───────────
  const handleRetry = useCallback(async (userText) => {
    if (!userText || isLoading || !user || !apiKey) return
    // Reset the error bubble to pending instead of adding new messages
    updateLastMessage(user.uid, { text: '', pending: true, error: undefined, toolCalls: undefined })
    setLoading(true)
    setError(null)
    try {
      await runChat(userText)
    } finally {
      setLoading(false)
    }
  }, [isLoading, user, apiKey, updateLastMessage, setLoading, setError, runChat])

  // ─── 메인 핸들러 ──────────────────────────────────────────
  // presetExtras: 빈 채팅 화면의 textarea에서 카드 클릭 시 전달
  const handleSend = useCallback(async (userText, presetExtras = '') => {
    const text = (userText ?? input).trim()
    if (!text || isLoading || !user) return

    // 슬래시 명령어 매칭
    const { isCommand, command, extras } = parseCommand(text)
    // CLI extras 우선, 없으면 textarea 값
    const notes = (extras && extras.trim()) || (presetExtras && presetExtras.trim()) || ''

    if (isCommand) {
      if (!command) {
        toast.warning('알 수 없는 명령어. /도움 으로 목록 확인.')
        return
      }
      setInput('')
      setCmdMenuOpen(false)

      // 클라이언트 처리 (도움말)
      if (command.mode === 'client' && command.id === '도움') {
        addMessage(user.uid, { role: 'user', text })
        addMessage(user.uid, { role: 'assistant', text: buildHelpMessage() })
        return
      }

      if (!apiKey) {
        toast.error('Gemini API 키를 설정에서 먼저 등록해주세요.')
        return
      }

      // 사용자 메시지에 특이사항도 같이 노출 (가독성)
      const displayText = notes
        ? `${text}${text.includes(notes) ? '' : `\n📝 ${notes}`}`
        : text
      addMessage(user.uid, { role: 'user', text: displayText })
      addMessage(user.uid, { role: 'assistant', text: '', pending: true })
      setLoading(true)
      setError(null)

      try {
        if (command.mode === 'json') {
          await runJsonJob(command.kind, notes)
        } else if (command.mode === 'json-multi') {
          await runJsonMulti(command.kinds, notes)
        } else if (command.mode === 'chat') {
          const cmdPrompt = typeof command.prompt === 'function' ? command.prompt() : command.prompt
          await runChat(text, cmdPrompt, notes)
        }
        // 한 번 사용한 textarea 값은 비움
        if (presetExtras) setExtraNotes('')
      } finally {
        setLoading(false)
      }
      return
    }

    // 자유 대화 (슬래시 X)
    if (!apiKey) {
      toast.error('Gemini API 키를 설정에서 먼저 등록해주세요.')
      return
    }

    setInput('')
    setError(null)
    addMessage(user.uid, { role: 'user', text })
    addMessage(user.uid, { role: 'assistant', text: '', pending: true })
    setLoading(true)
    try {
      // 자유 대화는 textarea 값도 함께 전달 (자연어로 prepend)
      await runChat(text, undefined, notes)
      if (presetExtras) setExtraNotes('')
    } finally {
      setLoading(false)
    }
  }, [input, isLoading, user, apiKey, runJsonJob, runJsonMulti, runChat,
      addMessage, setLoading, setError])

  // ─── 키보드 / 입력 핸들러 ─────────────────────────────────
  const handleKeyDown = (e) => {
    if (parsed.isCommand && cmdMenuOpen && cmdMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCmdMenuIdx((i) => (i + 1) % cmdMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCmdMenuIdx((i) => (i - 1 + cmdMatches.length) % cmdMatches.length)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        setInput(`/${cmdMatches[cmdMenuIdx].id}`)
        return
      }
      if (e.key === 'Escape') {
        setCmdMenuOpen(false)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (parsed.command) handleSend()
        else handleSend(`/${cmdMatches[cmdMenuIdx].id}`)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e) => {
    const v = e.target.value
    setInput(v)
    if (v.startsWith('/')) {
      const p = parseCommand(v)
      // 명령어 정확히 매칭 + extras 입력 중이면 드롭다운 닫기
      if (p.command && p.extras) {
        setCmdMenuOpen(false)
      } else {
        setCmdMenuOpen(true)
        setCmdMenuIdx(0)
      }
    } else {
      setCmdMenuOpen(false)
    }
  }

  const handleRefreshSummary = async () => {
    if (!user) return
    await loadAutoSummary(user.uid)
    toast.success('최근 운동/체성분 데이터를 다시 불러왔습니다.')
  }

  return (
    <main className="page-content coach-page" role="main">
      {/* 헤더 */}
      <div className="coach-header animate-fadeInUp">
        <div className="coach-header-text">
          <h2><Sparkles size={18} /> AI 피트니스 코치</h2>
          <p>운동·식단·스케줄을 자동으로 만들어드려요</p>
        </div>
        {messages.length > 0 && (
          <button
            className="btn-icon"
            onClick={() => { if (confirm('대화를 모두 지울까요?')) clearChat(user.uid) }}
            title="대화 초기화"
            aria-label="대화 초기화"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* 메모리 상태 배지 */}
      {isLoaded && (
        <div className={`coach-memory-bar ${hasMemory ? 'active' : 'empty'}`}>
          <Brain size={14} />
          {hasMemory ? (
            <>
              <span className="cmb-label">메모리 활성</span>
              <span className="cmb-items">{memoryItems.join(' · ')}</span>
            </>
          ) : (
            <button className="cmb-cta" onClick={() => setWizardOpen(true)}>
              ✨ AI로 내 맞춤 플랜 만들기
            </button>
          )}
          <button
            className="cmb-refresh"
            onClick={handleRefreshSummary}
            title="최근 운동/체성분 다시 불러오기"
            aria-label="자동 요약 갱신"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      {/* 외부 AI 백업 링크 */}
      <Link to="/assistant" className="coach-backup-link" title="외부 AI(ChatGPT/Claude/Gemini)에 직접 시키기">
        <ExternalLink size={12} />
        API가 잘 안 될 때 → 외부 AI로 만들기
      </Link>

      {!apiKey && isLoaded && (
        <div className="coach-no-key card animate-fadeInUp">
          <AlertCircle size={18} color="var(--color-warning)" />
          <div>
            <p style={{ color: 'var(--color-text)', marginBottom: 4 }}>
              <strong>Gemini API 키를 설정에서 등록해주세요.</strong>
            </p>
            <p style={{ fontSize: '0.75rem' }}>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--color-primary)' }}
              >
                aistudio.google.com/apikey
              </a> 에서 무료로 발급 가능합니다.
            </p>
          </div>
        </div>
      )}

      {/* 채팅 스크롤 영역 */}
      <div className="coach-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="coach-suggestions">
            {/* 오늘 특이사항 — 카드 클릭 시 자동 첨부 */}
            <div className="coach-extra-notes">
              <label className="coach-extra-label" htmlFor="coach-extra-input">
                <span>⭐ 오늘만의 특이사항 (선택)</span>
                <span className="coach-extra-hint">아래 명령어 누르면 자동 반영</span>
              </label>
              <textarea
                id="coach-extra-input"
                className="coach-extra-input"
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                placeholder={'예: "오늘 컨디션 안 좋아 강도 낮춰줘"\n예: "어제 점심에 라면 먹어서 단백질 더"\n예: "왼쪽 어깨 시큰 — 프레스 종목 빼고"'}
                rows={3}
                spellCheck="false"
                disabled={isLoading || !apiKey}
              />
            </div>

            <p className="coach-suggest-label">⚡ 빠른 명령어 (입력창에 / 입력해도 사용 가능)</p>
            <div className="coach-cmd-grid">
              {COMMANDS.filter((c) => c.mode !== 'client').map((c) => (
                <button
                  key={c.id}
                  className="coach-cmd-card"
                  onClick={() => handleSend(`/${c.id}`, extraNotes)}
                  disabled={isLoading || !apiKey}
                >
                  <span className="cmd-card-icon">{c.icon}</span>
                  <div className="cmd-card-body">
                    <span className="cmd-card-label">{c.label}</span>
                    <span className="cmd-card-desc">{c.description}</span>
                  </div>
                </button>
              ))}
            </div>
            <p className="coach-suggest-label" style={{ marginTop: 'var(--space-md)' }}>
              💡 또는 자연어로 자유롭게 물어보세요
            </p>
            <button
              className="coach-suggestion-btn"
              onClick={() => handleSend('오늘 내 운동 계획 짧게 요약해줘', extraNotes)}
              disabled={isLoading || !apiKey}
            >
              오늘 운동 계획 요약
            </button>
          </div>
        )}

        {messages.map((msg, i) => {
          const isErrorAssistant = msg.role === 'assistant' && msg.error
          const prevUserText = isErrorAssistant
            ? [...messages.slice(0, i)].reverse().find((m) => m.role === 'user')?.text
            : null
          return (
            <MessageBubble
              key={i}
              msg={msg}
              onRetry={prevUserText ? () => handleRetry(prevUserText) : undefined}
            />
          )
        })}
      </div>

      {/* 입력 */}
      <div className="coach-input-row">
        {cmdMenuOpen && cmdMatches.length > 0 && (
          <div className="coach-cmd-menu" role="listbox">
            {cmdMatches.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`coach-cmd-menu-item ${i === cmdMenuIdx ? 'active' : ''}`}
                onMouseEnter={() => setCmdMenuIdx(i)}
                onClick={() => {
                  setInput('')
                  setCmdMenuOpen(false)
                  handleSend(`/${c.id}`)
                }}
              >
                <span className="cmd-menu-icon">{c.icon}</span>
                <span className="cmd-menu-label">{c.label}</span>
                <span className="cmd-menu-desc">{c.description}</span>
              </button>
            ))}
            <div className="coach-cmd-menu-hint">
              ↑↓ 이동 · Tab 자동완성 · Enter 실행 · Esc 닫기
            </div>
          </div>
        )}

        <div className="coach-input-wrap">
          {parsed.command && parsed.extras && (
            <div className="coach-extras-pill">
              <span className="coach-extras-label">📝 특이사항</span>
              <span className="coach-extras-text">{parsed.extras}</span>
            </div>
          )}
          <input
            ref={inputRef}
            className="coach-input"
            type="text"
            placeholder="AI 코치에게 물어보기 또는 / 입력..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !apiKey}
          />
        </div>
        <button
          className="btn btn-primary coach-send-btn"
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim() || !apiKey}
          aria-label="전송"
        >
          {isLoading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Send size={16} />}
        </button>
      </div>

      <PlanWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </main>
  )
}

// ─── MessageBubble ─────────────────────────────────────────
function MessageBubble({ msg, onRetry }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="msg-row user animate-fadeIn">
        <div className="msg-bubble user-bubble">{msg.text}</div>
      </div>
    )
  }

  return (
    <div className="msg-row assistant animate-fadeIn">
      <div className="msg-avatar"><Sparkles size={14} /></div>
      <div className="msg-content">
        {msg.toolCalls?.length > 0 && (
          <div className="msg-tools">
            {msg.toolCalls.map((tc, i) => (
              <div key={i} className={`tool-chip tool-${tc.status}`}>
                {tc.status === 'running' && <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />}
                {tc.status === 'pending' && <span className="chip-dot" />}
                {tc.status === 'success' && '✓'}
                {tc.status === 'error' && '✕'}
                <Wrench size={11} />
                <span>{chipLabel(tc)}</span>
                {tc.summary && <span className="tool-chip-sum">{tc.summary}</span>}
              </div>
            ))}
          </div>
        )}
        {msg.text && (
          <div className="msg-bubble ai-bubble">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            >
              {msg.text}
            </ReactMarkdown>
          </div>
        )}
        {msg.pending && !msg.text && !msg.toolCalls?.length && (
          <div className="msg-bubble ai-bubble pending">
            <span className="typing-dots"><span/><span/><span/></span>
          </div>
        )}
        {msg.error && (
          <div className="msg-bubble error-bubble">
            ⚠️ {msg.error}
            {onRetry && (
              <button className="retry-btn" onClick={onRetry}>재시도</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// JSON 모드 칩(kind) vs Chat 모드 칩(name) 둘 다 처리
function chipLabel(tc) {
  if (tc.kind) {
    return ({ workout: '운동 만들기', meal: '식단 만들기', schedule: '스케줄 만들기' })[tc.kind] || tc.kind
  }
  // chat 모드 — save_to_memory 등
  const map = {
    save_to_memory: '메모 저장',
  }
  return map[tc.name] || tc.name
}
