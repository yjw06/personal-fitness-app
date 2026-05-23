import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { deleteSchedule, uploadScheduleCSV, readFileAsText, saveScheduleData } from '../services/csvService'
import { useScheduleStore } from '../stores/scheduleStore'
import { useWorkoutStore } from '../stores/workoutStore'
import { toast } from '../stores/toastStore'
import { useSelection } from '../hooks/useSelection'
import SelectionToolbar from '../components/Selection/SelectionToolbar'
import EntryModal from '../components/EntryModal/EntryModal'
import ScheduleForm from '../components/EntryModal/ScheduleForm'
import { categorizeActivity, formatGap, timeToMinutes } from '../utils/scheduleCategory'
import { format, startOfWeek, addDays, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Upload, RefreshCw, Check, Plus, Pencil } from 'lucide-react'
import '../components/Selection/SelectionToolbar.css'
import './SchedulePage.css'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function todayYmd() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

// YYYYMMDD → Date
function ymdToDate(ymd) {
  if (!ymd || ymd.length !== 8) return new Date()
  return new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}T00:00:00`)
}

export default function SchedulePage() {
  const { user } = useAuth()
  const selectedDate = useWorkoutStore((s) => s.selectedDate)
  const today = todayYmd()
  const isViewingToday = selectedDate === today
  const fileInputRef = useRef(null)

  const {
    schedules,
    isLoading,
    loadData,
    toggleScheduleCompletion,
    autoCheckPastItems,
    removeIndices,
    clearSchedules,
  } = useScheduleStore()

  useEffect(() => {
    if (user) {
      loadData(user.uid, selectedDate)
    }
  }, [user, selectedDate, loadData])

  // 자동 체크 — 오늘 날짜 보고 있을 때만 동작
  useEffect(() => {
    if (!user || !schedules.length || !isViewingToday) return

    autoCheckPastItems(user.uid)

    const interval = setInterval(() => {
      autoCheckPastItems(user.uid)
    }, 60 * 1000)

    const onVisibility = () => {
      if (!document.hidden) autoCheckPastItems(user.uid)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user, schedules.length, autoCheckPastItems, isViewingToday])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const result = await uploadScheduleCSV(user.uid, selectedDate, text)
      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success(`스케줄 ${result.count}개 업로드 완료`)
        await loadData(user.uid, selectedDate)
      }
    } catch {
      toast.error('업로드에 실패했습니다.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const allIndices = useMemo(() => (schedules ?? []).map((_, i) => i), [schedules])
  const selection = useSelection(allIndices)

  // 추가/편집 모달
  const [modalOpen, setModalOpen] = useState(false)
  const [editIndex, setEditIndex] = useState(null)

  const openAdd  = () => { setEditIndex(null); setModalOpen(true) }
  const openEdit = (i) => { setEditIndex(i); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditIndex(null) }

  const handleSaveEntry = async (row) => {
    try {
      let newRows
      if (editIndex == null) {
        newRows = [...(schedules ?? []), row]
      } else {
        newRows = (schedules ?? []).map((r, i) => (i === editIndex ? row : r))
      }
      // 시간 순 정렬 — 인덱스가 바뀌므로 manuallyUnchecked는 단순히 비우는 게 안전
      newRows.sort((a, b) => (timeToMinutes(a.time) ?? Infinity) - (timeToMinutes(b.time) ?? Infinity))
      await saveScheduleData(user.uid, selectedDate, newRows)
      await loadData(user.uid, selectedDate)
      toast.success(editIndex == null ? '일정을 추가했습니다.' : '일정을 수정했습니다.')
      closeModal()
      if (editIndex != null) selection.disable()
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  const handleDeleteSelected = async () => {
    const removeSet = selection.selected
    if (!removeSet.size) return
    try {
      const remaining = await removeIndices(user.uid, removeSet)
      if (remaining && remaining.length === 0) {
        await deleteSchedule(user.uid, selectedDate)
        clearSchedules()
      }
      toast.success(`스케줄 ${removeSet.size}개 삭제 완료`)
      selection.disable()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  // 현재 진행 중인 스케줄 인덱스 (오늘일 때만 의미 있음)
  const getCurrentScheduleIndex = () => {
    if (!isViewingToday) return -1
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    let currentIndex = -1
    for (let i = 0; i < schedules?.length; i++) {
      const timeStr = schedules[i].time
      if (!timeStr) continue
      const [h, m] = timeStr.split(':').map(Number)
      if (currentMinutes >= h * 60 + m) {
        currentIndex = i
      } else {
        break
      }
    }
    return currentIndex
  }

  const getWeekDays = () => {
    const baseDate = ymdToDate(selectedDate)
    const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      return {
        label: DAY_LABELS[i],
        num: format(date, 'd'),
        isToday: isToday(date),
        isSelected: format(date, 'yyyyMMdd') === selectedDate,
      }
    })
  }

  const currentIndex = getCurrentScheduleIndex()
  const completedCount = schedules?.filter((s) => s.completed).length || 0
  const totalCount = schedules?.length || 0
  const allDone = totalCount > 0 && completedCount === totalCount
  const weekDays = getWeekDays()

  const baseDate = ymdToDate(selectedDate)
  const dateLabel = format(baseDate, 'yyyy년 M월 d일', { locale: ko })

  return (
    <main className="page-content schedule-page" role="main">
      <div className="schedule-date-header animate-fadeInUp">
        <p className="date-sub">{dateLabel}</p>
        <h2 className="date-main">{isViewingToday ? 'Today' : format(baseDate, 'EEEE', { locale: ko })}</h2>
      </div>

      <div className="weekday-selector animate-fadeInUp" style={{ animationDelay: '0.05s' }}>
        {weekDays.map((day, i) => (
          <div
            key={i}
            className={`weekday-item ${day.isToday ? 'today' : ''} ${day.isSelected ? 'selected' : ''}`}
          >
            <span className="day-name">{day.label}</span>
            <span className="day-num">{day.num}</span>
          </div>
        ))}
      </div>

      <div className="schedule-toolbar animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> 일정 추가
        </button>
        <label id="btn-upload-schedule" className="btn btn-ghost upload-label" role="button">
          <Upload size={16} /> CSV
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleUpload} hidden />
        </label>
        <button id="btn-refresh-schedule" className="btn btn-ghost" onClick={() => loadData(user.uid, selectedDate)} disabled={isLoading} aria-label="새로고침">
          <RefreshCw size={16} className={isLoading ? 'spin-anim' : ''} />
        </button>
        {totalCount > 0 && (
          <>
            <SelectionToolbar
              enabled={selection.enabled}
              totalCount={allIndices.length}
              selectedCount={selection.size}
              allSelected={selection.isAllSelected}
              onEnable={selection.enable}
              onCancel={selection.disable}
              onToggleAll={() => selection.toggleAll()}
              onDelete={handleDeleteSelected}
              confirmText={`선택한 일정 ${selection.size}개를 삭제할까요?`}
            />
            {selection.enabled && selection.size === 1 && (
              <button
                className="btn btn-ghost"
                onClick={() => openEdit(Array.from(selection.selected)[0])}
              >
                <Pencil size={14} /> 편집
              </button>
            )}
          </>
        )}
      </div>

      <EntryModal
        open={modalOpen}
        onClose={closeModal}
        title={editIndex == null ? '일정 추가' : '일정 편집'}
      >
        <ScheduleForm
          initial={editIndex != null ? schedules?.[editIndex] : null}
          onSubmit={handleSaveEntry}
          onCancel={closeModal}
        />
      </EntryModal>

      {isLoading && (
        <div className="empty-state">
          <span className="spinner" />
        </div>
      )}

      {!isLoading && schedules !== null && totalCount === 0 && (
        <div className="empty-state animate-fadeInUp">
          <span style={{ fontSize: '2.5rem' }}>📅</span>
          <p>스케줄 데이터가 없어요.</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
            상단 "일정 추가" 또는 CSV 업로드로 시작하세요.
          </p>
        </div>
      )}

      {!isLoading && totalCount > 0 && (
        <>
          <div className="schedule-summary card animate-fadeInUp" style={{ animationDelay: '0.15s' }}>
            <span className="ws-label">일정 진행</span>
            <span className="ws-count">
              <strong>{completedCount}</strong> / {totalCount} 완료
            </span>
            <div className="progress-bar" style={{ flex: 1 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${Math.round((completedCount / totalCount) * 100)}%`,
                  background: allDone ? 'var(--color-success)' : 'var(--color-primary)',
                }}
              />
            </div>
          </div>

          <div className="schedule-timeline">
            {schedules.map((item, index) => {
              const isCompleted = item.completed
              const isCurrent = !isCompleted && index === currentIndex
              const inSelectMode = selection.enabled
              const checked = selection.isSelected(index)
              const cat = categorizeActivity(item.activity, item.detail)

              // 다음 일정까지 간격
              const nextItem = schedules[index + 1]
              const myMin   = timeToMinutes(item.time)
              const nextMin = nextItem ? timeToMinutes(nextItem.time) : null
              const gapLabel = (myMin != null && nextMin != null)
                ? formatGap(myMin, nextMin)
                : null

              return (
                <div
                  key={index}
                  className={`tl-item animate-fadeInUp ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${inSelectMode ? 'selectable' : ''} ${inSelectMode && checked ? 'selected' : ''}`}
                  style={{ animationDelay: `${0.2 + index * 0.06}s` }}
                  onClick={() => {
                    if (inSelectMode) selection.toggle(index)
                    else toggleScheduleCompletion(user.uid, index)
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {/* 좌측 시간 컬럼 */}
                  <div className="tl-time-col">
                    <span className="tl-time-hhmm">{item.time}</span>
                    {gapLabel && <span className="tl-time-gap">{gapLabel}</span>}
                  </div>

                  {inSelectMode ? (
                    <div className="tl-marker">
                      <span className={`sel-checkbox ${checked ? 'checked' : ''}`} aria-hidden="true">
                        {checked && <Check size={12} strokeWidth={3} />}
                      </span>
                    </div>
                  ) : (
                    <div className="tl-marker">
                      {isCompleted && <Check size={12} className="tl-check-icon" />}
                      {isCurrent && <span className="tl-current-pulse" aria-hidden="true" />}
                    </div>
                  )}

                  <div className="tl-card">
                    {!inSelectMode && isCurrent && <span className="tl-current-badge">진행 중</span>}
                    <div className="tl-card-header">
                      <span className="tl-cat-emoji" aria-hidden="true">{cat.emoji}</span>
                      <h3>{item.activity}</h3>
                    </div>
                    {item.detail && <p className="tl-card-detail">{item.detail}</p>}
                  </div>
                </div>
              )
            })}
          </div>

          {allDone && (
            <div className="all-done-banner animate-fadeInUp">
              <span style={{ fontSize: '2rem' }}>🎉</span>
              <h2>일정 완료!</h2>
              <p>모든 일정을 성공적으로 마쳤습니다!</p>
            </div>
          )}
        </>
      )}
    </main>
  )
}
