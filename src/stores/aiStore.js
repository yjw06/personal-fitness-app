// AI 코치 채팅 store — localStorage with UID prefix (사용자별 격리)
// API 키와 메모리는 memoryStore에서 관리 (Firestore)
import { create } from 'zustand'

const MAX_MESSAGES = 50
const MAX_RAW = 30  // 마지막 30개 turn만 모델 컨텍스트로 유지

const msgKey     = (uid) => `ai_messages_v2_${uid}`
const rawKey     = (uid) => `ai_raw_contents_v2_${uid}`
const summaryKey = (uid) => `ai_summary_v1_${uid}`

function loadFor(uid) {
  if (!uid) return { messages: [], rawContents: [], summaryContext: '' }
  try {
    const msgs    = JSON.parse(localStorage.getItem(msgKey(uid)) || '[]')
    const raws    = JSON.parse(localStorage.getItem(rawKey(uid)) || '[]')
    const summary = localStorage.getItem(summaryKey(uid)) || ''
    return { messages: msgs, rawContents: raws, summaryContext: summary }
  } catch {
    return { messages: [], rawContents: [], summaryContext: '' }
  }
}

function saveMessages(uid, msgs) {
  if (!uid) return
  try {
    localStorage.setItem(msgKey(uid), JSON.stringify(msgs.slice(-MAX_MESSAGES)))
  } catch {}
}

function saveRaw(uid, raws) {
  if (!uid) return
  try {
    localStorage.setItem(rawKey(uid), JSON.stringify(raws.slice(-MAX_RAW)))
  } catch {}
}

export const useAIStore = create((set, get) => ({
  messages: [],
  rawContents: [],
  summaryContext: '',
  isLoading: false,
  error: null,
  loadedUid: null,

  loadForUser: (uid) => {
    if (!uid) {
      set({ messages: [], rawContents: [], summaryContext: '', loadedUid: null })
      return
    }
    if (get().loadedUid === uid) return
    const { messages, rawContents, summaryContext } = loadFor(uid)
    set({ messages, rawContents, summaryContext, loadedUid: uid })
  },

  addMessage: (uid, msg) => {
    const next = [...get().messages, { ...msg, ts: Date.now() }]
    set({ messages: next })
    saveMessages(uid, next)
  },

  updateLastMessage: (uid, patch) => {
    const msgs = get().messages
    if (!msgs.length) return
    const next = [...msgs]
    next[next.length - 1] = { ...next[next.length - 1], ...patch }
    set({ messages: next })
    saveMessages(uid, next)
  },

  setRawContents: (uid, contents) => {
    set({ rawContents: contents })
    saveRaw(uid, contents)
  },

  setSummaryContext: (uid, text) => {
    set({ summaryContext: text })
    if (uid) {
      try { localStorage.setItem(summaryKey(uid), text) } catch {}
    }
  },

  setLoading: (v) => set({ isLoading: v }),
  setError:   (e) => set({ error: e }),

  clearChat: (uid) => {
    set({ messages: [], rawContents: [], summaryContext: '', error: null })
    if (uid) {
      try {
        localStorage.removeItem(msgKey(uid))
        localStorage.removeItem(rawKey(uid))
        localStorage.removeItem(summaryKey(uid))
      } catch {}
    }
  },
}))
