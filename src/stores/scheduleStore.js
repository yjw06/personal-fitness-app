import { create } from 'zustand'
import { fetchSchedule, saveScheduleData } from '../services/csvService'

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
}))
