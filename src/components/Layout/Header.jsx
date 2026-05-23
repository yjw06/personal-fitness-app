import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut, Calendar, Settings } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '../../services/firebase'
import { useWorkoutStore } from '../../stores/workoutStore'
import DatePicker from '../DatePicker/DatePicker'
import SettingsModal from '../Settings/SettingsModal'
import './Header.css'

const PAGE_TITLES = {
  '/schedule': '오늘의 스케줄',
  '/workout':  '오늘의 운동',
  '/meal':     '오늘의 식단',
  '/body':     '체성분 기록',
  '/coach':    'AI 코치',
}

// YYYYMMDD → "M월 D일 (요일)"
function formatSelectedDate(ymd) {
  if (!ymd || ymd.length !== 8) return ''
  const d = new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}T00:00:00`)
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

// 로컬 시간 기준 YYYYMMDD (UTC 변환 X)
function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export default function Header() {
  const { pathname } = useLocation()
  const baseTitle = PAGE_TITLES[pathname] ?? 'WORK OUT!'
  const selectedDate = useWorkoutStore((s) => s.selectedDate)
  const today = todayYmd()
  const isToday  = selectedDate === today
  const isPast   = !!selectedDate && selectedDate < today    // YYYYMMDD는 사전순 비교 = 시간순 비교
  const isFuture = !!selectedDate && selectedDate > today

  const [pickerOpen, setPickerOpen]     = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 과거/미래 날짜를 보고 있으면 타이틀에 표시
  const title = isToday ? baseTitle : baseTitle.replace('오늘의 ', '')
  const dateText = isToday ? formatSelectedDate(today) : formatSelectedDate(selectedDate)

  return (
    <>
      <header className="app-header" role="banner">
        <div className="header-left">
          <h1 className="header-title">
            {title}
            {isPast   && <span className="header-past-tag past">과거</span>}
            {isFuture && <span className="header-past-tag future">예정</span>}
          </h1>
          <button
            className="header-date-btn"
            onClick={() => setPickerOpen(true)}
            aria-label="날짜 선택"
            title="날짜 선택"
          >
            <Calendar size={12} />
            <span>{dateText}</span>
          </button>
        </div>

        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="설정"
            title="설정"
          >
            <Settings size={18} />
          </button>
          <button
            className="btn-icon"
            onClick={() => signOut(auth)}
            aria-label="로그아웃"
            title="로그아웃"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <DatePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
