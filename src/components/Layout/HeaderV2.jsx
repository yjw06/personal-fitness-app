import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Calendar, Settings, Sparkles } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '../../services/firebase'
import { useWorkoutStore } from '../../stores/workoutStore'
import DatePicker from '../DatePicker/DatePicker'
import SettingsModal from '../Settings/SettingsModal'
import './HeaderV2.css'

const PAGE_META = {
  '/schedule':  { eyebrow: "TODAY'S PLAN", title: '스케줄' },
  '/workout':   { eyebrow: 'TRAINING',     title: '운동' },
  '/meal':      { eyebrow: 'NUTRITION',    title: '식단' },
  '/body':      { eyebrow: 'BODY METRICS', title: '체성분' },
  '/volume':    { eyebrow: 'PROGRESS',     title: '볼륨' },
  '/coach':     { eyebrow: 'AI COACH',     title: '코치' },
  '/assistant': { eyebrow: 'ASSISTANT',    title: '어시스턴트' },
}

const WEEKDAY_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// 로컬 시간 기준 YYYYMMDD (UTC 변환 X)
function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function ymdToDate(ymd) {
  if (!ymd || ymd.length !== 8) return new Date()
  return new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T00:00:00`)
}

export default function HeaderV2() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const meta = PAGE_META[pathname] ?? { eyebrow: 'WORK OUT!', title: '워크아웃' }

  const selectedDate = useWorkoutStore((s) => s.selectedDate)
  const today = todayYmd()
  const isToday  = !selectedDate || selectedDate === today
  const isPast   = !!selectedDate && selectedDate < today
  const isFuture = !!selectedDate && selectedDate > today

  const viewDate = ymdToDate(isToday ? today : selectedDate)
  const eyebrowDate = `${WEEKDAY_EN[viewDate.getDay()]} ${viewDate.getMonth() + 1}.${String(viewDate.getDate()).padStart(2, '0')}`
  const dateText = viewDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  const [pickerOpen, setPickerOpen]     = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const isCoach = pathname.startsWith('/coach')

  return (
    <>
      <header className="hv2" role="banner">
        <div className="hv2-top">
          <span className="hv2-eyebrow">
            <span className="hv2-eyebrow-date">{eyebrowDate}</span>
            <span className="hv2-eyebrow-sep" aria-hidden="true" />
            <span>{meta.eyebrow}</span>
          </span>
          <div className="hv2-actions">
            <button
              className={`hv2-icon-btn hv2-ai-btn${isCoach ? ' active' : ''}`}
              onClick={() => navigate('/coach')}
              aria-label="AI 코치"
              title="AI 코치"
            >
              <Sparkles size={17} />
            </button>
            <button
              className="hv2-icon-btn"
              onClick={() => setSettingsOpen(true)}
              aria-label="설정"
              title="설정"
            >
              <Settings size={17} />
            </button>
            <button
              className="hv2-icon-btn"
              onClick={() => signOut(auth)}
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>

        <h1 className="hv2-title">
          {meta.title}
          {isPast   && <span className="hv2-tag past">과거</span>}
          {isFuture && <span className="hv2-tag future">예정</span>}
        </h1>

        <button
          className="hv2-date-btn"
          onClick={() => setPickerOpen(true)}
          aria-label="날짜 선택"
          title="날짜 선택"
        >
          <Calendar size={13} />
          <span>{dateText}</span>
        </button>
      </header>

      <DatePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
