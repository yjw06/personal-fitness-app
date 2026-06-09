import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useMemoryStore } from './stores/memoryStore'
import { useAIStore } from './stores/aiStore'
import LoginPage      from './pages/LoginPage'
import WorkoutPage    from './pages/WorkoutPage'
import MealPage       from './pages/MealPage'
import SchedulePage   from './pages/SchedulePage'
import BodyPage       from './pages/BodyPage'
import VolumePage     from './pages/VolumePage'
import CoachPage      from './pages/CoachPage'
import AssistantPage  from './pages/AssistantPage'
import Header         from './components/Layout/Header'
import BottomNav      from './components/Layout/BottomNav'
import ToastContainer from './components/Toast/ToastContainer'
import './index.css'

export default function App() {
  const { user, loading } = useAuth()
  const resetMemory   = useMemoryStore((s) => s.reset)
  const loadMemory    = useMemoryStore((s) => s.load)
  const loadAIForUser = useAIStore((s) => s.loadForUser)

  // 사용자 전환 시 메모리/채팅 격리
  useEffect(() => {
    if (!user) {
      resetMemory()
      loadAIForUser(null)
    } else {
      loadMemory(user.uid)
      loadAIForUser(user.uid)
    }
  }, [user, resetMemory, loadMemory, loadAIForUser])

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
      }}>
        <span style={{ fontSize: '2.5rem' }}>💪</span>
        <span className="spinner" />
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    )
  }

  return (
    <BrowserRouter basename="/personal-fitness-app">
      <div className="app-layout">
        <Header user={user} />
        <ToastContainer />
        <Routes>
          <Route path="/"          element={<Navigate to="/schedule" replace />} />
          <Route path="/schedule"  element={<SchedulePage />} />
          <Route path="/workout"   element={<WorkoutPage />} />
          <Route path="/meal"      element={<MealPage />} />
          <Route path="/body"      element={<BodyPage />} />
          <Route path="/volume"    element={<VolumePage />} />
          <Route path="/coach"     element={<CoachPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="*"          element={<Navigate to="/schedule" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
