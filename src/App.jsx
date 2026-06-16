import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from './hooks/useAuth'
import { useMemoryStore } from './stores/memoryStore'
import { useAIStore } from './stores/aiStore'
import { useSettingsStore } from './stores/settingsStore'
import { toast } from './stores/toastStore'
import LoginPage      from './pages/LoginPage'
import WorkoutPage    from './pages/WorkoutPage'
import MealPage       from './pages/MealPage'
import SchedulePage   from './pages/SchedulePage'
import BodyPage       from './pages/BodyPage'
import VolumePage     from './pages/VolumePage'
import CoachPage      from './pages/CoachPage'
import AssistantPage  from './pages/AssistantPage'
import HeaderV2       from './components/Layout/HeaderV2'
import BottomNavV2    from './components/Layout/BottomNavV2'
import ToastContainer from './components/Toast/ToastContainer'
import './index.css'
import './themes/v2.css'
import './themes/colors.css'

export default function App() {
  const { user, loading } = useAuth()
  const resetMemory   = useMemoryStore((s) => s.reset)
  const loadMemory    = useMemoryStore((s) => s.load)
  const loadAIForUser = useAIStore((s) => s.loadForUser)
  const colorTheme    = useSettingsStore((s) => s.colorTheme)

  // 레이아웃은 v2 고정, 액센트만 컬러 테마로 적용
  useEffect(() => {
    document.documentElement.dataset.ui = 'v2'
    document.documentElement.dataset.theme = colorTheme
  }, [colorTheme])

  // 네이티브(iOS): 앱 시작 시 알림 권한 요청 (휴식 종료 잠금화면 알림용)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    import('@capacitor/local-notifications')
      .then(async ({ LocalNotifications }) => {
        let perm = await LocalNotifications.checkPermissions()
        if (perm.display !== 'granted') {
          perm = await LocalNotifications.requestPermissions()
        }
        if (perm.display !== 'granted') {
          toast.warning('알림 권한이 꺼져 있어요. 설정 > 알림 > WORK OUT!에서 허용해 주세요.')
        }
      })
      .catch((e) => {
        toast.error(`알림 플러그인 오류: ${e?.message || e}`)
      })
  }, [])

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
    <BrowserRouter basename={Capacitor.isNativePlatform() ? '/' : '/personal-fitness-app'}>
      <div className="app-layout">
        <HeaderV2 />
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
        <BottomNavV2 />
      </div>
    </BrowserRouter>
  )
}
