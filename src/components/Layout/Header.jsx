import { useLocation } from 'react-router-dom'
import { LogOut, Calendar } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '../../services/firebase'
import './Header.css'

const PAGE_TITLES = {
  '/schedule': '오늘의 스케줄',
  '/workout': '오늘의 운동',
  '/meal':    '오늘의 식단',
  '/upload':  '일정 업로드',
}

export default function Header({ user }) {
  const { pathname } = useLocation()
  const title = PAGE_TITLES[pathname] ?? 'WORK OUT!'

  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short',
  })

  return (
    <header className="app-header" role="banner">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
        <p className="header-date">
          <Calendar size={12} style={{ display:'inline', marginRight:'4px' }} />
          {today}
        </p>
      </div>
      <button
        id="btn-logout"
        className="btn-icon"
        onClick={() => signOut(auth)}
        aria-label="로그아웃"
        title="로그아웃"
      >
        <LogOut size={18} />
      </button>
    </header>
  )
}
