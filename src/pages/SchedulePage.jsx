import { useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { deleteSchedule, uploadScheduleCSV, readFileAsText } from '../services/csvService'
import { useScheduleStore } from '../stores/scheduleStore'
import { format, startOfWeek, addDays, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Upload, RefreshCw, Check, Trash2 } from 'lucide-react'
import './SchedulePage.css'

// 요일 라벨
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

export default function SchedulePage() {
  const { user } = useAuth()
  const today = format(new Date(), 'yyyyMMdd')
  const fileInputRef = useRef(null)

  const {
    schedules,
    isLoading,
    loadData,
    toggleScheduleCompletion,
    autoCheckPastItems,
  } = useScheduleStore()

  useEffect(() => {
    if (user) {
      loadData(user.uid, today)
    }
  }, [user, today, loadData])

  // ─── 자동 체크: 시간이 지난 스케줄 자동 완료 처리 ─────────────
  useEffect(() => {
    if (!user || !schedules.length) return

    // 마운트 즉시 1회 실행
    autoCheckPastItems(user.uid)

    // 이후 1분마다 실행
    const interval = setInterval(() => {
      autoCheckPastItems(user.uid)
    }, 60 * 1000)

    // 탭 복귀 시 즉시 재확인 (백그라운드에서 시간이 지난 경우)
    const onVisibility = () => {
      if (!document.hidden) autoCheckPastItems(user.uid)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user, schedules.length, autoCheckPastItems])

  // ─── CSV 업로드 ─────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await readFileAsText(file)
      await uploadScheduleCSV(user.uid, today, text)
      await loadData(user.uid, today)
    } catch {
      alert('업로드에 실패했습니다.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── 전체 삭제 ───────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm('오늘 스케줄 전체를 삭제할까요?')) return
    try {
      await deleteSchedule(user.uid, today)
      await loadData(user.uid, today)
    } catch {
      alert('삭제에 실패했습니다.')
    }
  }

  // ─── 현재 진행 중인 스케줄 인덱스 ─────────────────────
  const getCurrentScheduleIndex = () => {
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

  // ─── 이번 주 날짜 배열 생성 ──────────────────────────
  const getWeekDays = () => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // 월요일 시작
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      return {
        label: DAY_LABELS[i],
        num: format(date, 'd'),
        isToday: isToday(date),
      }
    })
  }

  const currentIndex = getCurrentScheduleIndex()
  const completedCount = schedules?.filter(s => s.completed).length || 0
  const totalCount = schedules?.length || 0
  const allDone = totalCount > 0 && completedCount === totalCount
  const weekDays = getWeekDays()

  return (
    <main className="page-content schedule-page" role="main">
      {/* ─── 날짜 헤더 ─── */}
      <div className="schedule-date-header animate-fadeInUp">
        <p className="date-sub">{format(new Date(), 'yyyy년 M월 d일', { locale: ko })}</p>
        <h2 className="date-main">Today</h2>
      </div>

      {/* ─── 요일 셀렉터 ─── */}
      <div className="weekday-selector animate-fadeInUp" style={{ animationDelay: '0.05s' }}>
        {weekDays.map((day, i) => (
          <div key={i} className={`weekday-item ${day.isToday ? 'today' : ''}`}>
            <span className="day-name">{day.label}</span>
            <span className="day-num">{day.num}</span>
          </div>
        ))}
      </div>

      {/* ─── 툴바 ─── */}
      <div className="schedule-toolbar animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        <label id="btn-upload-schedule" className="btn btn-ghost upload-label" role="button">
          <Upload size={16} /> CSV 업로드
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleUpload} hidden />
        </label>
        <button id="btn-refresh-schedule" className="btn btn-ghost" onClick={() => loadData(user.uid, today)} disabled={isLoading} aria-label="새로고침">
          <RefreshCw size={16} className={isLoading ? 'spin-anim' : ''} />
        </button>
        {totalCount > 0 && (
          <button id="btn-delete-schedule" className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={14} /> 삭제
          </button>
        )}
      </div>

      {/* ─── 로딩 ─── */}
      {isLoading && (
        <div className="empty-state">
          <span className="spinner" />
        </div>
      )}

      {/* ─── 빈 상태 ─── */}
      {!isLoading && schedules !== null && totalCount === 0 && (
        <div className="empty-state animate-fadeInUp">
          <span style={{ fontSize: '2.5rem' }}>📅</span>
          <p>오늘 스케줄 데이터가 없어요.</p>
          <label className="btn btn-primary" role="button">
            CSV 업로드하기
            <input type="file" accept=".csv" onChange={handleUpload} hidden />
          </label>
        </div>
      )}

      {/* ─── 스케줄 목록 ─── */}
      {!isLoading && totalCount > 0 && (
        <>
          {/* 진행 요약 */}
          <div className="schedule-summary card animate-fadeInUp" style={{ animationDelay: '0.15s' }}>
            <span className="ws-label">오늘 일정</span>
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

          {/* 타임라인 */}
          <div className="schedule-timeline">
            {schedules.map((item, index) => {
              const isCompleted = item.completed
              const isCurrent = !isCompleted && index === currentIndex

              return (
                <div
                  key={index}
                  className={`tl-item animate-fadeInUp ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                  style={{ animationDelay: `${0.2 + index * 0.06}s` }}
                  onClick={() => toggleScheduleCompletion(user.uid, index)}
                  role="button"
                  tabIndex={0}
                >
                  {/* 마커 */}
                  <div className="tl-marker">
                    {isCompleted && <Check size={12} className="tl-check-icon" />}
                  </div>

                  {/* 카드 */}
                  <div className="tl-card">
                    <div className="tl-card-header">
                      <h3>{item.activity}</h3>
                      <span className="tl-card-time">{item.time}</span>
                    </div>
                    {item.detail && <p className="tl-card-detail">{item.detail}</p>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 올 던 배너 */}
          {allDone && (
            <div className="all-done-banner animate-fadeInUp">
              <span style={{ fontSize: '2rem' }}>🎉</span>
              <h2>오늘 일정 완료!</h2>
              <p>모든 일정을 성공적으로 마쳤습니다!</p>
            </div>
          )}
        </>
      )}
    </main>
  )
}
