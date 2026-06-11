import { useLocation, useNavigate } from 'react-router-dom'
import { flushSync } from 'react-dom'
import {
  Dumbbell, UtensilsCrossed, ClipboardList,
  HeartPulse, TrendingUp,
} from 'lucide-react'
import './BottomNavV2.css'

// 센터 FAB(운동) 독 — AI 코치는 헤더의 ✦ 버튼으로 이동
const DOCK = [
  { path: '/schedule', icon: ClipboardList,  label: '스케줄' },
  { path: '/meal',     icon: UtensilsCrossed, label: '식단' },
  { path: '/workout',  icon: Dumbbell,        label: '운동', fab: true },
  { path: '/body',     icon: HeartPulse,      label: '체성분' },
  { path: '/volume',   icon: TrendingUp,      label: '볼륨' },
]

export default function BottomNavV2() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const activeIndex = DOCK.findIndex((t) => pathname.startsWith(t.path))

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
    <nav className="dock-v2" role="navigation" aria-label="메인 탭 네비게이션">
      {DOCK.map(({ path, icon: Icon, label, fab }, idx) => {
        const active = pathname.startsWith(path)
        if (fab) {
          return (
            <a
              key={path}
              href={path}
              className={`dock-fab${active ? ' active' : ''}`}
              onClick={handleNav(path, idx)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              title={label}
            >
              <Icon size={24} />
            </a>
          )
        }
        return (
          <a
            key={path}
            href={path}
            className={`dock-item${active ? ' active' : ''}`}
            onClick={handleNav(path, idx)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
            <span className="dock-dot" aria-hidden="true" />
          </a>
        )
      })}
    </nav>
  )
}
