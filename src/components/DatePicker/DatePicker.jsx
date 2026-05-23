import { useEffect, useState, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react'
import { listAvailableDates } from '../../services/csvService'
import { useAuth } from '../../hooks/useAuth'
import { useWorkoutStore } from '../../stores/workoutStore'
import './DatePicker.css'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// YYYYMMDD → Date
function ymdToDate(ymd) {
  if (!ymd || ymd.length !== 8) return new Date()
  return new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T00:00:00`)
}

// Date → YYYYMMDD
function dateToYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function todayYmd() {
  return dateToYmd(new Date())
}

export default function DatePicker({ open, onClose }) {
  const { user } = useAuth()
  const { selectedDate, setSelectedDate } = useWorkoutStore()

  const initialDate = ymdToDate(selectedDate)
  const [viewYear, setViewYear]   = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()) // 0-indexed
  const [availableDates, setAvailableDates] = useState(new Set())

  // 사용 가능한 날짜 목록 로드
  useEffect(() => {
    if (!open || !user) return
    listAvailableDates(user.uid)
      .then((arr) => setAvailableDates(new Set(arr)))
      .catch(() => {})
  }, [open, user])

  // 모달 열렸을 때 선택 날짜로 뷰 동기화
  useEffect(() => {
    if (open) {
      const d = ymdToDate(selectedDate)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [open, selectedDate])

  // 달력 그리드 (해당 월의 첫째 주 ~ 마지막 주)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const lastDay  = new Date(viewYear, viewMonth + 1, 0)
    const startDow = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const days = []
    // 앞쪽 빈칸
    for (let i = 0; i < startDow; i++) days.push(null)
    // 실제 날짜
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(viewYear, viewMonth, d))
    }
    // 뒤쪽 빈칸 (한 주 단위로 맞춤)
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [viewYear, viewMonth])

  const today = todayYmd()

  // 미래 달인지 여부 (다음 달 버튼 비활성화용)
  const now = new Date()
  const isViewingFutureMonth =
    viewYear > now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth >= now.getMonth())

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }
  const handleNextMonth = () => {
    if (isViewingFutureMonth) return    // 미래 달로는 이동 불가
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handleSelect = (date) => {
    if (!date) return
    const ymd = dateToYmd(date)
    if (ymd > today) return             // 미래 날짜 선택 차단
    setSelectedDate(ymd)
    onClose()
  }

  const handleToday = () => {
    setSelectedDate(today)
    const d = new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    onClose()
  }

  if (!open) return null

  return (
    <div className="datepicker-overlay" role="dialog" aria-modal="true" aria-label="날짜 선택">
      <div className="datepicker-modal animate-fadeInUp">
        <header className="dp-header">
          <h2><CalIcon size={18} /> 날짜 선택</h2>
          <button className="btn-icon" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </header>

        <div className="dp-month-nav">
          <button className="btn-icon" onClick={handlePrevMonth} aria-label="이전 달">
            <ChevronLeft size={18} />
          </button>
          <span className="dp-month-label">
            {viewYear}년 {viewMonth + 1}월
          </span>
          <button
            className="btn-icon"
            onClick={handleNextMonth}
            aria-label="다음 달"
            disabled={isViewingFutureMonth}
            title={isViewingFutureMonth ? '미래 날짜는 선택할 수 없어요' : '다음 달'}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="dp-weekdays">
          {DAY_LABELS.map((d, i) => (
            <span
              key={d}
              className={`dp-weekday ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}
            >
              {d}
            </span>
          ))}
        </div>

        <div className="dp-grid">
          {calendarDays.map((d, idx) => {
            if (!d) return <span key={idx} className="dp-cell empty" />
            const ymd = dateToYmd(d)
            const isToday    = ymd === today
            const isSelected = ymd === selectedDate
            const isFuture   = ymd > today
            const hasData    = availableDates.has(ymd)
            const dow        = d.getDay()
            return (
              <button
                key={idx}
                disabled={isFuture}
                className={`dp-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasData ? 'has-data' : ''} ${isFuture ? 'future' : ''} ${dow === 0 ? 'sun' : ''} ${dow === 6 ? 'sat' : ''}`}
                onClick={() => handleSelect(d)}
                aria-label={`${ymd}${hasData ? ' (데이터 있음)' : ''}${isFuture ? ' (미래, 선택 불가)' : ''}`}
                title={isFuture ? '미래 날짜는 선택할 수 없어요' : undefined}
              >
                {d.getDate()}
                {hasData && !isFuture && <span className="dp-dot" aria-hidden="true" />}
              </button>
            )
          })}
        </div>

        <div className="dp-footer">
          <button className="btn btn-ghost btn-full" onClick={handleToday}>
            오늘로 이동
          </button>
        </div>
      </div>
    </div>
  )
}
