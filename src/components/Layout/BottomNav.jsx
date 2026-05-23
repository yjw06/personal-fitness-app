import { NavLink } from 'react-router-dom'
import {
  Dumbbell, UtensilsCrossed, ClipboardList,
  HeartPulse, Sparkles,
} from 'lucide-react'
import './BottomNav.css'

export default function BottomNav() {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="메인 탭 네비게이션">
      <NavLink to="/schedule" id="nav-schedule" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <ClipboardList size={20} />
        <span>스케줄</span>
      </NavLink>
      <NavLink to="/workout" id="nav-workout" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Dumbbell size={20} />
        <span>운동</span>
      </NavLink>
      <NavLink to="/meal" id="nav-meal" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <UtensilsCrossed size={20} />
        <span>식단</span>
      </NavLink>
      <NavLink to="/body" id="nav-body" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <HeartPulse size={20} />
        <span>체성분</span>
      </NavLink>
      <NavLink to="/coach" id="nav-coach" className={({ isActive }) => `nav-item${isActive ? ' active' : ''} nav-coach`}>
        <Sparkles size={20} />
        <span>AI 코치</span>
      </NavLink>
    </nav>
  )
}
