import { create } from 'zustand'
import { fetchSchedule, saveScheduleData } from '../services/csvService'

export const useScheduleStore = create((set, get) => ({
  date: '',
  schedules: [],
  isLoading: false,

  setDate: (date) => set({ date }),

  loadData: async (uid, date) => {
    set({ isLoading: true })
    const rows = await fetchSchedule(uid, date)
    set({ schedules: rows || [], isLoading: false })
  },

  toggleScheduleCompletion: async (uid, index) => {
    const { date, schedules } = get()
    const newSchedules = [...schedules]
    newSchedules[index] = {
      ...newSchedules[index],
      completed: !newSchedules[index].completed,
    }
    
    set({ schedules: newSchedules })
    await saveScheduleData(uid, date, newSchedules)
  },
}))
