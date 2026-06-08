import { useLocation, useNavigate } from 'react-router-dom'
import { flushSync } from 'react-dom'
import {
  Dumbbell, UtensilsCrossed, ClipboardList,
  HeartPulse, Sparkles, TrendingUp,
} from 'lucide-react'
import './BottomNav.css'

const TABS = [
  { path: '/schedule', icon: ClipboardList,  label: '스케줄' },
  { path: '/workout',  icon: Dumbbell,        label: '운동' },
  { path: '/meal',     icon: UtensilsCrossed, label: '식단' },
  { path: '/body',     icon: HeartPulse,      label: '체성분' },
  { path: '/volume',   icon: TrendingUp,      label: '볼륨' },
  { path: '/coach',    icon: Sparkles,        label: 'AI 코치', extra: 'nav-coach' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const activeIndex = TABS.findIndex((t) => pathname.startsWith(t.path))

  const handleNav = (path, toIdx) => (e) => {
    e.preventDefault()
    if (pathname.startsWith(path)) return

    const dir = toIdx > activeIndex ? 'right' : 'left'
    document.documentElement.dataset.navDir = dir

    if (document.startViewTransition) {
      document.startViewTransition(() => flushSync(() => navigate(path)))
    } else {
      navigate(path)
    }
  }

  return (
    <nav
      className="bottom-nav"
      role="navigation"
      aria-label="메인 탭 네비게이션"
      style={{ '--nav-active-idx': activeIndex < 0 ? 0 : activeIndex }}
    >
      <span className="nav-indicator" aria-hidden="true" />
      {TABS.map(({ path, icon: Icon, label, extra }, idx) => (
        <a
          key={path}
          href={path}
          className={`nav-item${pathname.startsWith(path) ? ' active' : ''}${extra ? ` ${extra}` : ''}`}
          onClick={handleNav(path, idx)}
          aria-current={pathname.startsWith(path) ? 'page' : undefined}
        >
          <Icon size={20} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  )
}
