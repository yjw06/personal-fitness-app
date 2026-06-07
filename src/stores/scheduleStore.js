import { create } from 'zustand'
import { fetchSchedule, saveScheduleData } from '../services/csvService'

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

  // 사용자가 수동으로 체크 해제한 항목들 (자동 재체크 방지)
  // 날짜별로 Set을 관리
  manuallyUnchecked: {}, // { 'YYYYMMDD': Set<number> }

  setDate: (date) => set({ date }),

  loadData: async (uid, date) => {
    set({ isLoading: true, date })
    const rows = await fetchSchedule(uid, date)
    const normalized = (rows || []).map((row) => ({
      ...row,
      completed: row.completed === true || row.completed === 'true',
    }))

    // 오늘 날짜 스케줄이면 시간이 지난 항목 즉시 완료 처리
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    if (date === todayStr && normalized.length > 0) {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      let changed = false
      const checked = normalized.map((item) => {
        if (item.completed) return item
        const [h, m] = (item.time || '').split(':').map(Number)
        if (!isNaN(h) && !isNaN(m) && h * 60 + m <= currentMinutes) {
          changed = true
          return { ...item, completed: true }
        }
        return item
      })
      set({ schedules: checked, isLoading: false })
      if (changed) {
        saveScheduleData(uid, date, checked).catch(() => {})
      }
      return
    }

    set({ schedules: normalized, isLoading: false })
  },

  toggleScheduleCompletion: async (uid, index) => {
    const { date, schedules, manuallyUnchecked } = get()
    if (!date) return

    const wasCompleted = schedules[index]?.completed
    const newSchedules = [...schedules]
    newSchedules[index] = {
      ...newSchedules[index],
      completed: !wasCompleted,
    }

    // 완료 → 미완료 전환 시 manuallyUnchecked에 추가
    const setForDate = new Set(manuallyUnchecked[date] || [])
    if (wasCompleted) {
      setForDate.add(index)
    } else {
      // 미완료 → 완료 전환 시 manuallyUnchecked에서 제거
      setForDate.delete(index)
    }

    set({
      schedules: newSchedules,
      manuallyUnchecked: { ...manuallyUnchecked, [date]: setForDate },
    })
    await saveScheduleData(uid, date, newSchedules)
  },

  autoCheckPastItems: async (uid) => {
    const { date, schedules, manuallyUnchecked } = get()
    if (!date || !schedules.length) return

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const unchecked = manuallyUnchecked[date] || new Set()

    let changed = false
    const newSchedules = schedules.map((item, idx) => {
      if (item.completed) return item
      if (unchecked.has(idx)) return item  // 수동 해제 항목 건너뜀
      const itemMinutes = timeToMinutes(item.time)
      if (itemMinutes <= currentMinutes) {
        changed = true
        return { ...item, completed: true }
      }
      return item
    })

    if (!changed) return

    set({ schedules: newSchedules })
    await saveScheduleData(uid, date, newSchedules)
  },

  // 날짜가 바뀌면 manuallyUnchecked 초기화 (메모리 절약)
  clearManuallyUnchecked: () => set({ manuallyUnchecked: {} }),

  // 선택 삭제: indexSet의 항목 제거 + manuallyUnchecked 인덱스 시프트
  // newRows 길이가 0이면 호출 측에서 별도로 deleteSchedule을 처리해야 함
  removeIndices: async (uid, indexSet) => {
    const { date, schedules, manuallyUnchecked } = get()
    if (!date || !schedules.length || !indexSet?.size) return null

    const newRows = schedules.filter((_, i) => !indexSet.has(i))

    // manuallyUnchecked 시프트
    const oldUnchecked = manuallyUnchecked[date] || new Set()
    const newUnchecked = new Set()
    let newIdx = 0
    schedules.forEach((_, oldIdx) => {
      if (indexSet.has(oldIdx)) return
      if (oldUnchecked.has(oldIdx)) newUnchecked.add(newIdx)
      newIdx++
    })

    set({
      schedules: newRows,
      manuallyUnchecked: { ...manuallyUnchecked, [date]: newUnchecked },
    })

    if (newRows.length > 0) {
      await saveScheduleData(uid, date, newRows)
    }
    return newRows
  },

  // 외부에서 schedules 전체를 비우는 경우 (전체 삭제)
  clearSchedules: () => set({ schedules: [] }),
}))
