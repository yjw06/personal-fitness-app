import { NavLink } from 'react-router-dom'
import { Dumbbell, UtensilsCrossed, ClipboardList } from 'lucide-react'
import './BottomNav.css'

export default function BottomNav() {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="메인 탭 네비게이션">
      <NavLink to="/schedule" id="nav-schedule" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <ClipboardList size={22} />
        <span>스케줄</span>
      </NavLink>
      <NavLink to="/workout" id="nav-workout" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Dumbbell size={22} />
        <span>운동</span>
      </NavLink>
      <NavLink to="/meal" id="nav-meal" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <UtensilsCrossed size={22} />
        <span>식단</span>
      </NavLink>
    </nav>
  )
}
