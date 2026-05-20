import { create } from 'zustand'
import { fetchSchedule, saveScheduleData } from '../services/csvService'

// "HH:MM" 문자열을 오늘 날짜의 분(minutes) 값으로 변환
const timeToMinutes = (timeStr) => {
  if (!timeStr) return Infinity
  const [h, m] = timeStr.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return Infinity
  return h * 60 + m
}

export const useScheduleStore = create((set, get) => ({
  date: '',
  schedules: [],
  isLoading: false,

  setDate: (date) => set({ date }),

  loadData: async (uid, date) => {
    set({ isLoading: true, date })
    const rows = await fetchSchedule(uid, date)
    // Firestore에서 가져온 completed 값이 문자열일 수 있으므로 bool로 정규화
    const normalized = (rows || []).map(row => ({
      ...row,
      completed: row.completed === true || row.completed === 'true',
    }))
    set({ schedules: normalized, isLoading: false })
  },

  toggleScheduleCompletion: async (uid, index) => {
    const { date, schedules } = get()
    if (!date) return  // 날짜 없으면 무시

    const newSchedules = [...schedules]
    newSchedules[index] = {
      ...newSchedules[index],
      completed: !newSchedules[index].completed,
    }

    set({ schedules: newSchedules })
    await saveScheduleData(uid, date, newSchedules)
  },

  // ─── 시간이 지난 항목을 자동으로 완료 처리 ────────────────────
  autoCheckPastItems: async (uid) => {
    const { date, schedules } = get()
    if (!date || !schedules.length) return

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    // 아직 미완료이면서 시간이 지난 항목만 찾기
    let changed = false
    const newSchedules = schedules.map(item => {
      if (item.completed) return item  // 이미 완료된 것은 건드리지 않음
      const itemMinutes = timeToMinutes(item.time)
      if (itemMinutes <= currentMinutes) {
        changed = true
        return { ...item, completed: true }
      }
      return item
    })

    if (!changed) return  // 변경사항 없으면 Firebase 저장 안 함

    set({ schedules: newSchedules })
    await saveScheduleData(uid, date, newSchedules)
  },
}))
