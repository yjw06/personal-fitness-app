import { create } from 'zustand'

let nextId = 1

export const useToastStore = create((set, get) => ({
  toasts: [],

  show: (message, opts = {}) => {
    const id = nextId++
    const toast = {
      id,
      message,
      kind: opts.kind || 'info', // 'info' | 'success' | 'error' | 'warning'
      duration: opts.duration ?? 3500,
    }
    set((s) => ({ toasts: [...s.toasts, toast] }))

    if (toast.duration > 0) {
      setTimeout(() => get().dismiss(id), toast.duration)
    }
    return id
  },

  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}))

// 헬퍼들 (어디서든 toast.success(), toast.error() 형태로 호출 가능)
export const toast = {
  info:    (msg, opts) => useToastStore.getState().show(msg, { ...opts, kind: 'info' }),
  success: (msg, opts) => useToastStore.getState().show(msg, { ...opts, kind: 'success' }),
  error:   (msg, opts) => useToastStore.getState().show(msg, { ...opts, kind: 'error', duration: 5000 }),
  warning: (msg, opts) => useToastStore.getState().show(msg, { ...opts, kind: 'warning' }),
}
