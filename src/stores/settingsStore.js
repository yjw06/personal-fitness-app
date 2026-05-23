import { create } from 'zustand'

const STORAGE_KEY = 'workout_settings_v1'

const defaults = {
  // 휴식 타이머 알림 설정
  soundEnabled:    true,
  vibrateEnabled:  true,
  notifyEnabled:   true,    // 시스템 알림 (백그라운드 탭에서도 작동)
  wakeLockEnabled: true,    // 화면 꺼짐 방지
  volume:          0.8,     // 0.0 ~ 1.0
  repeatAlert:     true,    // 사용자가 응답할 때까지 반복

  // 스케줄 알림 (브라우저 푸시)
  scheduleNotifyEnabled: true,

  // AI 코치 모델 (Gemini)
  aiModel: 'gemini-2.5-flash',
}

// 저장된 설정 로드
function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...defaults, ...JSON.parse(stored) }
  } catch {}
  return defaults
}

export const useSettingsStore = create((set, get) => ({
  ...loadSettings(),

  update: (patch) => {
    const next = { ...get(), ...patch }
    set(patch)
    try {
      const persisted = { ...next }
      delete persisted.update
      delete persisted.reset
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    } catch {}
  },

  reset: () => {
    set(defaults)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults)) } catch {}
  },
}))
