import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage  from './pages/LoginPage'
import WorkoutPage from './pages/WorkoutPage'
import MealPage   from './pages/MealPage'
import SchedulePage from './pages/SchedulePage'
import Header     from './components/Layout/Header'
import BottomNav  from './components/Layout/BottomNav'
import './index.css'

export default function App() {
  const { user, loading } = useAuth()

  // Firebase 인증 상태 초기 확인 중 (스플래시)
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

  // 미로그인 → 로그인 페이지
  if (!user) return <LoginPage />

  // 로그인 완료 → 앱
  return (
    <BrowserRouter basename="/personal-fitness-app">
      <div className="app-layout">
        <Header user={user} />
        <Routes>
          <Route path="/"        element={<Navigate to="/schedule" replace />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/meal"    element={<MealPage />} />
          <Route path="*"        element={<Navigate to="/schedule" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
